import { resolveBinary } from "../binary";
import { runProcess } from "./spawn";
import { validateArgs } from "./args";
import type { SegmentRunResult } from "./index";

/**
 * sherlock segment. Targets are usernames (not IPs/hostnames), so the target
 * allow-list does not apply — instead the username itself is validated against
 * a strict pattern and forwarded only with a fixed flag set.
 */

const USERNAME_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9_.-]{0,30}[A-Za-z0-9])?$/;
const TIMEOUT_PATTERN = /^\d{1,3}$/;
const DEFAULT_TIMEOUT = 6;
const DEFAULT_TIMEOUT_MS = 60_000;

export function isValidUsername(u: string): boolean {
  return USERNAME_PATTERN.test(u) && u.length <= 32;
}

export interface SherlockHit {
  site: string;
  url: string;
}

const FOUND_RE = /^\[\+\]\s+(\S+?):\s+(.+)$/gm;

export function parseSherlockOutput(output: string): SherlockHit[] {
  const hits: SherlockHit[] = [];
  let m: RegExpExecArray | null;
  FOUND_RE.lastIndex = 0;
  while ((m = FOUND_RE.exec(output)) !== null) {
    hits.push({ site: m[1], url: m[2].trim() });
  }
  return hits;
}

export function buildSherlockArgs(
  args: string[],
  timeout: number,
  requestedTimeout: boolean,
): string[] {
  const out: string[] = [];
  if (args.includes("--print-found")) out.push("--print-found");
  if (args.includes("--print-all")) out.push("--print-all");
  if (args.includes("--no-color")) out.push("--no-color");
  if (requestedTimeout) out.push("--timeout", String(timeout));
  return out;
}

export async function runSherlockSegment(
  target: string | undefined,
  args: string[],
): Promise<SegmentRunResult> {
  const bin = resolveBinary("sherlock");

  if (!target) {
    return { message: "sherlock requires a username to search, e.g. \"octocat\"." };
  }
  if (!isValidUsername(target)) {
    return {
      message: 'invalid username: usernames are 1-32 chars of letters, digits, "_", "." and "-", starting and ending with a letter or digit.',
      status: "error",
    };
  }
  if (!bin) {
    return {
      message: 'sherlock binary not found (install with `pip install --user sherlock-project`).',
      available: false,
      status: "error",
    };
  }

  const validated = validateArgs(args, {
    flags: ["--print-found", "--print-all", "--no-color"],
    values: { "--timeout": TIMEOUT_PATTERN },
  }, "sherlock", { "--timeout": "timeout seconds (0-999)" });
  if ("error" in validated) return { message: validated.error, status: "error" };

  const requestedTimeout = validated.args.includes("--timeout");
  const timeout = (() => {
    const i = validated.args.indexOf("--timeout");
    return i >= 0 ? Number(validated.args[i + 1]) : DEFAULT_TIMEOUT;
  })();

  const timeoutMs = Number(process.env.OSINT_RUN_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  const maxOutputBytes = Number(process.env.OSINT_MAX_OUTPUT_BYTES ?? 128_000);
  const started = Date.now();

  const sherlockArgs = buildSherlockArgs(validated.args, timeout, requestedTimeout);
  const res = await runProcess(bin, [...sherlockArgs, target], { timeoutMs, maxOutputBytes });
  const text = res.stdout + "\n" + res.stderr;
  const hits = parseSherlockOutput(text);
  const durationMs = Date.now() - started;

  return {
    status: res.timedOut ? "error" : "ok",
    message: `@${target}: found on ${hits.length} site${hits.length === 1 ? "" : "s"}${res.timedOut ? " (scan timed out — partial)" : ""}`,
    durationMs,
    available: true,
    exitCode: 0,
    timedOut: res.timedOut,
    data: { username: target, foundCount: hits.length, found: hits, timeout },
  };
}