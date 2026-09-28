/**
 * Local helper for the OSINT Portal.
 *
 * It exists because a website cannot start a local process. The helper is the
 * missing half: a small loopback daemon that supervises the runner and serves a
 * control page where a human presses "allow". The website's button can only open
 * that page — it can never start anything by itself, which is what keeps this
 * design safe on a machine that also browses the internet.
 *
 *   helper  →  127.0.0.1:8788   control page + permission step
 *   runner  →  127.0.0.1:8787   the tools (started by the helper, on consent)
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  HELPER_HOST,
  HELPER_PORT,
  RUNNER_PORT,
  isControlOrigin,
} from "./policy";
import { installAutostart, isAutostartEnabled, removeAutostart, detectOs } from "./autostart";

const PROJECT_ROOT = process.cwd();
const RUNNER_ENTRY = join(PROJECT_ROOT, "runner", "server.ts");

let runner: ChildProcess | null = null;
let runnerStartedAt = 0;

/** Health of the runner as the helper last observed it. */
async function probeRunner(): Promise<{ up: boolean; health: unknown; error?: string }> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1500);
    const res = await fetch(`http://${HELPER_HOST}:${RUNNER_PORT}/api/health`, {
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return { up: false, health: null, error: `HTTP ${res.status}` };
    return { up: true, health: await res.json() };
  } catch (err) {
    return { up: false, health: null, error: err instanceof Error ? err.message : "unreachable" };
  }
}

function startRunner(): void {
  if (runner && !runner.killed) return;
  runnerStartedAt = Date.now();
  runner = spawn(process.execPath, ["--import", "tsx", RUNNER_ENTRY], {
    cwd: PROJECT_ROOT,
    env: { ...process.env, NODE_ENV: "production" },
    stdio: "ignore",
    detached: false,
  });
  runner.on("exit", () => {
    runner = null;
  });
  runner.on("error", () => {
    runner = null;
  });
}

function stopRunner(): void {
  if (runner && !runner.killed) runner.kill();
  runner = null;
}

function send(res: ServerResponse, code: number, body: unknown, cors = false): void {
  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  };
  // Only ever set for the read-only status probe. Control responses must not
  // carry CORS headers, so a browser refuses them before we even answer — and
  // the Origin check below rejects the request regardless.
  if (cors) headers["Access-Control-Allow-Origin"] = "*";
  res.writeHead(code, headers);
  res.end(JSON.stringify(body));
}

async function status(): Promise<Record<string, unknown>> {
  const probe = await probeRunner();
  return {
    helper: { up: true, port: HELPER_PORT, project: PROJECT_ROOT },
    runner: {
      up: probe.up,
      supervised: runner !== null,
      port: RUNNER_PORT,
      startedAt: runnerStartedAt || null,
      error: probe.error ?? null,
      health: probe.health,
    },
    autostart: { enabled: isAutostartEnabled(), os: detectOs() },
  };
}

function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (c) => {
      raw += c;
      if (raw.length > 8192) req.destroy();
    });
    req.on("end", () => {
      try {
        resolve(raw ? (JSON.parse(raw) as Record<string, unknown>) : {});
      } catch {
        resolve({});
      }
    });
    req.on("error", () => resolve({}));
  });
}

const PAGE = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>OSINT Portal — локальный помощник</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin:0; min-height:100vh; display:grid; place-items:center; padding:24px;
         background:#07090f; color:#c9d4e5;
         font:14px/1.6 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; }
  .card { width:100%; max-width:560px; border:1px solid #1e2a3d; border-radius:14px;
          background:#0b0f18; padding:28px; box-shadow:0 24px 60px rgba(0,0,0,.55); }
  h1 { margin:0 0 6px; font-size:16px; letter-spacing:.14em; text-transform:uppercase; color:#8ee6ff; }
  .sub { margin:0 0 22px; color:#63788f; font-size:12px; }
  .row { display:flex; align-items:center; gap:10px; padding:12px 0; border-top:1px solid #16202f; }
  .row:first-of-type { border-top:0; }
  .dot { width:9px; height:9px; border-radius:50%; flex:0 0 auto; background:#4a5b72; }
  .dot.on { background:#38d39f; box-shadow:0 0 10px #38d39f88; }
  .dot.off { background:#ff5c7a; }
  .name { flex:1; }
  .val { color:#63788f; font-size:12px; }
  button { cursor:pointer; border:1px solid #2a4a63; background:#10202e; color:#c9f2ff;
           border-radius:8px; padding:9px 16px; font:inherit; font-size:13px; transition:.15s; }
  button:hover:not(:disabled) { border-color:#38d39f; color:#fff; }
  button:disabled { opacity:.45; cursor:not-allowed; }
  .go { width:100%; margin-top:22px; padding:13px; font-size:14px;
        background:#0f2c3a; border-color:#38d39f; color:#eafff5; }
  .go:hover:not(:disabled) { background:#14415a; }
  code { color:#8ee6ff; }
  .hint { margin-top:18px; font-size:11px; color:#4d5f75; line-height:1.7; }
  .err { color:#ff8fa3; }
</style></head>
<body>
<div class="card">
  <h1>OSINT Portal</h1>
  <p class="sub">Локальный помощник · только 127.0.0.1</p>

  <div class="row"><span class="dot" id="d-helper"></span><span class="name">Помощник</span>
    <span class="val" id="v-helper">проверка…</span></div>
  <div class="row"><span class="dot" id="d-runner"></span><span class="name">Раннер утилит</span>
    <span class="val" id="v-runner">проверка…</span></div>
  <div class="row"><span class="dot" id="d-auto"></span><span class="name">Автозапуск</span>
    <span class="val" id="v-auto">проверка…</span></div>

  <button class="go" id="main">Запустить утилиты</button>
  <button style="width:100%;margin-top:10px" id="auto">Включить автозапуск</button>

  <p class="hint" id="hint">
    Утилиты живут на этом компьютере, поэтому браузер не может запустить их сам.
    Этот помощник запустит их только после вашего подтверждения, и страница сайта
    не сможет сделать это вместо вас.
  </p>
</div>
<script>
const $ = (id) => document.getElementById(id);
let busy = false;

async function refresh() {
  try {
    const r = await fetch("/api/status", { cache: "no-store" });
    const s = await r.json();
    $("d-helper").className = "dot on";
    $("v-helper").textContent = "порт " + s.helper.port;

    const up = s.runner.up;
    $("d-runner").className = "dot " + (up ? "on" : "off");
    $("v-runner").textContent = up
      ? (s.runner.health.binaries + " утилит, " + s.runner.health.evidence + " записей")
      : "не запущен";

    const auto = s.autostart.enabled;
    $("d-auto").className = "dot " + (auto ? "on" : "off");
    $("v-auto").textContent = auto ? "включён" : "выключен";
    $("auto").textContent = auto ? "Отключить автозапуск" : "Включить автозапуск";

    $("main").textContent = up ? "Утилиты запущены" : "Запустить утилиты";
    $("main").disabled = busy || up;
  } catch (e) {
    $("d-helper").className = "dot off";
    $("v-helper").textContent = "нет связи";
  }
}

async function act(path, payload) {
  busy = true;
  $("main").disabled = true;
  try {
    const r = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {}),
    });
    const s = await r.json();
    if (!r.ok) {
      $("hint").innerHTML = '<span class="err">' + (s.message || "ошибка") + "</span>";
      if (s.manual) $("hint").innerHTML += "<br><code>" + s.manual + "</code>";
    } else if (s.message) {
      $("hint").innerHTML = s.manual ? "<code>" + s.manual + "</code>" : s.message;
    }
  } finally {
    busy = false;
    await refresh();
  }
}

$("main").onclick = () => act("/api/runner/start");
$("auto").onclick = () => act("/api/autostart", { enabled: !$("d-auto").classList.contains("on") });

refresh();
setInterval(refresh, 2000);
</script>
</body></html>`;

const server = createServer(async (req, res) => {
  const origin = req.headers.origin;
  const method = req.method ?? "GET";
  const url = new URL(req.url ?? "/", `http://${HELPER_HOST}:${HELPER_PORT}`);
  const path = url.pathname;

  // A page served over HTTPS counts as a *public* context, and Chrome refuses to
  // let it reach a loopback address unless the preflight opts into private-network
  // access. Without this the deployed site cannot even read the status, so
  // answer the preflight for the read-only probe only.
  if (method === "OPTIONS" && path === "/api/status") {
    const headers: Record<string, string> = {
      "Access-Control-Allow-Methods": "GET,HEAD,OPTIONS",
      "Access-Control-Allow-Headers": "content-type",
      "Access-Control-Max-Age": "600",
      Vary: "Origin, Access-Control-Request-Private-Network",
    };
    if (req.headers["access-control-request-private-network"] === "true") {
      headers["Access-Control-Allow-Private-Network"] = "true";
    }
    res.writeHead(204, headers);
    return res.end();
  }

  // Read-only probe: the website uses this to decide whether to show the
  // "start tools" button. It reveals nothing, so any origin may ask.
  if (path === "/api/status" && (method === "GET" || method === "HEAD")) {
    return send(res, 200, await status(), true);
  }

  // Everything below can start or stop processes. Control page only.
  if (!isControlOrigin(origin)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("forbidden: control actions are only accepted from the local control page");
  }

  if (method === "OPTIONS") {
    res.writeHead(204, { "Access-Control-Allow-Methods": "GET,POST,OPTIONS", Vary: "Origin" });
    return res.end();
  }

  if (path === "/" && method === "GET") {
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    });
    return res.end(PAGE);
  }

  if (path === "/api/runner/start" && method === "POST") {
    startRunner();
    // Give the runner a moment so the page can report a real result.
    for (let i = 0; i < 20; i += 1) {
      await new Promise((r) => setTimeout(r, 250));
      const probe = await probeRunner();
      if (probe.up) return send(res, 200, { ok: true, message: "Утилиты запущены.", health: probe.health });
    }
    return send(res, 500, { ok: false, message: "Раннер не поднялся. Проверь, что бинарники установлены." });
  }

  if (path === "/api/runner/stop" && method === "POST") {
    // Only a runner this helper spawned can be stopped. One started by hand
    // with `npm run runner` keeps running — say so instead of lying.
    const supervised = runner !== null;
    stopRunner();
    return send(res, 200, {
      ok: true,
      message: supervised
        ? "Утилиты остановлены."
        : "Этот раннер запущен не помощником — остановите его в терминале (Ctrl+C).",
    });
  }

  if (path === "/api/autostart" && method === "POST") {
    const body = await readBody(req);
    const result = body.enabled ? await installAutostart() : await removeAutostart();
    return send(res, result.ok ? 200 : 500, result);
  }

  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("not found");
});

if (!existsSync(RUNNER_ENTRY)) {
  process.stderr.write(`runner entry not found: ${RUNNER_ENTRY}\nrun the helper from the project root\n`);
  process.exit(1);
}

// With autostart enabled a second copy is the normal case (a manual `npm run
// helper` while the service is up). Crash with something actionable instead of
// an EADDRINUSE stack trace.
server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    process.stderr.write(
      [
        "",
        `  Порт ${HELPER_PORT} уже занят — помощник, похоже, уже запущен.`,
        `  Откройте http://${HELPER_HOST}:${HELPER_PORT} — и всё готово.`,
        "",
      ].join("\n"),
    );
    process.exit(0);
  }
  throw err;
});

server.listen(HELPER_PORT, HELPER_HOST, () => {
  process.stdout.write(
    [
      "",
      "  OSINT Portal — локальный помощник",
      `  control      http://${HELPER_HOST}:${HELPER_PORT}`,
      `  runner       http://${HELPER_HOST}:${RUNNER_PORT} (по подтверждению в браузере)`,
      `  autostart    ${isAutostartEnabled() ? "включён" : "выключен"} — включается на контрол-странице`,
      "",
    ].join("\n"),
  );
});

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    stopRunner();
    server.close(() => process.exit(0));
  });
}
