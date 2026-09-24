import { resolveBinary } from "../binary";
import { runProcess } from "./spawn";
import type { SegmentRunResult } from "./index";

/**
 * python3 segment — safe, fixed version probe.
 *
 * Python is present on nearly every host, so it is wired as a first-class
 * segment — but deliberately locked down: the API never executes arbitrary
 * user code or script paths. Only `--version` / `-V` are forwarded, which lets
 * the workbench confirm the interpreter and surface the version in results.
 */

export interface Python3Data {
  python: string;
}

export function buildPython3Args(
  args: string[],
): { args: string[] } | { error: string } {
  const out: string[] = [];
  if (args.some((a) => a.startsWith("-c"))) {
    return { error: "arbitrary `python3 -c '<code>'` execution is disabled in the portal." };
  }
  for (const a of args) {
    if (a === "--version" || a === "-V") {
      out.push(a);
      continue;
    }
    if (a.startsWith("-")) {
      return { error: `argument not allowed for python3: "${a}"` };
    }
    return { error: `script paths are not accepted by the python3 segment: "${a}"` };
  }
  return { args: out };
}

export function parsePython3Output(stdout: string, stderr: string): Python3Data {
  const raw = `${stdout}${stderr || ""}`.trim();
  const m = /^Python (\d+\.\d+(?:\.\d+)?)(?:\s.*)?$/m.exec(raw);
  return { python: m ? `Python ${m[1]}` : raw || "unknown" };
}

export async function runPython3Segment(
  target: string | undefined,
  args: string[],
): Promise<SegmentRunResult> {
  const bin = resolveBinary("python3");
  if (!bin) {
    return {
      status: "error",
      available: false,
      message: 'python3 not found on this host (install with `sudo apt install python3`).',
    };
  }

  const built = buildPython3Args(args);
  if ("error" in built) return { status: "error", message: built.error, available: true };

  const timeoutMs = Number(process.env.OSINT_RUN_TIMEOUT_MS ?? 10_000);
  const maxOutputBytes = Number(process.env.OSINT_MAX_OUTPUT_BYTES ?? 4_000);
  const started = Date.now();

  const res = await runProcess(bin, built.args.length ? built.args : ["--version"], {
    timeoutMs,
    maxOutputBytes,
  });
  const durationMs = Date.now() - started;
  const data = parsePython3Output(res.stdout, res.stderr);

  return {
    status: "ok",
    message: target ? `python3 ${target}` : `python3 ${data.python} ready on this host`,
    durationMs,
    available: true,
    exitCode: res.exitCode,
    timedOut: res.timedOut,
    stdout: res.stdout.slice(0, 4_000),
    data,
  };
}