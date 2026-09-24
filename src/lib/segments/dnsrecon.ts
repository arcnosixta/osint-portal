import { getAllowList } from "../security/allowlist";
import { resolveBinary } from "../binary";
import { runProcess } from "./spawn";
import type { SegmentRunResult } from "./index";

/**
 * dnsrecon segment — one-shot DNS enumeration.
 *
 * Only a small set of enumeration types is forwarded (`std`, `brt`, `crt`,
 * `snoop`); anything that writes files or walks huge brute ranges is rejected.
 * Host/IP pairs are parsed into a records table.
 */

export type DnsreconType = "std" | "brt" | "crt" | "snoop";
export const DNSRECON_TYPES: DnsreconType[] = ["std", "brt", "crt", "snoop"];

export interface DnsRecord {
  host: string;
  ip?: string;
}

export interface DnsreconData {
  domain: string;
  records: DnsRecord[];
}

export function buildDnsreconArgs(
  args: string[],
): { args: string[]; type: DnsreconType } | { error: string } {
  const out: string[] = [];
  let type: DnsreconType = "std";
  const FLAGS = new Set(["-v", "-n"]);
  const VALUE_FLAGS = new Set(["-t"]);

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (FLAGS.has(a)) {
      out.push(a);
      continue;
    }
    if (VALUE_FLAGS.has(a)) {
      const value = args[i + 1];
      if (value === undefined) return { error: 'argument "-t" requires a value' };
      if (!DNSRECON_TYPES.includes(value as DnsreconType)) {
        return { error: `invalid -t type: "${value}" (allowed: ${DNSRECON_TYPES.join(", ")})` };
      }
      type = value as DnsreconType;
      out.push("-t", value);
      i++;
      continue;
    }
    return { error: `argument not allowed for dnsrecon: "${a}"` };
  }
  return { args: out, type };
}

export function parseDnsreconOutput(stdout: string): DnsRecord[] {
  const records: DnsRecord[] = [];
  const seen = new Set<string>();
  for (const line of stdout.split("\n")) {
    const m = /^\[\*\]\s+Host:\s*(\S+)\s+IP:\s*([0-9a-f:.]+)/i.exec(line.trim());
    if (!m) continue;
    const key = `${m[1]}:${m[2]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    records.push({ host: m[1], ip: m[2] });
  }
  return records;
}

export async function runDnsreconSegment(
  target: string | undefined,
  args: string[],
): Promise<SegmentRunResult> {
  const allowList = getAllowList();
  const bin = resolveBinary("dnsrecon");

  if (!target) {
    return { status: "error", message: "dnsrecon requires a domain target." };
  }
  if (!allowList.contains(target, { publicHostnames: true })) {
    return { status: "blocked", blocked: true, message: `target not allowed: "${target}".` };
  }
  if (!bin) {
    return {
      status: "error",
      available: false,
      message: 'dnsrecon binary not found on this host (install with `pip install --user dnsrecon` or `sudo apt install dnsrecon`).',
    };
  }

  const built = buildDnsreconArgs(args);
  if ("error" in built) return { status: "error", message: built.error, available: true };

  const timeoutMs = Number(process.env.OSINT_RUN_TIMEOUT_MS ?? 30_000);
  const maxOutputBytes = Number(process.env.OSINT_MAX_OUTPUT_BYTES ?? 64_000);
  const started = Date.now();

  const res = await runProcess(bin, ["-d", target, ...built.args, "-t", built.type], {
    timeoutMs,
    maxOutputBytes,
  });
  const durationMs = Date.now() - started;
  const records = parseDnsreconOutput(res.stdout);
  const data: DnsreconData = { domain: target, records };

  return {
    status: res.timedOut ? "error" : "ok",
    message: `${target}: ${records.length} host record(s)${res.timedOut ? " (timed out — partial)" : ""}`,
    durationMs,
    available: true,
    exitCode: res.exitCode,
    timedOut: res.timedOut,
    stdout: res.stdout.slice(0, 16_000),
    data,
  };
}