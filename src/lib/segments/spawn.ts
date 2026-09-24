import { spawn } from "node:child_process";

/**
 * Process runner for segments. Never uses a shell, enforces a hard timeout and
 * caps captured output so a noisy tool cannot hang the API or bloat the result.
 */

export interface SpawnResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
}

export interface SpawnOptions {
  timeoutMs: number;
  maxOutputBytes: number;
}

export function runProcess(
  command: string,
  args: string[],
  opts: SpawnOptions,
): Promise<SpawnResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    let stdoutSize = 0;
    let stderrSize = 0;
    let timedOut = false;
    let settled = false;
    const cap = opts.maxOutputBytes;

    const onStdout = (chunk: Buffer) => {
      if (stdoutSize >= cap) return;
      const slice = chunk.subarray(0, cap - stdoutSize);
      stdout += slice.toString("utf8");
      stdoutSize += slice.length;
    };

    const onStderr = (chunk: Buffer) => {
      if (stderrSize >= cap) return;
      const slice = chunk.subarray(0, cap - stderrSize);
      stderr += slice.toString("utf8");
      stderrSize += slice.length;
    };

    child.stdout?.on("data", onStdout);
    child.stderr?.on("data", onStderr);

    const finish = (res: SpawnResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(res);
    };

    const timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill("SIGKILL");
      } catch {
        /* already exited */
      }
    }, opts.timeoutMs);
    timer.unref();

    child.on("error", (err) => {
      finish({ stdout, stderr: stderr || String(err), exitCode: null, timedOut });
    });

    child.on("exit", (code) => {
      finish({ stdout, stderr, exitCode: code, timedOut });
    });
  });
}