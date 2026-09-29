#!/usr/bin/env node
/**
 * Native messaging host for the OSINT Portal Connector.
 *
 * The connector is the extension plus this file. This is the process the
 * browser launches on demand when the portal asks for it. It exists because a
 * web page can never start a local process by itself: the browser has to vouch
 * for a locally installed binary, and that binary is this file, registered in
 * the browser's NativeMessagingHosts directory.
 *
 * Two jobs, and deliberately nothing else:
 *
 *  1. Make sure the helper is listening, spawning it the first time if needed.
 *     That is what removes the need for a login item or a systemd unit — the
 *     helper exists only while someone is using the site.
 *  2. Forward a small, fixed set of JSON requests to the helper and the runner.
 *
 * The allow-list below is the security boundary. A generic HTTP proxy would let
 * the page reach anything on the machine, which is precisely what the extension
 * is trusted not to do: the port routes are pinned, the paths are pinned, and
 * nothing may be proxied off loopback.
 *
 * This file is plain JavaScript on purpose. The browser needs a single
 * executable file with a shebang — there is no build step between the source
 * and the thing the browser runs.
 *
 * Protocol: Chrome-style framing on stdin/stdout, 4-byte little-endian length
 * followed by a UTF-8 JSON payload. stdout is protocol-only; diagnostics go to
 * stderr, because a stray console.log would corrupt the stream.
 */

"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const HELPER_PORT = 8788;
const RUNNER_PORT = 8787;
const LOOPBACK = "127.0.0.1";

/**
 * Where each path is allowed to go. Anything not listed is refused, so a
 * compromised page or a malicious site that somehow reached this host still
 * cannot reach an arbitrary local port or a cloud metadata endpoint.
 */
const ROUTES = [
  { prefix: "/api/status", port: HELPER_PORT },
  { prefix: "/api/runner/health", port: HELPER_PORT },
  { prefix: "/api/runner/start", port: HELPER_PORT },
  { prefix: "/api/runner/stop", port: HELPER_PORT },
  { prefix: "/api/tools", port: RUNNER_PORT },
  { prefix: "/api/graph", port: RUNNER_PORT },
  { prefix: "/api/evidence", port: RUNNER_PORT },
];

const ALLOWED_METHODS = new Set(["GET", "POST", "DELETE"]);
const MAX_BODY = 1024 * 1024;

function log(message) {
  process.stderr.write(`[osint-host] ${message}\n`);
}

function send(message) {
  const payload = Buffer.from(JSON.stringify(message), "utf8");
  const header = Buffer.alloc(4);
  header.writeUInt32LE(payload.length, 0);
  process.stdout.write(Buffer.concat([header, payload]));
}

function reply(id, result) {
  send({ id, ok: true, ...result });
}

function fail(id, error) {
  send({ id, ok: false, error: String(error && error.message ? error.message : error) });
}

function routeFor(pathname) {
  const match = ROUTES.find((r) => pathname === r.prefix || pathname.startsWith(r.prefix + "/"));
  if (!match) return null;
  if (pathname.includes("..") || pathname.includes("://")) return null;
  return match;
}

/** Minimal request to the helper or runner, with a hard timeout. */
function request({ port, method, pathname, body }, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: LOOPBACK, port, path: pathname, method, headers: body ? { "content-type": "application/json" } : {} },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          data += chunk;
          if (data.length > MAX_BODY) {
            req.destroy(new Error("ответ слишком велик"));
          }
        });
        res.on("end", () => resolve({ status: res.statusCode, body: data }));
      },
    );
    req.setTimeout(timeoutMs, () => req.destroy(new Error("таймаут локального сервиса")));
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

function isListening(port) {
  return new Promise((resolve) => {
    const socket = new (require("node:net").Socket)();
    socket.setTimeout(1000);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    const giveUp = () => {
      socket.destroy();
      resolve(false);
    };
    socket.once("error", giveUp);
    socket.once("timeout", giveUp);
    socket.connect(port, LOOPBACK);
  });
}

/**
 * Start the helper if it is not already up.
 *
 * The command comes from host.config.json, written by `npm run helper:install`
 * at install time. Keeping it out of the browser-owned manifest means an
 * attacker who can edit the manifest still only ever runs this file.
 */
let starting = null;
async function ensureHelper() {
  if (await isListening(HELPER_PORT)) return;
  if (starting) return starting;

  const configPath = path.join(__dirname, "host.config.json");
  if (!fs.existsSync(configPath)) {
    throw new Error("нет host.config.json — выполните npm run helper:install");
  }
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  if (!config.command || !Array.isArray(config.args)) {
    throw new Error("host.config.json повреждён: нет command/args");
  }

  starting = (async () => {
    log(`запускаю помощник: ${config.command} ${config.args.join(" ")}`);
    const child = spawn(config.command, config.args, {
      cwd: config.cwd || __dirname,
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    // Give it a moment to bind the port before the caller tries to use it.
    for (let attempt = 0; attempt < 40; attempt++) {
      await new Promise((r) => setTimeout(r, 250));
      if (await isListening(HELPER_PORT)) {
        log("помощник поднялся");
        return;
      }
    }
    throw new Error("помощник не поднялся за 10 с");
  })();

  try {
    await starting;
  } finally {
    starting = null;
  }
}

async function handle(message) {
  const { id, kind } = message || {};

  if (kind === "ping") return reply(id, { pong: true });

  if (kind === "http") {
    const { method = "GET", path: rawPath, body } = message;

    if (!ALLOWED_METHODS.has(String(method).toUpperCase())) {
      throw new Error(`метод ${method} не разрешён`);
    }
    const pathname = String(rawPath || "");
    if (!pathname.startsWith("/api/")) throw new Error("путь должен начинаться с /api/");

    const route = routeFor(pathname);
    if (!route) throw new Error(`путь ${pathname} не в списке разрешённых`);

    // Starting the runner is a control action, so the helper has to exist. The
    // helper trusts a missing Origin, and this process sends none — it is a
    // local non-browser client, not a web page.
    if (route.port === HELPER_PORT) await ensureHelper();

    const res = await request({
      port: route.port,
      method: String(method).toUpperCase(),
      pathname,
      body: body ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
    });
    return reply(id, { status: res.status, body: res.body });
  }

  throw new Error(`неизвестный тип запроса: ${kind}`);
}

let buffer = Buffer.alloc(0);
process.stdin.on("data", (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  while (buffer.length >= 4) {
    const length = buffer.readUInt32LE(0);
    if (buffer.length < 4 + length) return;
    const raw = buffer.subarray(4, 4 + length).toString("utf8");
    buffer = buffer.subarray(4 + length);

    let message;
    try {
      message = JSON.parse(raw);
    } catch {
      log("пришёл не-JSON кадр, игнорирую");
      continue;
    }
    handle(message).catch((error) => {
      log(`ошибка: ${error.message}`);
      if (message && message.id) fail(message.id, error);
    });
  }
});

process.stdin.on("end", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));
log("хост запущен");
