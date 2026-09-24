import { getAllowList } from "../security/allowlist";
import { resolveBinary } from "../binary";
import { runProcess } from "./spawn";
import type { SegmentRunResult } from "./index";

/**
 * masscan segment — line-speed port scanning over big ranges.
 *
 * Read-only SYN/UDP probing, gated by the target allow-list. File outputs and
 * scanning from an input list are rejected; only rate/port/scan-type flags are
 * forwarded. Results parsed from "Discovered open port" lines.
 */

export interface MasscanPort {
  port: number;
  protocol: "tcp" | "udp";
  ip?: string;
}

export interface MasscanData {
  host?: string;
  ports: MasscanPort[];
  scanned?: string;
}

const PORTS_PATTERN = /^\d{1,5}(-\d{1,5})?(,\d{1,5}(-\d{1,5})?)*$/;
const RATE_PATTERN = /^(?:[1-9]\d{0,5}|1000000)$/;
const TOP_PORTS_PATTERN = /^\d{1,5}$/;

export function buildMasscanArgs(args: string[]): { args: string[] } | { error: string } {
  const out: string[] = [];
  const FLAGS = new Set(["-sS", "-sU", "-v", "--open"]);
  const VALUE_FLAGS = new Set(["-p", "--rate", "--top-ports"]);
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (FLAGS.has(a)) {
      out.push(a);
      continue;
    }
    if (VALUE_FLAGS.has(a)) {
      const value = args[i + 1];
      if (value === undefined) return { error: `argument "${a}" requires a value` };
      if (a === "-p") {
        if (value !== "-" && !PORTS_PATTERN.test(value)) return { error: `invalid port spec: "${value}"` };
      } else if (a === "--rate") {
        if (!RATE_PATTERN.test(value)) return { error: `invalid --rate value: "${value}"` };
      } else if (!TOP_PORTS_PATTERN.test(value)) {
        return { error: `invalid --top-ports value: "${value}"` };
      }
      out.push(a, value);
      i++;
      continue;
    }
    return { error: `argument not allowed for masscan: "${a}"` };
  }
  return { args: out };
}

export function parseMasscanOutput(stdout: string, target: string): MasscanData {
  const data: MasscanData = { host: target, ports: [] };
  const seen = new Set<string>();
  for (const line of stdout.split("\n")) {
    const m = /^Discovered open port (\d+)\/(tcp|udp)\s+on\s+(\S+)/i.exec(line.trim());
    if (!m) continue;
    const key = `${m[3]}:${m[1]}/${m[2]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    data.ports.push({ port: Number(m[1]), protocol: m[2] as MasscanPort["protocol"], ip: m[3] });
  }
  return data;
}

export async function runMasscanSegment(
  target: string | undefined,
  args: string[],
): Promise<SegmentRunResult> {
  const allowList = getAllowList();
  const bin = resolveBinary("masscan");

  if (!target) return { status: "error", message: "masscan requires a target (IP, CIDR or hostname)." };
  if (!allowList.contains(target)) {
    return {
      status: "blocked",
      blocked: true,
      message: `target not allowed: "${target}". ${allowList.describe()}`,
      available: bin !== null,
    };
  }
  if (!bin) {
    return {
      status: "error",
      available: false,
      message: 'masscan binary not found on this host (install with `sudo apt install masscan`). The segment is wired and will run once available.',
    };
  }

  const built = buildMasscanArgs(args);
  if ("error" in built) return { status: "error", message: built.error, available: true };

  const timeoutMs = Number(process.env.OSINT_RUN_TIMEOUT_MS ?? 20_000);
  const maxOutputBytes = Number(process.env.OSINT_MAX_OUTPUT_BYTES ?? 64_000);
  const started = Date.now();

  const base = ["-sS", "-p", "1-1024", "--rate", "500", "--open"];
  const res = await runProcess(bin, [...base, ...built.args, target], { timeoutMs, maxOutputBytes });
  const durationMs = Date.now() - started;
  const data = parseMasscanOutput(res.stdout, target);

  return {
    status: res.timedOut ? "error" : "ok",
    message: `${target}: ${data.ports.length} open port(s)${res.timedOut ? " (scan timed out — partial)" : ""}`,
    durationMs,
    available: true,
    exitCode: res.exitCode,
    timedOut: res.timedOut,
    stdout: res.stdout.slice(0, 16_000),
    data,
  };
}