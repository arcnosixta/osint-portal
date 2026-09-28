import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { runTool } from "../src/lib/executor";
import { setEvidenceBackend, listEvidence, clearEvidence, evidenceCount, evidenceSource } from "../src/lib/evidence";
import { buildGraph } from "../src/lib/graph";
import { detectLocalToolStatus, isBinaryAvailable } from "../src/lib/binary";
import { TOOLS } from "../src/lib/tools";
import { createFileBackend, defaultCaseFile } from "./store";

/**
 * Local tool runner.
 *
 * The site is deployed to the internet, the OSINT binaries live on the operator's
 * machine — so the browser talks to this process over loopback instead of the
 * site proxying tool execution. That is the only arrangement that works: a
 * Vercel function has no route to 127.0.0.1 on your PC.
 *
 * Consequences worth knowing:
 *   - the socket is bound to 127.0.0.1, so nothing off this machine can reach it;
 *   - a third-party web page could still try, hence the Origin allow-list below;
 *   - evidence is persisted to disk, so the case file and graph survive restarts.
 */

const HOST = "127.0.0.1";
const PORT = Number(process.env.RUNNER_PORT ?? 8787);
const TOOL_ID_RE = /^[a-z0-9-_.]+$/i;
const MAX_BODY = 64 * 1024;

setEvidenceBackend(createFileBackend(defaultCaseFile()));

const extraOrigins = (process.env.RUNNER_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function originAllowed(origin: string): boolean {
  if (extraOrigins.includes(origin)) return true;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin)) return true;
  return false;
}

function corsOrigin(req: IncomingMessage): string | null {
  const origin = req.headers.origin;
  if (typeof origin !== "string" || !origin) return null;
  return originAllowed(origin) ? origin : null;
}

function send(res: ServerResponse, status: number, payload: unknown, origin: string | null): void {
  const headers: Record<string, string> = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  };
  if (origin) {
    headers["access-control-allow-origin"] = origin;
    headers.vary = "origin";
  }
  res.writeHead(status, headers);
  res.end(JSON.stringify(payload));
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY) return null;
    chunks.push(chunk as Buffer);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return {};
  }
}

function catalog() {
  const localStatus = detectLocalToolStatus();
  const items = TOOLS.map((tool) => ({
    id: tool.id,
    name: tool.name,
    category: tool.category,
    command: tool.command,
    status: tool.status,
    local: tool.local ?? false,
    available: tool.local ? (localStatus[tool.id] ?? false) : null,
    binary: tool.local ? isBinaryAvailable(tool.name.toLowerCase()) : null,
  }));
  return { ok: true, count: items.length, localCount: items.filter((i) => i.available).length, tools: items };
}

const server = createServer(async (req, res) => {
  const origin = corsOrigin(req);
  const url = new URL(req.url ?? "/", `http://${HOST}:${PORT}`);
  const path = url.pathname.replace(/\/+$/, "") || "/";

  if (origin === null && typeof req.headers.origin === "string") {
    send(res, 403, { ok: false, message: "origin not allowed" }, null);
    return;
  }

  if (req.method === "OPTIONS") {
    const headers: Record<string, string> = {
      "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
      "access-control-allow-headers": "content-type",
      "access-control-max-age": "600",
      vary: "origin, access-control-request-private-network",
    };
    // The deployed site is a public HTTPS origin; Chrome treats loopback as a
    // private network and blocks the call unless the preflight opts in.
    if (req.headers["access-control-request-private-network"] === "true") {
      headers["access-control-allow-private-network"] = "true";
    }
    if (origin) {
      headers["access-control-allow-origin"] = origin;
      headers.vary = "origin";
    }
    res.writeHead(204, headers);
    res.end();
    return;
  }

  if (req.method === "GET" && path === "/api/health") {
    const localStatus = detectLocalToolStatus();
    send(
      res,
      200,
      {
        ok: true,
        service: "osint-portal-runner",
        catalog: TOOLS.length,
        binaries: Object.values(localStatus).filter(Boolean).length,
        evidence: evidenceCount(),
        storage: evidenceSource(),
      },
      origin,
    );
    return;
  }

  if (req.method === "GET" && path === "/api/tools") {
    send(res, 200, catalog(), origin);
    return;
  }

  if (req.method === "GET" && path === "/api/evidence") {
    send(res, 200, { ok: true, count: evidenceCount(), items: listEvidence() }, origin);
    return;
  }

  if (req.method === "DELETE" && path === "/api/evidence") {
    clearEvidence();
    send(res, 200, { ok: true, count: 0 }, origin);
    return;
  }

  if (req.method === "GET" && path === "/api/graph") {
    const graph = buildGraph(listEvidence());
    send(res, 200, { ok: true, count: evidenceCount(), nodes: graph.nodes, links: graph.links }, origin);
    return;
  }

  const toolMatch = path.match(/^\/api\/tools\/([^/]+)$/);
  if (toolMatch && (req.method === "POST" || req.method === "GET")) {
    const tool = decodeURIComponent(toolMatch[1]);
    if (!TOOL_ID_RE.test(tool)) {
      send(res, 400, { ok: false, message: "invalid tool id" }, origin);
      return;
    }

    const body = (await readBody(req)) as { target?: unknown; args?: unknown } | null;
    const result = await runTool({
      tool,
      target: body && typeof body.target === "string" ? body.target.slice(0, 253) : undefined,
      args: body && Array.isArray(body.args) ? (body.args as unknown[]).map(String) : [],
    });

    if (result.blocked) {
      send(res, 403, { ok: false, ...result }, origin);
      return;
    }
    send(res, 200, { ok: result.connected, ...result }, origin);
    return;
  }

  send(res, 404, { ok: false, message: "not found" }, origin);
});

server.listen(PORT, HOST, () => {
  const status = detectLocalToolStatus();
  const found = Object.entries(status)
    .filter(([, ok]) => ok)
    .map(([id]) => id);
  const missing = Object.keys(status).length - found.length;

  process.stdout.write(
    [
      "",
      "  OSINT Portal — local runner",
      `  listening   http://${HOST}:${PORT}`,
      `  case file   ${defaultCaseFile()}`,
      `  binaries    ${found.length} found, ${missing} missing`,
      found.length ? `  available   ${found.join(", ")}` : "  available   (none — install tools to enable segments)",
      `  origins     localhost:* , *.vercel.app${extraOrigins.length ? `, ${extraOrigins.join(", ")}` : ""}`,
      "",
    ].join("\n"),
  );
});
