/**
 * Content script: a thin relay between the page and the background worker.
 *
 * The page cannot call chrome.* and the worker cannot see window messages, so
 * this is the join. It holds no state and makes no decisions — the worker
 * re-checks the sender origin, and the native host pins the allowed paths, so
 * nothing here needs to be trusted with anything.
 *
 * It runs at document_start because the page may ask for the helper as soon as
 * the first tool panel mounts.
 */

"use strict";

const REQUEST_TYPE = "osint-portal/native";
const WINDOW_REQUEST = "osint-portal:request";
const WINDOW_RESPONSE = "osint-portal:response";
const WINDOW_HELLO = "osint-portal:hello";
const WINDOW_READY = "osint-portal:ready";

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const data = event.data;
  if (!data) return;

  // The page asks "are you there?" before anything else. This must not touch
  // the native host: spawning the helper can take seconds, and the page only
  // needs to know whether to use the extension or fall back to a direct fetch.
  if (data.channel === WINDOW_HELLO) {
    window.postMessage({ channel: WINDOW_READY }, "*");
    return;
  }

  if (data.channel !== WINDOW_REQUEST) return;

  const { id, kind, method, path, body } = data;
  chrome.runtime.sendMessage({ type: REQUEST_TYPE, id, kind, method, path, body }, (reply) => {
    window.postMessage(
      {
        channel: WINDOW_RESPONSE,
        id,
        ok: Boolean(reply?.ok),
        status: reply?.status,
        body: reply?.body,
        error: reply?.ok ? undefined : reply?.error ?? "нет ответа от расширения",
      },
      "*",
    );
  });
});
