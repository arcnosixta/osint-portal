import { getAllowList } from "../security/allowlist";
import { resolveBinary } from "../binary";
import { runProcess } from "./spawn";
import { validateArgs } from "./args";
import type { SegmentRunResult } from "./index";

/**
 * dig segment. Forwards a closed set of query options (+noall/+answer/+short/
 * +trace) and a `-t` value restricted to common record types. Resolver
 * selection (`@server`) is intentionally not forwarded.
 */

export const DIG_TYPES = [
  "A", "AAAA", "MX", "TXT", "NS", "CNAME", "SOA", "ANY", "PTR", "SRV", "CAA",
] as const;

const TYPE_SET = new Set<string>(DIG_TYPES);
const TYPE_PATTERN = new RegExp(`^(?:${DIG_TYPES.join("|")})$`);

export interface DnsRecord {
  name: string;
  ttl?: number;
  type: string;
  value: string;
}

const COMMIT_PATTERN = /^(\S+)\s+(\d+)\s+IN\s+(\S+)\s+(.+?)\s*$/;
const NO_TTL_PATTERN = /^(\S+)\s+IN\s+(\S+)\s+(.+?)\s*$/;

export function parseDigOutput(output: string, short?: boolean): DnsRecord[] {
  const records: DnsRecord[] = [];
  for (const raw of output.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith(";")) continue;

    if (short) {
      records.push({ name: "", type: "value", value: line });
      continue;
    }

    let m = COMMIT_PATTERN.exec(line);
    if (m) {
      records.push({
        name: m[1],
        ttl: Number(m[2]),
        type: m[3],
        value: m[4].trim(),
      });
      continue;
    }
    m = NO_TTL_PATTERN.exec(line);
    if (m) {
      records.push({ name: m[1], type: m[2], value: m[3].trim() });
    }
  }
  return records;
}

export function buildDigArgs(args: string[], type: string | undefined): string[] {
  const out: string[] = [];
  if (args.includes("+short")) out.push("+short");
  if (args.includes("+trace")) out.push("+trace");
  if (args.includes("+answer")) out.push("+answer");
  if (args.includes("+noall")) out.push("+noall");
  if (type) out.push("-t", type);
  return out;
}

export async function runDigSegment(
  target: string | undefined,
  args: string[],
): Promise<SegmentRunResult> {
  const allowList = getAllowList();
  const bin = resolveBinary("dig");

  if (!target) return { message: "dig requires a target (hostname or IP)." };
  if (!allowList.contains(target, { publicHostnames: true })) {
    return {
      message: `target not allowed: "${target}". ${allowList.describe()}`,
      status: "blocked",
      blocked: true,
    };
  }
  if (!bin) {
    return { message: "dig binary not found on this host.", available: false, status: "error" };
  }

  const validated = validateArgs(args, {
    flags: ["+noall", "+answer", "+trace", "+short"],
    values: { "-t": TYPE_PATTERN },
  }, "dig", { "-t": `record type (${DIG_TYPES.join(", ")})` });
  if ("error" in validated) return { message: validated.error, status: "error" };

  const typeValue = (() => {
    const i = validated.args.indexOf("-t");
    if (i >= 0 && TYPE_SET.has(validated.args[i + 1])) return validated.args[i + 1];
    return undefined;
  })();

  const timeoutMs = Number(process.env.OSINT_RUN_TIMEOUT_MS ?? 20_000);
  const maxOutputBytes = Number(process.env.OSINT_MAX_OUTPUT_BYTES ?? 64_000);
  const started = Date.now();

  const digArgs = buildDigArgs(validated.args, typeValue);
  const res = await runProcess(bin, [...digArgs, target], { timeoutMs, maxOutputBytes });
  const records = parseDigOutput(res.stdout, validated.args.includes("+short"));
  const durationMs = Date.now() - started;

  return {
    status: res.timedOut ? "error" : "ok",
    message: `${target}: ${records.length} DNS records (${typeValue ?? "A"})`,
    durationMs,
    available: true,
    exitCode: 0,
    timedOut: res.timedOut,
    data: { host: target, type: typeValue ?? "A", count: records.length, records },
  };
}