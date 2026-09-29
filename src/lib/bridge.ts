/**
 * Bridge to the local helper, through the browser extension when it is there.
 *
 * Why an extension rather than a direct fetch to 127.0.0.1: The browser blocks
 * public HTTPS pages from reaching the local network unless the user grants
 * Local Network Access, and it has tightened that gate in recent Chrome. It
 * also refuses to start processes. Both problems disappear when the request
 * travels browser → extension → native host, because the browser vouches for a
 * registered local binary and never treats that channel as a local-network
 * request. The helper then starts on demand, so no login item, no systemd unit
 * and no terminal are involved.
 *
 * The bridge is strictly an optimisation of the transport. If the extension is
 * absent the callers fall back to a direct fetch, so the portal keeps working
 * for anyone who set the helper up the old way.
 */

const HELLO_CHANNEL = "osint-portal:hello";
const READY_CHANNEL = "osint-portal:ready";
const REQUEST_CHANNEL = "osint-portal:request";
const RESPONSE_CHANNEL = "osint-portal:response";

/** Long enough to spawn the helper and start the runner on a cold machine. */
const REQUEST_TIMEOUT_MS = 130_000;
const HANDSHAKE_TIMEOUT_MS = 700;

export interface LocalResponse {
  status: number;
  body: string;
}

let bridgeState: boolean | null = null;
let inFlight: Promise<boolean> | null = null;

function inBrowser(): boolean {
  return typeof window !== "undefined";
}

/**
 * Is the extension present?
 *
 * Resolved once per page load: the answer cannot change without a reload, and
 * every caller would otherwise pay the handshake timeout on first paint.
 */
export function bridgeAvailable(): Promise<boolean> {
  if (!inBrowser()) return Promise.resolve(false);
  if (bridgeState !== null) return Promise.resolve(bridgeState);
  if (inFlight) return inFlight;

  inFlight = new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => {
      cleanup();
      bridgeState = false;
      resolve(false);
    }, HANDSHAKE_TIMEOUT_MS);

    function onMessage(event: MessageEvent) {
      if (event.source !== window) return;
      if (event.data?.channel !== READY_CHANNEL) return;
      cleanup();
      bridgeState = true;
      resolve(true);
    }

    function cleanup() {
      clearTimeout(timer);
      window.removeEventListener("message", onMessage);
    }

    window.addEventListener("message", onMessage);
    window.postMessage({ channel: HELLO_CHANNEL }, "*");
  }).finally(() => {
    inFlight = null;
  });

  return inFlight;
}

/**
 * Send one request through the extension. Throws on transport failure so the
 * caller can fall back; an HTTP error status is a normal result.
 */
export function bridgeRequest(
  method: string,
  path: string,
  body?: unknown,
): Promise<LocalResponse> {
  if (!inBrowser()) return Promise.reject(new Error("нет окна браузера"));

  const id = `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

  return new Promise<LocalResponse>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("расширение не ответило"));
    }, REQUEST_TIMEOUT_MS);

    function onMessage(event: MessageEvent) {
      if (event.source !== window) return;
      const data = event.data;
      if (!data || data.channel !== RESPONSE_CHANNEL || data.id !== id) return;
      cleanup();
      if (data.ok) resolve({ status: data.status ?? 0, body: data.body ?? "" });
      else reject(new Error(data.error || "ошибка расширения"));
    }

    function cleanup() {
      clearTimeout(timer);
      window.removeEventListener("message", onMessage);
    }

    window.addEventListener("message", onMessage);
    // kind tells the native host this is an HTTP relay request.
    window.postMessage({ channel: REQUEST_CHANNEL, id, kind: "http", method, path, body }, "*");
  });
}
