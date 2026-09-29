/**
 * One entry point for every local call, whichever transport is available.
 *
 * Returns a real Response so that callers keep using res.json() and friends and
 * do not need to know how the bytes arrived. Transport preference:
 *
 *   1. the browser extension, when installed — no Local Network Access prompt,
 *      no manual helper startup;
 *   2. a direct fetch to the loopback address, for anyone who still runs the
 *      helper the old way.
 *
 * Both end at the same helper on 127.0.0.1:8788, so this changes only how the
 * request travels, never what it may do.
 */

import { bridgeAvailable, bridgeRequest } from "./bridge";
import { HELPER_URL, RUNNER_URL } from "./local-endpoints";

/**
 * AbortSignal cannot be forwarded through the extension bridge, so it is honoured
 * here by rejecting early. Callers that pass a signal do so for a timeout on the
 * status probe; losing it would leave a hung request behind.
 */
function withAbort<T>(promise: Promise<T>, signal?: AbortSignal | null): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(new DOMException("aborted", "AbortError"));
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new DOMException("aborted", "AbortError"));
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
  });
}

export async function localRequest(
  path: string,
  init: { method?: string; body?: unknown; signal?: AbortSignal | null } = {},
): Promise<Response> {
  const method = init.method ?? "GET";

  if (await bridgeAvailable()) {
    const payload = init.body === undefined ? undefined : JSON.stringify(init.body);
    const res = await withAbort(bridgeRequest(method, path, payload), init.signal);
    return new Response(res.body, {
      status: res.status || 200,
      headers: { "content-type": "application/json" },
    });
  }

  const base = path.startsWith("/api/runner") || path === "/api/status" ? HELPER_URL : RUNNER_URL;
  return fetch(`${base}${path}`, {
    method,
    cache: "no-store",
    signal: init.signal ?? undefined,
    headers: init.body === undefined ? undefined : { "content-type": "application/json" },
    body: payloadOf(init.body),
  });
}

function payloadOf(body: unknown): BodyInit | undefined {
  if (body === undefined) return undefined;
  return typeof body === "string" ? body : JSON.stringify(body);
}
