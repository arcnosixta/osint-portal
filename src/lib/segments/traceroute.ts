import { getAllowList } from "../security/allowlist";
import { resolveBinary } from "../binary";
import { runProcess } from "./spawn";
import { validateArgs } from "./args";
import type { SegmentRunResult } from "./index";

/**
 * traceroute segment — network path recon.
 *
 * Read-only UDP probes (`-n` keeps reverse-DNS off so the run stays fast),
 * hops parsed into a numbered list with per-hop RTT samples. The target host
 * must pass the allow-list; only probe depth/sample tuning flags are forwarded.
 */

export interface Hop {
  n: number;
  ip: string;
  rtt: string[];
}

export interface TracerouteData {
  host: string;
  ip?: string;
  hops: Hop[];
}

const HOP_LINE_RE = /^\s*(\d+)\s+(.+?)\s*$/;

export function parseTracerouteOutput(output: string): Hop[] {
  const hops: Hop[] = [];
  for (const raw of output.split("\n")) {
    const line = raw.trim();
    if (!line || /^(traceroute to| \[)/.test(line)) continue;
    const m = HOP_LINE_RE.exec(line);
    if (!m) continue;

    const rest = m[2];
    const ipMatch = /^(?:([0-9.]+)|(?:\*))\s*/.exec(rest);
    if (!ipMatch) continue;
    const ip = ipMatch[1] ?? "*";

    const rtt: string[] = [];
    let rm: RegExpExecArray | null;
    const tokenRe = /([0-9]+(?:\.[0-9]+)?) ms|\*\*/g;
    while ((rm = tokenRe.exec(rest)) !== null) {
      rtt.push(rm[0].replace(" ms", ""));
    }
    if (ip === "*" && rtt.length === 0) rtt.push("*");

    hops.push({ n: Number(m[1]), ip, rtt });
  }
  return hops;
}

export async function runTracerouteSegment(
  target: string | undefined,
  args: string[],
): Promise<SegmentRunResult> {
  const allowList = getAllowList();
  const bin = resolveBinary("traceroute");

  if (!target) return { message: "traceroute requires a target (hostname or IP)." };
  if (!allowList.contains(target, { publicHostnames: true })) {
    return {
      message: `target not allowed: "${target}". ${allowList.describe()}`,
      status: "blocked",
      blocked: true,
    };
  }
  if (!bin) {
    return { message: "traceroute binary not found on this host.", available: false, status: "error" };
  }

  const validated = validateArgs(
    args,
    {
      flags: ["-n", "-I"],
      values: {
        "-m": /^(?:[1-9]|[12]\d|30)$/,
        "-w": /^(?:[1-9]|10)$/,
        "-q": /^(?:[1-5])$/,
      },
    },
    "traceroute",
    { "-m": "max hops (1-30)", "-w": "wait seconds (1-10)", "-q": "probes per hop (1-5)" },
  );
  if ("error" in validated) return { message: validated.error, status: "error" };

  const base = ["-n", "-w", "1", "-m", "15"];
  const timeoutMs = Number(process.env.OSINT_RUN_TIMEOUT_MS ?? 20_000);
  const maxOutputBytes = Number(process.env.OSINT_MAX_OUTPUT_BYTES ?? 16_000);
  const started = Date.now();

  const traceArgs = [...base, ...validated.args, target];
  const res = await runProcess(bin, traceArgs, { timeoutMs, maxOutputBytes });
  const hops = parseTracerouteOutput(res.stdout);
  const durationMs = Date.now() - started;

  return {
    status: res.timedOut ? "error" : "ok",
    message: `${target}: ${hops.length} hop(s)${hops.length ? `, ${hops.filter((h) => h.ip !== "*").length} responded` : ""}`,
    durationMs,
    available: true,
    exitCode: 0,
    timedOut: res.timedOut,
    data: { host: target, hops } satisfies TracerouteData,
  };
}