import { existsSync } from "node:fs";
import { getAllowList } from "../security/allowlist";
import { resolveBinary } from "../binary";
import { runProcess } from "./spawn";
import type { SegmentRunResult } from "./index";

/**
 * sublist3r segment — enumerate subdomains from search-engine caches.
 *
 * The domain is an allow-listed target; nothing is written to disk and only
 * thread/engine options are forwarded. Hostnames matching the target suffix
 * are collected into a unique list.
 */

const HOSTNAME_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?)*$/i;
const THREADS_PATTERN = /^(?:[1-9]|[1-9]\d)$/;
const ENGINES_PATTERN = /^[a-z0-9]+(?:,[a-z0-9]+){0,40}$/i;

export interface Sublist3rData {
  domain: string;
  subs: string[];
}

export function buildSublist3rArgs(
  args: string[],
): { args: string[] } | { error: string } {
  const out: string[] = [];
  const FLAGS = new Set(["-v", "-b"]);
  const VALUE_FLAGS = new Set(["-t", "-e", "-w"]);

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (FLAGS.has(a)) {
      out.push(a);
      if (a === "-b" && !args.includes("-w")) {
        return { error: '"-b" (bruteforce) requires a wordlist via "-w"' };
      }
      continue;
    }
    if (VALUE_FLAGS.has(a)) {
      const value = args[i + 1];
      if (value === undefined) return { error: `argument "${a}" requires a value` };
      if (a === "-t" && !THREADS_PATTERN.test(value)) {
        return { error: `invalid -t threads: "${value}" (1-99)` };
      } else if (a === "-e" && !ENGINES_PATTERN.test(value)) {
        return { error: `invalid -e engines: "${value}"` };
      } else if (a === "-w") {
        if (!existsSync(value)) return { error: `wordlist not found: "${value}"` };
      }
      out.push(a, value);
      i++;
      continue;
    }
    return { error: `argument not allowed for sublist3r: "${a}"` };
  }
  return { args: out };
}

export function parseSublist3rOutput(stdout: string, domain: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  const suffix = domain.toLowerCase().replace(/\.$/, "");
  for (const line of stdout.split("\n")) {
    let t = line.trim().replace(/\s+$/, "");
    const bullet = /^(?:\[\+\]|\[\*\]|\[!\]|\[-\]|[-+])\s*/.exec(t);
    if (bullet) t = t.slice(bullet[0].length).trim();
    if (!HOSTNAME_RE.test(t)) continue;
    const low = t.toLowerCase();
    if (low === suffix || low.endsWith(`.${suffix}`)) {
      if (!seen.has(low)) {
        seen.add(low);
        found.push(low);
      }
    }
  }
  return found;
}

export async function runSublist3rSegment(
  target: string | undefined,
  args: string[],
): Promise<SegmentRunResult> {
  const allowList = getAllowList();
  const bin = resolveBinary("sublist3r");

  if (!target) {
    return { status: "error", message: "sublist3r requires a domain target." };
  }
  if (!allowList.contains(target, { publicHostnames: true })) {
    return { status: "blocked", blocked: true, message: `target not allowed: "${target}".` };
  }
  if (!bin) {
    return {
      status: "error",
      available: false,
      message:
        'sublist3r binary not found on this host (install with `pip install --user sublist3r`).',
    };
  }

  const built = buildSublist3rArgs(args);
  if ("error" in built) return { status: "error", message: built.error, available: true };

  const timeoutMs = Number(process.env.OSINT_RUN_TIMEOUT_MS ?? 30_000);
  const maxOutputBytes = Number(process.env.OSINT_MAX_OUTPUT_BYTES ?? 64_000);
  const started = Date.now();

  const res = await runProcess(bin, ["-d", target, ...built.args], { timeoutMs, maxOutputBytes });
  const durationMs = Date.now() - started;
  const subs = parseSublist3rOutput(res.stdout, target);
  const data: Sublist3rData = { domain: target, subs };

  return {
    status: res.timedOut ? "error" : "ok",
    message: `${target}: ${subs.length} subdomain(s)${res.timedOut ? " (timed out — partial)" : ""}`,
    durationMs,
    available: true,
    exitCode: res.exitCode,
    timedOut: res.timedOut,
    stdout: res.stdout.slice(0, 16_000),
    data,
  };
}