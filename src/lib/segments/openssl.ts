import { randomUUID } from "node:crypto";
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { getAllowList } from "../security/allowlist";
import { resolveBinary } from "../binary";
import { runProcess } from "./spawn";
import { validateArgs } from "./args";
import type { SegmentRunResult } from "./index";

/**
 * openssl segment — TLS certificate recon.
 *
 * Two read-only stages: `s_client` performs the handshake and emits the PEM
 * block, then `x509 -noout` prints a compact snapshot (subject, issuer, dates,
 * SAN, SHA-256 fingerprint). Target is `host` or `host:port`; SNI is only set
 * for hostnames. No data is written or exfiltrated — the PEM goes to a temp
 * file that is deleted before returning.
 */

export interface OpensslData {
  host: string;
  port: number;
  connected: boolean;
  protocol?: string;
  cipher?: string;
  verify?: string;
  subject?: string;
  issuer?: string;
  serial?: string;
  notBefore?: string;
  notAfter?: string;
  san?: string[];
  fingerprint?: string;
}

const HOST_PORT_RE = /^([^:/\[\]]+)(?::(\d{1,5}))?$/;

export function parseTarget(target: string): { host: string; port: number } | { error: string } {
  const trimmed = target.trim();
  if (/[\[\]]/.test(trimmed) || trimmed.includes("::")) {
    return { error: "IPv6 literals are not supported yet — use a hostname or IPv4." };
  }
  const m = HOST_PORT_RE.exec(trimmed);
  if (!m) return { error: `invalid target: "${trimmed}". Use host or host:port.` };
  const host = m[1];
  const port = m[2] ? Number(m[2]) : 443;
  if (port < 1 || port > 65535) return { error: `invalid port: "${m[2]}"` };
  return { host, port };
}

export function extractPem(output: string): string | null {
  const start = output.indexOf("-----BEGIN CERTIFICATE-----");
  if (start < 0) return null;
  const end = output.indexOf("-----END CERTIFICATE-----", start);
  if (end < 0) return null;
  return output.slice(start, end + "-----END CERTIFICATE-----".length);
}

export function parseHandshake(output: string): {
  protocol?: string;
  cipher?: string;
  verify?: string;
} {
  const result: { protocol?: string; cipher?: string; verify?: string } = {};
  const newLine = /^New,\s*([A-Za-z0-9.]+),\s*Cipher is\s+(.+)$/m.exec(output);
  if (newLine) {
    result.protocol = newLine[1];
    result.cipher = newLine[2].trim();
  }
  const protocol = /(?:^|\n)Protocol\s*:\s*(.+?)\s*(\n|$)/.exec(output);
  if (protocol && !result.protocol) result.protocol = protocol[1].trim();
  const cipher = /(?:^|\n)Cipher\s*:\s*(.+?)\s*(\n|$)/.exec(output);
  if (cipher && !result.cipher) result.cipher = cipher[1].trim();
  const verify = /Verify return code:\s*(\d+)(?:\s+\(([^)]+)\))?/.exec(output);
  if (verify) result.verify = verify[2] ?? verify[1];
  return result;
}

export function parseX509Output(output: string, sanOutput: string): Partial<OpensslData> {
  const entries: [keyof OpensslData, string][] = [
    ["subject", "subject"],
    ["issuer", "issuer"],
    ["serial", "serial"],
    ["notBefore", "notBefore"],
    ["notAfter", "notAfter"],
    ["fingerprint", "sha256 Fingerprint"],
  ];
  const out: Record<string, string> = {};
  for (const [key, label] of entries) {
    const m = new RegExp(`^${label}=(.+)$`, "m").exec(output);
    if (m) out[key] = m[1].trim();
  }
  const sanMatch = /X509v3 Subject Alternative Name:\s*\n\s*(.+?)\s*(\n|$)/.exec(sanOutput);
  if (sanMatch) {
    out.san = sanMatch[1]
      .split(/,\s*/)
      .map((s) => s.trim())
      .filter(Boolean)
      .join("\u0000");
  }
  const result: Partial<OpensslData> = {};
  for (const key of Object.keys(out)) {
    if (key === "san") {
      result.san = out.san!.split("\u0000");
    } else {
      (result as unknown as Record<string, string>)[key] = out[key];
    }
  }
  return result;
}

export async function runOpensslSegment(
  target: string | undefined,
  args: string[],
): Promise<SegmentRunResult> {
  const allowList = getAllowList();
  const bin = resolveBinary("openssl");

  if (!target) return { message: "openssl requires a target: host or host:port." };

  const parsed = parseTarget(target);
  if ("error" in parsed) return { message: parsed.error, status: "error" };
  const { host, port } = parsed as { host: string; port: number };

  if (!allowList.contains(host, { publicHostnames: true })) {
    return {
      message: `target not allowed: "${host}". ${allowList.describe()}`,
      status: "blocked",
      blocked: true,
    };
  }
  if (!bin) {
    return { message: "openssl binary not found on this host.", available: false, status: "error" };
  }

  const validated = validateArgs(
    args,
    { flags: ["-tls1_3", "-tls1_2"] },
    "openssl",
  );
  if ("error" in validated) return { message: validated.error, status: "error" };

  const timeoutMs = Number(process.env.OSINT_RUN_TIMEOUT_MS ?? 20_000);
  const maxOutputBytes = Number(process.env.OSINT_MAX_OUTPUT_BYTES ?? 64_000);
  const started = Date.now();

  const isHostname = !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host);
  const handshakeArgs = ["s_client", "-connect", `${host}:${port}`, "-showcerts", ...validated.args];
  if (isHostname) handshakeArgs.push("-servername", host);

  const hs = await runProcess(bin, handshakeArgs, { timeoutMs, maxOutputBytes });

  const data: OpensslData = {
    host,
    port,
    connected: false,
    ...parseHandshake(hs.stdout),
  };

  const pem = extractPem(hs.stdout);
  if (!pem) {
    return {
      status: hs.exitCode === 0 ? "error" : "error",
      message: `${host}:${port} — no certificate in handshake${hs.stderr.trim() ? ` (${hs.stderr.trim().split("\n")[0]})` : ""}`,
      durationMs: Date.now() - started,
      stdout: hs.stdout.slice(0, 16_000),
      exitCode: hs.exitCode,
      timedOut: hs.timedOut,
      available: true,
      data,
    };
  }

  const tmp = join(tmpdir(), `osint-ssl-${randomUUID()}.pem`);
  let raw = "";
  try {
    writeFileSync(tmp, pem);
    const x509 = await runProcess(
      bin,
      ["x509", "-in", tmp, "-noout", "-subject", "-issuer", "-serial", "-dates",
        "-fingerprint", "-sha256", "-ext", "subjectAltName"],
      { timeoutMs, maxOutputBytes },
    );
    raw = x509.stdout;
  } finally {
    try {
      rmSync(tmp, { force: true });
    } catch {
      /* ignore */
    }
  }

  Object.assign(data, parseX509Output(raw, raw));
  data.connected = Boolean(data.subject);
  const durationMs = Date.now() - started;

  return {
    status: data.connected ? "ok" : "error",
    message: `${host}:${port} — TLS ${data.protocol ?? "?"}, cert ${data.subject ?? "unknown"}`,
    durationMs,
    available: true,
    exitCode: hs.exitCode,
    timedOut: hs.timedOut,
    stdout: hs.stdout.slice(0, 16_000),
    data,
  };
}