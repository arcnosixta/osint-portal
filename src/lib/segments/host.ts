import { getAllowList } from "../security/allowlist";
import { resolveBinary } from "../binary";
import { runProcess } from "./spawn";
import { validateArgs } from "./args";
import type { SegmentRunResult } from "./index";

/**
 * host segment. Forwards `-a` (everything) or a restricted `-t TYPE`, and
 * parses the human records back into typed rows.
 */

export const HOST_TYPES = [
  "A", "AAAA", "MX", "TXT", "NS", "CNAME", "SOA", "ANY", "PTR", "SRV",
] as const;

const TYPE_PATTERN = new RegExp(`^(?:${HOST_TYPES.join("|")})$`);

export interface HostRecord {
  type: string;
  value: string;
  preference?: number;
  target?: string;
}

const A_RE = /^(\S+)\s+has address\s+(\S+)$/;
const AAAA_RE = /^(\S+)\s+has IPv6 address\s+(\S+)$/;
const MX_RE = /^(\S+)\s+mail is handled by\s+(\d+)\s+(\S+)$/;
const NS_RE = /^(\S+)\s+name server\s+(\S+)$/;
const TXT_RE = /^(\S+)\s+has TXT record\s+(.+)$/;
const CNAME_RE = /^(\S+)\s+is an alias for\s+(\S+)$/;

export function parseHostOutput(output: string): HostRecord[] {
  const records: HostRecord[] = [];
  for (const raw of output.split("\n")) {
    const line = raw.trim();
    if (!line) continue;

    let m = A_RE.exec(line);
    if (m) {
      records.push({ type: "A", value: m[2], target: m[1] });
      continue;
    }
    m = AAAA_RE.exec(line);
    if (m) {
      records.push({ type: "AAAA", value: m[2], target: m[1] });
      continue;
    }
    m = MX_RE.exec(line);
    if (m) {
      records.push({ type: "MX", value: m[3], preference: Number(m[2]), target: m[1] });
      continue;
    }
    m = NS_RE.exec(line);
    if (m) {
      records.push({ type: "NS", value: m[2], target: m[1] });
      continue;
    }
    m = TXT_RE.exec(line);
    if (m) {
      records.push({ type: "TXT", value: m[2], target: m[1] });
      continue;
    }
    m = CNAME_RE.exec(line);
    if (m) {
      records.push({ type: "CNAME", value: m[2], target: m[1] });
    }
  }
  return records;
}

export async function runHostSegment(
  target: string | undefined,
  args: string[],
): Promise<SegmentRunResult> {
  const allowList = getAllowList();
  const bin = resolveBinary("host");

  if (!target) return { message: "host requires a target (hostname or IP)." };
  if (!allowList.contains(target, { publicHostnames: true })) {
    return {
      message: `target not allowed: "${target}". ${allowList.describe()}`,
      status: "blocked",
      blocked: true,
    };
  }
  if (!bin) {
    return { message: "host binary not found on this host.", available: false, status: "error" };
  }

  const validated = validateArgs(args, {
    flags: ["-a", "-v", "-d"],
    values: { "-t": TYPE_PATTERN },
  }, "host", { "-t": "record type" });
  if ("error" in validated) return { message: validated.error, status: "error" };

  const timeoutMs = Number(process.env.OSINT_RUN_TIMEOUT_MS ?? 20_000);
  const maxOutputBytes = Number(process.env.OSINT_MAX_OUTPUT_BYTES ?? 64_000);
  const started = Date.now();

  const res = await runProcess(bin, [...validated.args, target], { timeoutMs, maxOutputBytes });
  const records = parseHostOutput(res.stdout);
  const durationMs = Date.now() - started;
  const types = [...new Set(records.map((r) => r.type))];

  return {
    status: res.timedOut ? "error" : "ok",
    message: `${target}: ${records.length} records (${types.join(", ") || "none"})`,
    durationMs,
    available: true,
    exitCode: 0,
    timedOut: res.timedOut,
    data: { host: target, count: records.length, records },
  };
}