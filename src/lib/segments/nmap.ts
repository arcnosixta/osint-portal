import { getAllowList } from "../security/allowlist";
import { resolveBinary } from "../binary";
import { runProcess } from "./spawn";
import type { SegmentRunResult } from "./index";

/**
 * nmap segment — the reference implementation of the segment contract.
 *
 * Safety model:
 *   - the target must be inside the allow-list (see src/lib/security/allowlist.ts)
 *   - arguments are allow-listed: unknown flags/flags values are rejected;
 *     flags that redirect output, run scripts from disk, or smuggle files are excluded
 *   - the process runs with a hard timeout and capped stdout
 *
 * Returns a structured snapshot (open ports / services / OS hints) in `data`.
 */

export interface NmapPort {
  port: number;
  protocol: "tcp" | "udp";
  state: string;
  service?: string;
}

export interface NmapData {
  host?: string;
  ip?: string;
  ports: NmapPort[];
  os?: string;
  hostsUp?: string;
}

export const NMAP_DEFAULT_TIMEOUT_MS = 20_000;

// Exact-match flags that are safe to forward.
const FLAG_ALLOWLIST = new Set([
  "-A",
  "-O",
  "-Pn",
  "-sC",
  "-sS",
  "-sT",
  "-sU",
  "-sV",
  "-v",
  "-vv",
  "--open",
]);

// Flags that consume the following argument.
const VALUE_FLAGS = new Set(["-p", "--top-ports", "-T"]);

const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;
const PORTS_PATTERN = /^\d{1,5}(-\d{1,5})?(,\d{1,5}(-\d{1,5})?)*$/;
const TOP_PORTS_PATTERN = /^\d{1,5}$/;
const TIMING_VALUE_PATTERN = /^[0-5]$/;
const T_FLAG_PATTERN = /^-T[0-5]$/;

export function buildNmapArgs(args: string[]): { args: string[] } | { error: string } {
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (FLAG_ALLOWLIST.has(a)) {
      out.push(a);
      continue;
    }
    if (T_FLAG_PATTERN.test(a)) {
      out.push(a);
      continue;
    }
    if (VALUE_FLAGS.has(a)) {
      const value = args[i + 1];
      if (value === undefined) return { error: `argument "${a}" requires a value` };
      if (a === "-p") {
        if (value !== "-" && !PORTS_PATTERN.test(value)) return { error: `invalid port spec: "${value}"` };
      } else if (a === "--top-ports") {
        if (!TOP_PORTS_PATTERN.test(value)) return { error: `invalid --top-ports value: "${value}"` };
      } else if (!TIMING_VALUE_PATTERN.test(value)) {
        return { error: `invalid -T timing value: "${value}"` };
      }
      out.push(a, value);
      i++;
      continue;
    }
    return { error: `argument not allowed for nmap: "${a}"` };
  }
  return { args: out };
}

export function parseNmapOutput(stdout: string): NmapData {
  const data: NmapData = { ports: [] };

  const report = /Nmap scan report for (.+?)(?: \((\d{1,3}(?:\.\d{1,3}){3})\))?(?:$|\r?\n)/.exec(stdout);
  if (report) {
    data.host = report[1];
    data.ip = report[2] ?? (IPV4.test(report[1]) ? report[1] : undefined);
  }

  const os = /OS details: (.+)/.exec(stdout);
  if (os) data.os = os[1];

  const hostsUp = /(\d+(?:\.\d+)?) IP address(?:es)? \(\d+(?:\.\d+)? host.*? up\)/.exec(stdout);
  if (hostsUp) data.hostsUp = hostsUp[1];

  for (const line of stdout.split("\n")) {
    const m = /^(\d{1,5})\/(tcp|udp)\s+(open|closed|filtered)(?:\s+([a-z0-9._/-]+))?/i.exec(line.trim());
    if (!m) continue;
    const port = Number(m[1]);
    const protocol = m[2] as NmapPort["protocol"];
    data.ports.push({
      port,
      protocol,
      state: m[3],
      ...(m[4] ? { service: m[4] } : {}),
    });
  }

  // dedupe (nmap may re-report states) and keep first occurrence
  const seen = new Set<string>();
  data.ports = data.ports.filter((p) => {
    const key = `${p.port}/${p.protocol}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return data;
}

export async function runNmapSegment(
  target: string | undefined,
  args: string[],
): Promise<SegmentRunResult> {
  const available = resolveBinary("nmap") !== null;

  if (!target) {
    return {
      status: "error",
      connected: true,
      message: "nmap requires a target (IP, CIDR or hostname).",
      available,
    };
  }

  const allowList = getAllowList();
  if (!allowList.contains(target)) {
    return {
      status: "blocked",
      connected: true,
      message: `target not allowed: "${target}". ${allowList.describe()}`,
      blocked: true,
      available,
    };
  }

  if (!available) {
    return {
      status: "error",
      connected: true,
      message: "nmap binary not found on this host.",
      available: false,
    };
  }

  const built = buildNmapArgs(args);
  if ("error" in built) {
    return { status: "error", connected: true, message: built.error, available };
  }

  const timeoutMs = Number(process.env.OSINT_RUN_TIMEOUT_MS ?? NMAP_DEFAULT_TIMEOUT_MS);
  const maxOutputBytes = Number(process.env.OSINT_MAX_OUTPUT_BYTES ?? 64_000);

  const started = Date.now();
  const bin = resolveBinary("nmap")!;
  const res = await runProcess(
    bin,
    ["-Pn", ...built.args, target],
    { timeoutMs, maxOutputBytes },
  );
  const durationMs = Date.now() - started;

  if (res.timedOut) {
    return {
      status: "error",
      connected: true,
      message: `nmap timed out after ${timeoutMs}ms.`,
      durationMs,
      available,
      exitCode: res.exitCode,
    };
  }

  const data = parseNmapOutput(res.stdout);
  const ports = data.ports.filter((p) => p.state === "open");
  const summary =
    data.ip || data.host
      ? `scan complete: ${data.ip ?? data.host}, ${ports.length} open port(s)${data.os ? `, os: ${data.os}` : ""}`
      : "scan complete.";

  return {
    status: res.exitCode === 0 ? "ok" : "error",
    connected: true,
    message: res.exitCode === 0 ? summary : `nmap exited with code ${res.exitCode ?? "?"}${res.stderr ? `: ${res.stderr.slice(0, 200)}` : ""}`,
    durationMs,
    available,
    exitCode: res.exitCode,
    stdout: res.stdout.slice(0, 16_000),
    data,
  };
}