import { getAllowList } from "../security/allowlist";
import { resolveBinary } from "../binary";
import { runProcess } from "./spawn";
import { validateArgs } from "./args";
import type { SegmentRunResult } from "./index";

/**
 * whois segment. Forwards only `-H` (hide legal disclaimers) and extracts the
 * key registrar fields from the free-text response. Note: whois is often NOT
 * installed (needs `apt install whois`) — the segment degrades gracefully.
 */

export interface WhoisResult {
  domain?: string;
  registrar?: string;
  creationDate?: string;
  expiryDate?: string;
  updatedDate?: string;
  nameServers: string[];
  raw: string;
}

const FIELD_RE = /^([A-Za-z0-9][A-Za-z0-9 ._-]*?):\s*(.*)$/;

export function parseWhoisLabel(label: string): string {
  return label
    .trim()
    .replace(/^"(.*)"$/, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function parseWhoisOutput(output: string): WhoisResult {
  const result: WhoisResult = { nameServers: [], raw: output };
  const servers = new Set<string>();
  let section = "";

  for (const line of output.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("%") || trimmed.startsWith("#")) continue;

    const m = FIELD_RE.exec(trimmed);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (!value) continue;

    if (key === "whois server") {
      section = value;
      continue;
    }

    switch (key) {
      case "domain name":
        if (!result.domain) result.domain = value;
        break;
      case "registrar":
        if (!result.registrar) result.registrar = parseWhoisLabel(value);
        break;
      case "creation date":
        if (!result.creationDate) result.creationDate = value;
        break;
      case "registry expiry date":
      case "expiration date":
        if (!result.expiryDate) result.expiryDate = value;
        break;
      case "updated date":
        if (!result.updatedDate) result.updatedDate = value;
        break;
      case "name server":
        servers.add(parseWhoisLabel(value));
        break;
      default:
        break;
    }
  }

  if (!result.domain && section) result.domain = section;
  result.nameServers = [...servers];
  return result;
}

export async function runWhoisSegment(
  target: string | undefined,
  args: string[],
): Promise<SegmentRunResult> {
  const allowList = getAllowList();
  const bin = resolveBinary("whois");

  if (!target) return { message: "whois requires a target (domain or IP)." };
  if (!allowList.contains(target, { publicHostnames: true })) {
    return {
      message: `target not allowed: "${target}". ${allowList.describe()}`,
      status: "blocked",
      blocked: true,
    };
  }
  if (!bin) {
    return {
      message:
        'whois binary not found on this host (install with `sudo apt install whois`). The segment is wired and will run once available.',
      available: false,
      status: "error",
    };
  }

  const validated = validateArgs(args, {
    flags: ["-H"],
  }, "whois");
  if ("error" in validated) return { message: validated.error, status: "error" };

  const timeoutMs = Number(process.env.OSINT_RUN_TIMEOUT_MS ?? 20_000);
  const maxOutputBytes = Number(process.env.OSINT_MAX_OUTPUT_BYTES ?? 64_000);
  const started = Date.now();

  const res = await runProcess(bin, [...validated.args, target], { timeoutMs, maxOutputBytes });
  const parsed = parseWhoisOutput(res.stdout);
  const durationMs = Date.now() - started;

  return {
    status: res.timedOut ? "error" : "ok",
    message: `${target}: ${parsed.domain ?? "unknown"} — created ${parsed.creationDate ?? "?"}, ${parsed.nameServers.length} name servers`,
    durationMs,
    available: true,
    exitCode: 0,
    timedOut: res.timedOut,
    data: { ...parsed, raw: parsed.raw.slice(0, 4096) },
  };
}