import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { getAllowList } from "../security/allowlist";
import { resolveBinary } from "../binary";
import { runProcess } from "./spawn";
import type { SegmentRunResult } from "./index";

/**
 * gobuster segment — directory/subdomain/vhost/DNS brute-force.
 *
 * The first positional is the mode (dir | subdomain | vhost | dns). Wordlists
 * must exist on disk and match a conservative path pattern; threads, status
 * codes, extensions and a fixed set of flags are the only forwarded options.
 */

export type GobusterMode = "dir" | "subdomain" | "vhost" | "dns";

export const GOBUSTER_MODES: GobusterMode[] = ["dir", "subdomain", "vhost", "dns"];

const URL_RE =
  /^https?:\/\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*(?::\d{1,5})?(?:\/[^\s]*)?$/i;
const HOST_RE = /^https?:\/\/([^/:]+)/i;
const WL_PATH_RE = /^(?:\/|\.{1,2}\/)?[A-Za-z0-9_./-]+$/;
const THREADS_PATTERN = /^(?:[1-9]|[1-9]\d|200)$/;
const EXT_PATTERN = /^[a-z0-9]{1,8}(?:,[a-z0-9]{1,8})*$/;
const STATUS_PATTERN = /^\d{3}(?:,\d{3})*$/;

const DEFAULT_WORDLISTS = [
  "/usr/share/seclists/Discovery/Web-Content/common.txt",
  "/usr/share/wordlists/dirb/common.txt",
  "/usr/share/wordlists/amass.txt",
  "/usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt",
];

export function findDefaultWordlist(): string | null {
  return DEFAULT_WORDLISTS.find((p) => existsSync(p)) ?? null;
}

function isPathSafe(p: string): boolean {
  if (!WL_PATH_RE.test(p)) return false;
  const abs = resolve(p);
  if (/\s/.test(abs)) return false;
  return true;
}

export interface GobusterHit {
  path: string;
  status?: number;
  size?: number;
}

export interface GobusterData {
  mode: GobusterMode;
  target: string;
  wordlist: string;
  hits: GobusterHit[];
}

export type GobusterBuiltArgs = { args: string[]; mode: GobusterMode } | { error: string };

export function buildGobusterArgs(
  args: string[],
): GobusterBuiltArgs {
  const out: string[] = [];
  const positionals: string[] = [];
  const FLAGS = new Set(["-k", "-q", "--no-error"]);
  const VALUE_FLAGS = new Set(["-w", "-t", "-x", "-s"]);

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (FLAGS.has(a)) {
      out.push(a);
      continue;
    }
    if (VALUE_FLAGS.has(a)) {
      const value = args[i + 1];
      if (value === undefined) return { error: `argument "${a}" requires a value` };
      if (a === "-w") {
        if (!isPathSafe(value) || !existsSync(value)) {
          return { error: `wordlist not found or unsafe path: "${value}"` };
        }
      } else if (a === "-t" && !THREADS_PATTERN.test(value)) {
        return { error: `invalid -t threads value: "${value}" (1-200)` };
      } else if (a === "-x" && !EXT_PATTERN.test(value)) {
        return { error: `invalid -x extensions value: "${value}"` };
      } else if (a === "-s" && !STATUS_PATTERN.test(value)) {
        return { error: `invalid -s status codes: "${value}"` };
      }
      out.push(a, value);
      i++;
      continue;
    }
    if (GOBUSTER_MODES.includes(a as GobusterMode)) {
      positionals.push(a);
      continue;
    }
    return { error: `argument not allowed for gobuster: "${a}"` };
  }

  if (positionals.length === 0) return { error: "gobuster requires a mode: dir, subdomain, vhost or dns." };
  return { args: out, mode: positionals[0] as GobusterMode };
}

export function parseGobusterOutput(stdout: string, mode: GobusterMode): GobusterHit[] {
  const hits: GobusterHit[] = [];
  const seen = new Set<string>();

  const push = (h: GobusterHit) => {
    if (h.path && !seen.has(h.path)) {
      seen.add(h.path);
      hits.push(h);
    }
  };

  for (const line of stdout.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("Starting") || t.startsWith("Finished") || t.startsWith("Progress:")) continue;

    if (mode === "dir" || mode === "vhost") {
      const m = /^(\/\S*)\s*\(Status:\s*(\d{3})\)(?:\s*\[Size:\s*(\d+)\])?/.exec(t);
      if (m) {
        push({ path: m[1], ...(m[2] ? { status: Number(m[2]) } : {}), ...(m[3] ? { size: Number(m[3]) } : {}) });
        continue;
      }
    }

    const foundBracket = /^Found:\s+(\S+)\s*\[Status:\s*(\d{3})(?:\s*,\s*Size:\s*(\d+))?\]/i.exec(t);
    if (foundBracket) {
      push({
        path: foundBracket[1],
        ...(foundBracket[2] ? { status: Number(foundBracket[2]) } : {}),
        ...(foundBracket[3] ? { size: Number(foundBracket[3]) } : {}),
      });
      continue;
    }

    const found = /^Found:\s+(\S+)(?:\s*\(Status:\s*(\d{3})\))?/i.exec(t);
    if (found) {
      push({ path: found[1], ...(found[2] ? { status: Number(found[2]) } : {}) });
      continue;
    }
  }

  return hits;
}

export async function runGobusterSegment(
  target: string | undefined,
  args: string[],
): Promise<SegmentRunResult> {
  const allowList = getAllowList();
  const bin = resolveBinary("gobuster");

  if (!target) {
    return { status: "error", message: 'gobuster requires a target: a full URL (dir/vhost) or a domain (subdomain/dns).' };
  }

  const built = buildGobusterArgs(args);
  if ("error" in built) return { status: "error", message: built.error, available: bin !== null };
  const mode = built.mode;

  const isUrlMode = mode === "dir" || mode === "vhost";
  const effectiveTarget = target.trim();
  if (isUrlMode) {
    if (!URL_RE.test(effectiveTarget)) {
      return { status: "error", message: "dir/vhost mode needs an http(s) URL target, e.g. http://127.0.0.1:3000." };
    }
    const host = HOST_RE.exec(effectiveTarget)?.[1];
    if (!host || !allowList.contains(host, { publicHostnames: true })) {
      return { status: "blocked", blocked: true, message: `target not allowed: "${host}".` };
    }
  } else if (!allowList.contains(effectiveTarget, { publicHostnames: true })) {
    return { status: "blocked", blocked: true, message: `target not allowed: "${effectiveTarget}".` };
  }

  if (!bin) {
    return {
      status: "error",
      available: false,
      message: 'gobuster binary not found on this host (install with `sudo apt install gobuster` or `go install github.com/OJ/gobuster/v3@latest`).',
    };
  }

  const wordlist =
    args.indexOf("-w") >= 0 ? args[args.indexOf("-w") + 1] : findDefaultWordlist();
  if (!wordlist) {
    return {
      status: "error",
      available: true,
      message: "no wordlist found — pass -w <path> or install seclists (`sudo apt install seclists`).",
    };
  }

  const timeoutMs = Number(process.env.OSINT_RUN_TIMEOUT_MS ?? 30_000);
  const maxOutputBytes = Number(process.env.OSINT_MAX_OUTPUT_BYTES ?? 64_000);
  const started = Date.now();

  const flag = mode === "dir" || mode === "vhost" ? "-u" : "-d";
  const res = await runProcess(bin, [mode, flag, effectiveTarget, "-w", wordlist, ...built.args], {
    timeoutMs,
    maxOutputBytes,
  });
  const durationMs = Date.now() - started;
  const hits = parseGobusterOutput(res.stdout, mode);
  const open = hits.filter((h) => h.status === undefined || h.status < 400);

  const data: GobusterData = { mode, target: effectiveTarget, wordlist, hits };
  return {
    status: res.timedOut ? "error" : "ok",
    message: `${mode} @ ${effectiveTarget}: ${hits.length} hit(s), ${open.length} open${res.timedOut ? " (timed out — partial)" : ""}`,
    durationMs,
    available: true,
    exitCode: res.exitCode,
    timedOut: res.timedOut,
    stdout: res.stdout.slice(0, 16_000),
    data,
  };
}