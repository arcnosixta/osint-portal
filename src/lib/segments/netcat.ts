import { getAllowList } from "../security/allowlist";
import { resolveBinary } from "../binary";
import { runProcess } from "./spawn";
import { validateArgs } from "./args";
import type { SegmentRunResult } from "./index";

/**
 * netcat segment. On modern distros `nc`/`netcat` is Nmap's Ncat, which
 * accepts a single port per invocation — so the segment scans the requested
 * ports one spawn at a time, still bounded by one overall deadline.
 *
 * Safety: only `-z` zero-I/O probing flags are forwarded; executables
 * (`-e`, `-c`), listeners (`-l`) and proxies are rejected by the contract.
 */

export type NetcatState = "open" | "closed" | "filtered" | "error";

export interface NetcatResult {
  host?: string;
  ports: { port: number; state: NetcatState; detail: string }[];
  tested: number;
  skipped: number;
}

const PORT_LIST_PATTERN = /^(?:[1-9]\d{0,4})(?:,[1-9]\d{0,4}){0,24}$/;
const WAIT_PATTERN = /^(?:[1-9]|[12]\d|30)$/;
const MAX_PORTS = 25;
const DEFAULT_WAIT_S = 2;
const DEFAULT_SCAN_TIMEOUT_MS = 15_000;

const NC_FLAGS = ["-z", "-4", "-6", "-n", "-v", "-vv"];

export function parseNetcatPortList(spec: string): number[] | null {
  if (!PORT_LIST_PATTERN.test(spec)) return null;
  const ports = spec.split(",").map(Number);
  if (ports.length > MAX_PORTS) return null;
  if (ports.some((p) => p < 1 || p > 65535)) return null;
  return ports;
}

export function classifyNetcatOutput(output: string): CheckResult {
  if (/Connected to .+:\d+\./.test(output)) return { state: "open", detail: "connected" };
  if (/Connection refused/.test(output)) return { state: "closed", detail: "connection refused" };
  if (/timed out|Connection timed out|No route to host|Network is unreachable/.test(output)) {
    return { state: "filtered", detail: "no response" };
  }
  if (/unknown host|Name or service not known|couldn't connect/.test(output)) {
    return { state: "error", detail: "unresolvable" };
  }
  return { state: "error", detail: "no status" };
}

interface CheckResult {
  state: NetcatState;
  detail: string;
}

export async function runNetcatSegment(
  target: string | undefined,
  args: string[],
): Promise<SegmentRunResult> {
  const allowList = getAllowList();
  const bin = resolveBinary("netcat");

  if (!target) {
    return { message: "netcat requires a target (hostname or IP)." };
  }
  if (!allowList.contains(target)) {
    return {
      message: `target not allowed: "${target}". ${allowList.describe()}`,
      status: "blocked",
      blocked: true,
    };
  }
  if (!bin) {
    return { message: "netcat binary not found on this host.", available: false, status: "error" };
  }

  const validated = validateArgs(args, {
    flags: NC_FLAGS,
    values: { "-w": WAIT_PATTERN },
    positional: PORT_LIST_PATTERN,
    maxPositional: 1,
  }, "netcat", { "-w": "wait seconds" });
  if ("error" in validated) return { message: validated.error, status: "error" };

  const argsOut = validated.args;
  if (!argsOut.includes("-w")) argsOut.unshift(...["-w", String(DEFAULT_WAIT_S)]);

  const spec = validated.positionals[0];
  if (!spec) {
    return {
      message: 'netcat requires a port list — ncat accepts single ports only, e.g. "80,443". Use nmap for ranges.',
      status: "error",
    };
  }
  const ports = parseNetcatPortList(spec);
  if (!ports) return { message: `invalid port list: "${spec}"`, status: "error" };

  const waitS = (() => {
    const i = argsOut.indexOf("-w");
    return i >= 0 ? Number(argsOut[i + 1]) : DEFAULT_WAIT_S;
  })();

  const scanDeadline = Number(process.env.OSINT_RUN_TIMEOUT_MS ?? DEFAULT_SCAN_TIMEOUT_MS);
  const maxOutputBytes = Number(process.env.OSINT_MAX_OUTPUT_BYTES ?? 32_000);
  const started = Date.now();
  const result: NetcatResult = { host: target, ports: [], tested: 0, skipped: 0 };

  for (const port of ports) {
    if (Date.now() - started >= scanDeadline) {
      result.skipped = ports.length - result.ports.length;
      break;
    }
    const childArgs = ["-z", "-v"];
    if (argsOut.includes("-4")) childArgs.push("-4");
    if (argsOut.includes("-6")) childArgs.push("-6");
    if (argsOut.includes("-n")) childArgs.push("-n");
    childArgs.push("-w", String(waitS));
    childArgs.push(target, String(port));

    const res = await runProcess(bin, childArgs, {
      timeoutMs: waitS * 1000 + 2500,
      maxOutputBytes,
    });
    const check = classifyNetcatOutput(res.stdout + "\n" + res.stderr);
    result.ports.push({ port, state: check.state, detail: check.detail });
  }
  result.tested = result.ports.length;

  const open = result.ports.filter((p) => p.state === "open");
  const durationMs = Date.now() - started;
  const openList = open.map((p) => p.port).join(", ");

  return {
    status: "ok",
    message: `scan complete: ${target} — ${open.length} open (${openList || "none"}), ${result.tested - open.length} closed/filtered tested`,
    durationMs,
    available: true,
    exitCode: 0,
    data: result,
  };
}