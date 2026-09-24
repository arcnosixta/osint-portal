import { getAllowList } from "../security/allowlist";
import { resolveBinary } from "../binary";
import { runProcess } from "./spawn";
import type { SegmentRunResult } from "./index";

/**
 * theHarvester segment — collect emails and hosts for a domain.
 *
 * Read-only OSINT against search engines / certificate sources; only the
 * source, limit and verbosity flags are forwarded. File/database outputs are
 * rejected. Emails and "Host N:" entries are parsed into two lists.
 */

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const SOURCE_PATTERN = /^[A-Za-z0-9,_-]{1,40}$/;
const LIMIT_PATTERN = /^(?:[1-9]\d{0,2}|500)$/;

export interface TheHarvesterData {
  domain: string;
  emails: string[];
  hosts: string[];
  source?: string;
}

export function buildTheHarvesterArgs(
  args: string[],
): { args: string[] } | { error: string } {
  const out: string[] = [];
  const FLAGS = new Set(["-v"]);
  const VALUE_FLAGS = new Set(["-b", "-l"]);

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (FLAGS.has(a)) {
      out.push(a);
      continue;
    }
    if (VALUE_FLAGS.has(a)) {
      const value = args[i + 1];
      if (value === undefined) return { error: `argument "${a}" requires a value` };
      if (a === "-b" && !SOURCE_PATTERN.test(value)) {
        return { error: `invalid -b source: "${value}"` };
      }
      if (a === "-l" && !LIMIT_PATTERN.test(value)) {
        return { error: `invalid -l limit: "${value}" (1-500)` };
      }
      out.push(a, value);
      i++;
      continue;
    }
    return { error: `argument not allowed for theHarvester: "${a}"` };
  }
  return { args: out };
}

export function parseTheHarvesterOutput(stdout: string, domain: string): TheHarvesterData {
  const data: TheHarvesterData = { domain, emails: [], hosts: [] };
  const seenEmails = new Set<string>();
  const seenHosts = new Set<string>();
  let section: "emails" | "hosts" | null = null;

  for (const line of stdout.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    if (/^Emails found\b/i.test(t)) {
      section = "emails";
      continue;
    }
    if (/^Hosts found\b/i.test(t)) {
      section = "hosts";
      continue;
    }
    if (/^[-—]\s*$/.test(t)) continue;
    if (/^(Searching in|Searching for|Processing|[*]|[-]\s*(Target|Starting))/i.test(t)) continue;

    if (section === "emails" && EMAIL_RE.test(t)) {
      const e = t.toLowerCase();
      if (!seenEmails.has(e)) {
        seenEmails.add(e);
        data.emails.push(e);
      }
      continue;
    }
    if (section === "hosts") {
      const m = /^Host\s+\d+:\s*(\S+)/i.exec(t);
      const h = m ? m[1] : t.startsWith("http") ? t : null;
      if (h && !seenHosts.has(h) && h !== "----" && !h.startsWith("-")) {
        seenHosts.add(h);
        data.hosts.push(h);
      }
    }
  }
  return data;
}

export async function runTheHarvesterSegment(
  target: string | undefined,
  args: string[],
): Promise<SegmentRunResult> {
  const allowList = getAllowList();
  const bin = resolveBinary("theHarvester");

  if (!target) {
    return { status: "error", message: "theHarvester requires a domain target." };
  }
  if (!allowList.contains(target, { publicHostnames: true })) {
    return { status: "blocked", blocked: true, message: `target not allowed: "${target}".` };
  }
  if (!bin) {
    return {
      status: "error",
      available: false,
      message:
        'theHarvester binary not found on this host (install with `pip install --user theHarvester`).',
    };
  }

  const built = buildTheHarvesterArgs(args);
  if ("error" in built) return { status: "error", message: built.error, available: true };

  const timeoutMs = Number(process.env.OSINT_RUN_TIMEOUT_MS ?? 45_000);
  const maxOutputBytes = Number(process.env.OSINT_MAX_OUTPUT_BYTES ?? 96_000);
  const started = Date.now();

  const defaultArgs = ["-b", "all", "-l", "100"];
  const res = await runProcess(bin, ["-d", target, ...built.args, ...defaultArgs], {
    timeoutMs,
    maxOutputBytes,
  });
  const durationMs = Date.now() - started;
  const data = parseTheHarvesterOutput(res.stdout, target);

  return {
    status: res.timedOut ? "error" : "ok",
    message: `${target}: ${data.emails.length} email(s), ${data.hosts.length} host(s)${res.timedOut ? " (timed out — partial)" : ""}`,
    durationMs,
    available: true,
    exitCode: res.exitCode,
    timedOut: res.timedOut,
    stdout: res.stdout.slice(0, 16_000),
    data,
  };
}