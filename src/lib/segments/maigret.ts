import { resolveBinary } from "../binary";
import { runProcess } from "./spawn";
import type { SegmentRunResult } from "./index";

/**
 * maigret segment — account existence across many sites (like sherlock).
 *
 * Username-targeted (no host to protect, but the username itself is validated
 * with a strict pattern). Only a small flag set is forwarded; profile URLs are
 * extracted from the output.
 */

const USERNAME_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9_.-]{0,48}[A-Za-z0-9])?$/;
const URL_RE = /^https?:\/\/\S+$/i;
const TIMEOUT_PATTERN = /^(?:[1-9]|[1-5]\d|60)$/;

// hosts that appear in maigret's own stdout noise (progress/analytics),
// never as a real `[+] site: url` profile entry
const NOISE_HOSTS = new Set([
  "raw.githubusercontent.com",
  "files.pythonhosted.org",
]);

export interface MaigretSite {
  site: string;
  url: string;
}

export interface MaigretData {
  username: string;
  found: MaigretSite[];
}

export function buildMaigretArgs(
  args: string[],
): { args: string[] } | { error: string } {
  const out: string[] = [];
  const FLAGS = new Set(["--print-all", "--no-color"]);
  const VALUE_FLAGS = new Set(["--timeout", "--retries"]);

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (FLAGS.has(a)) {
      out.push(a);
      continue;
    }
    if (VALUE_FLAGS.has(a)) {
      const value = args[i + 1];
      if (value === undefined) return { error: `argument "${a}" requires a value` };
      if (a === "--timeout" && !TIMEOUT_PATTERN.test(value)) {
        return { error: `invalid --timeout: "${value}" (1-60s)` };
      }
      if (a === "--retries" && !/^(?:[1-9]|10)$/.test(value)) {
        return { error: `invalid --retries: "${value}" (1-10)` };
      }
      out.push(a, value);
      i++;
      continue;
    }
    return { error: `argument not allowed for maigret: "${a}"` };
  }
  return { args: out };
}

export function parseMaigretOutput(stdout: string, username: string): MaigretSite[] {
  const found: MaigretSite[] = [];
  const seen = new Set<string>();

  for (const line of stdout.split("\n")) {
    const m = /^\s*(?:\[\+\]\s*|#\s*\d+\s*)?([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*):\s*(https?:\/\/\S+)\s*$/.exec(line);
    if (!m) continue;
    const site = m[1].toLowerCase();
    const url = m[2];
    if (NOISE_HOSTS.has(site)) continue;

    const host = (() => {
      try {
        return new URL(url).hostname.toLowerCase();
      } catch {
        return site;
      }
    })();
    if (host === "example.com" || host.includes("example.com")) continue;
    if (!URL_RE.test(url)) continue;

    const key = `${site}->${url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    found.push({
      site,
      url: url.includes(`${username}`) || url.includes("%40") ? url : `${site === host ? "" : host} ${url}`.trim(),
    });
  }
  return found;
}

export async function runMaigretSegment(
  target: string | undefined,
  args: string[],
): Promise<SegmentRunResult> {
  const bin = resolveBinary("maigret");

  if (!target) {
    return { status: "error", message: "maigret requires a username target." };
  }
  if (!USERNAME_PATTERN.test(target)) {
    return { status: "error", message: `invalid username: "${target}"` };
  }
  if (!bin) {
    return {
      status: "error",
      available: false,
      message:
        'maigret binary not found on this host (install with `pip install --user maigret`).',
    };
  }

  const built = buildMaigretArgs(args);
  if ("error" in built) return { status: "error", message: built.error, available: true };

  const timeoutMs = Number(process.env.OSINT_RUN_TIMEOUT_MS ?? 45_000);
  const maxOutputBytes = Number(process.env.OSINT_MAX_OUTPUT_BYTES ?? 96_000);
  const started = Date.now();

  const res = await runProcess(bin, [target, ...built.args, "--no-color"], {
    timeoutMs,
    maxOutputBytes,
  });
  const durationMs = Date.now() - started;
  const found = parseMaigretOutput(res.stdout, target);
  const data: MaigretData = { username: target, found: found.slice(0, 200) };

  return {
    status: res.timedOut ? "error" : "ok",
    message: `${target}: ${found.length} profile(s)${res.timedOut ? " (timed out — partial)" : ""}`,
    durationMs,
    available: true,
    exitCode: res.exitCode,
    timedOut: res.timedOut,
    stdout: res.stdout.slice(0, 16_000),
    data,
  };
}