/**
 * Loopback endpoints of the local side.
 *
 * Split out from the clients so that local.ts can pick a base URL for the
 * direct-fetch fallback without importing a module that already imports it.
 * These addresses are only used when the extension is not installed; with the
 * extension the browser routes the request and the page never dials loopback.
 */

export const HELPER_PORT = 8788;
export const RUNNER_PORT = 8787;

export const HELPER_URL = `http://127.0.0.1:${HELPER_PORT}`;
export const RUNNER_URL = `http://127.0.0.1:${RUNNER_PORT}`;
