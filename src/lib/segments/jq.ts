import { randomUUID } from "node:crypto";
import { existsSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { getAllowList } from "../security/allowlist";
import { resolveBinary } from "../binary";
import { runProcess } from "./spawn";
import { validateArgs } from "./args";
import type { SegmentRunResult } from "./index";

/**
 * jq segment — slice/filter JSON fetched from an allow-listed URL.
 *
 * Fetch happens through the system `curl` into a temp file (read-only,
 * bounded by --max-filesize), then `jq -r` runs the operator's filter on it.
 * Filters that start with `-` or use shell metacharacters like `|`, `(`, `{`
 * are rejected by the shared executor/validator so the portal stays out of
 * arbitrary-code territory.
 */

const URL_RE =
  /^https?:\/\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*(?::\d{1,5})?(?:\/[^\s]*)?$/i;
const HOST_RE = /^https?:\/\/([^/:]+)/i;
const FILTER_RE = /^[^\-].*$/;

export function pickFilter(positionals: string[]): string {
  const raw = positionals[0];
  return raw && raw.trim() ? raw.trim() : ".";
}

export async function runJqSegment(
  target: string | undefined,
  args: string[],
): Promise<SegmentRunResult> {
  const allowList = getAllowList();
  const curlBin = resolveBinary("curl");
  const jqBin = resolveBinary("jq");

  if (!target) {
    return { message: "jq requires an http(s) URL to fetch, e.g. \"https://api.exmaple.org/v1/status\"." };
  }
  const trimmed = target.trim();
  if (!URL_RE.test(trimmed)) {
    return { message: 'jq target must be an http(s) URL, e.g. "http://127.0.0.1:3000/api/data".', status: "error" };
  }
  const host = HOST_RE.exec(trimmed)?.[1];
  if (!host || !allowList.contains(host, { publicHostnames: true })) {
    return {
      message: `target not allowed: "${host}". Raw public IPs are gated; use a hostname inside the allow-list.`,
      status: "blocked",
      blocked: true,
    };
  }
  if (!curlBin) {
    return { message: "curl binary not found (needed to fetch the URL).", available: false, status: "error" };
  }
  if (!jqBin) {
    return { message: "jq binary not found on this host.", available: false, status: "error" };
  }

  const validated = validateArgs(args, { positional: FILTER_RE, maxPositional: 1 }, "jq");
  if ("error" in validated) return { message: validated.error, status: "error" };
  const filter = pickFilter(validated.positionals);

  const timeoutMs = Number(process.env.OSINT_RUN_TIMEOUT_MS ?? 20_000);
  const maxOutputBytes = Number(process.env.OSINT_MAX_OUTPUT_BYTES ?? 64_000);
  const started = Date.now();
  const tmp = join(tmpdir(), `osint-jq-${randomUUID()}.json`);

  let fetchOk = false;
  let fetchExit = 0;
  try {
    const fetch = await runProcess(
      curlBin,
      ["-s", "-L", "--max-redirs", "5", "--connect-timeout", "10", "--max-filesize", "5242880", "-o", tmp, trimmed],
      { timeoutMs, maxOutputBytes },
    );
    fetchExit = fetch.exitCode ?? -1;
    fetchOk = fetch.exitCode === 0 && existsSync(tmp) && statSync(tmp).size > 0;

    if (!fetchOk) {
      const reason = fetch.stderr.trim().split("\n")[0] || `curl exited ${fetchExit}`;
      return {
        status: "error",
        message: `${trimmed} — fetch failed: ${reason}`,
        durationMs: Date.now() - started,
        exitCode: fetchExit,
        timedOut: fetch.timedOut,
        available: true,
      };
    }

    const jq = await runProcess(jqBin, ["-r", filter, tmp], { timeoutMs, maxOutputBytes });
    const durationMs = Date.now() - started;

    if (jq.exitCode !== 0) {
      const err = jq.stderr.trim().split("\n")[0] || `jq exited ${jq.exitCode}`;
      return {
        status: "error",
        message: `${trimmed} — jq: ${err}`,
        durationMs,
        exitCode: jq.exitCode,
        timedOut: jq.timedOut,
        stdout: jq.stderr.slice(0, 16_000),
        available: true,
      };
    }

    const lines = jq.stdout.split("\n").filter((l) => l.length > 0).length;
    return {
      status: "ok",
      message: `${trimmed} |> ${filter} · ${jq.stdout.trim().split("\n").length} line(s)`,
      durationMs,
      available: true,
      exitCode: 0,
      timedOut: jq.timedOut,
      stdout: jq.stdout.slice(0, 16_000),
      data: { url: trimmed, host, filter, output: jq.stdout.slice(0, 16_000), lines },
    };
  } finally {
    try {
      rmSync(tmp, { force: true });
    } catch {
      /* ignore */
    }
  }
}