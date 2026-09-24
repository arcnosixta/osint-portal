import { getAllowList } from "../security/allowlist";
import { resolveBinary } from "../binary";
import { runProcess } from "./spawn";
import { validateArgs } from "./args";
import type { SegmentRunResult } from "./index";

/**
 * curl segment — read-only HTTP(S) probe.
 *
 * Only quiet/header modes are forwarded (`-s`, `-I`, `-L`) with `-o /dev/null`
 * and numeric limits (`--max-redirs`, `--connect-timeout`). Requests never
 * carry a body. The URL is treated as the target; its hostname must pass the
 * read-only allow-list (publicHostnames), while raw public IPs stay gated so
 * the portal never becomes an open SSRF/scanner relay.
 */

const URL_RE =
  /^https?:\/\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*(?::\d{1,5})?(?:\/[^\s]*)?$/i;
const HOST_RE = /^https?:\/\/([^/:]+)/i;
const MAX_REDIRS_PATTERN = /^\d{1,2}$/;
const TIMEOUT_SEC_PATTERN = /^\d{1,3}$/;

export interface CurlHeader {
  name: string;
  value: string;
}

export interface CurlData {
  url: string;
  host?: string;
  statusLine: string;
  statusCode: number | null;
  headers: CurlHeader[];
}

export function parseCurlHeaders(output: string): { statusLine: string; headers: CurlHeader[] } {
  const headers: CurlHeader[] = [];
  let statusLine = "";

  for (const raw of output.split("\n")) {
    const line = raw.replace(/\r$/, "");
    if (/^HTTP\/\d/.test(line)) {
      statusLine = line;
      headers.length = 0;
      continue;
    }
    const m = /^([^:\s]+):\s*(.*)$/.exec(line);
    if (m && m[1].toLowerCase() !== "set-cookie") {
      headers.push({ name: m[1], value: m[2].trim() });
    }
  }

  return { statusLine, headers };
}

export function extractStatusCode(statusLine: string): number | null {
  const m = /\b(\d{3})\b/.exec(statusLine);
  return m ? Number(m[1]) : null;
}

export async function runCurlSegment(
  target: string | undefined,
  args: string[],
): Promise<SegmentRunResult> {
  const allowList = getAllowList();
  const bin = resolveBinary("curl");

  if (!target) return { message: "curl requires an http(s) URL target." };

  const trimmed = target.trim();
  if (!URL_RE.test(trimmed)) {
    return {
      message: 'curl target must be an http(s) URL, e.g. "http://127.0.0.1:3000".',
      status: "error",
    };
  }

  const host = HOST_RE.exec(trimmed)?.[1];
  if (!host || !allowList.contains(host, { publicHostnames: true })) {
    return {
      message: `target not allowed: "${host}". Raw public IPs are gated; use a hostname inside the allow-list.`,
      status: "blocked",
      blocked: true,
    };
  }
  if (!bin) {
    return { message: "curl binary not found on this host.", available: false, status: "error" };
  }

  const validated = validateArgs(
    args,
    {
      flags: ["-s", "-I", "-L"],
      values: {
        "-o": /^\/dev\/null$/,
        "--max-redirs": MAX_REDIRS_PATTERN,
        "--connect-timeout": TIMEOUT_SEC_PATTERN,
      },
    },
    "curl",
    { "-o": "output path", "--max-redirs": "redirect count", "--connect-timeout": "timeout seconds" },
  );
  if ("error" in validated) return { message: validated.error, status: "error" };

  const timeoutMs = Number(process.env.OSINT_RUN_TIMEOUT_MS ?? 20_000);
  const maxOutputBytes = Number(process.env.OSINT_MAX_OUTPUT_BYTES ?? 64_000);
  const started = Date.now();

  const safeArgs = ["-s", "-D", "-", "-I", "-L", "-o", "/dev/null", "--max-redirs", "5"];
  const res = await runProcess(bin, [...safeArgs, ...validated.args, trimmed], {
    timeoutMs,
    maxOutputBytes,
  });
  const durationMs = Date.now() - started;
  const { statusLine, headers } = parseCurlHeaders(res.stdout);

  const data: CurlData = {
    url: trimmed,
    host,
    statusLine,
    statusCode: extractStatusCode(statusLine),
    headers,
  };

  const summary = statusLine || res.stderr.trim() || "(no response)";
  return {
    status: res.timedOut ? "error" : "ok",
    message: `${trimmed} → ${summary} · ${headers.length} header(s)`,
    durationMs,
    available: true,
    exitCode: 0,
    timedOut: res.timedOut,
    stdout: res.stdout.slice(0, 16_000),
    data,
  };
}