/**
 * Background service worker: the only part of the extension that may talk to the
 * native host.
 *
 * It exists so that no page can reach the host directly. The content script
 * relays window messages to here, and here each request is correlated by id
 * because a single stdio port carries many in-flight requests.
 *
 * A page-origin allow-list is enforced on top of the browser's own restriction
 * (the content script is only injected on the portal). The list is duplicated
 * here on purpose: the content script is regular JavaScript running in the
 * page's world, so a compromised page could postMessage into it, and this is
 * the last place that can still say no.
 */

"use strict";

const HOST_NAME = "osintportalhelper";
const ALLOWED_ORIGINS = [
  "https://osint-portal-gamma.vercel.app",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];
const REQUEST_TIMEOUT_MS = 130000;

let port = null;

function connect() {
  if (port) return port;
  port = chrome.runtime.connectNative(HOST_NAME);
  port.onDisconnect.addListener(() => {
    // A dropped port is normal: the browser kills the host when the extension
    // reloads or the machine sleeps. Clearing it lets the next request retry.
    port = null;
  });
  return port;
}

function isAllowed(sender) {
  try {
    return ALLOWED_ORIGINS.includes(new URL(sender.url).origin);
  } catch {
    return false;
  }
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type !== "osint-portal/native") return undefined;
  if (!isAllowed(sender)) {
    respond({ ok: false, error: "источник не разрешён" });
    return undefined;
  }

  const id = message.id;
  let active;
  try {
    active = connect();
  } catch (error) {
    respond({ ok: false, error: `нативный помощник недоступен: ${String(error)}` });
    return undefined;
  }

  const timer = setTimeout(() => {
    active.onMessage.removeListener(onReply);
    respond({ ok: false, error: "нативный помощник не ответил" });
  }, REQUEST_TIMEOUT_MS);

  function onReply(reply) {
    if (reply?.id !== id) return;
    clearTimeout(timer);
    active.onMessage.removeListener(onReply);
    respond(reply);
  }

  active.onMessage.addListener(onReply);
  active.postMessage({ id, kind: message.kind, method: message.method, path: message.path, body: message.body });

  // Returning true keeps the message channel open for the async respond().
  return true;
});
