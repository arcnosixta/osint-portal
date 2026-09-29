/**
 * Client for the local helper.
 *
 * The helper is optional: if it is not running the site still works, tools just
 * show the start button. This module is browser-only and deliberately cannot
 * start the runner — control actions require the local control page, which
 * checks the Origin header (see helper/policy.ts).
 */

import { bridgeAvailable } from "./bridge";
import { localRequest } from "./local";

export { HELPER_PORT, HELPER_URL, RUNNER_PORT, RUNNER_URL } from "./local-endpoints";

/** Cold start: spawn the host, then the helper, then the runner. */
const STARTUP_TIMEOUT_MS = 45_000;

export interface HelperStatus {
  helper: { up: boolean; port: number; project: string };
  runner: {
    up: boolean;
    supervised: boolean;
    port: number;
    startedAt: number | null;
    error: string | null;
    health: {
      catalog?: number;
      binaries?: number;
      evidence?: number;
    } | null;
  };
  autostart: { enabled: boolean; os: string };
}

/**
 * Read-only status probe. Returns null when no helper is listening, which is
 * the normal state for anyone who has not installed it.
 */
export async function helperStatus(timeoutMs = 1500): Promise<HelperStatus | null> {
  if (typeof window === "undefined") return null;

  // The extension may have to spawn the helper first, so it gets a real budget
  // while a direct probe stays short — a missing helper should not stall paint.
  const viaBridge = bridgeAvailable();
  const timeout = await viaBridge.then((ok) => (ok ? STARTUP_TIMEOUT_MS : timeoutMs));
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);

  try {
    const res = await localRequest("/api/status", { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return (await res.json()) as HelperStatus;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

/**
 * Start the runner and wait until it is up.
 *
 * With the extension installed this needs nothing from the user: the browser
 * launches the host, the host starts the helper, and the helper starts the
 * runner. Installing the extension is the grant, which replaces the previous
 * "open the local page and click allow" step.
 */
export async function startTools(timeoutMs = STARTUP_TIMEOUT_MS): Promise<HelperStatus | null> {
  if (typeof window === "undefined") return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await localRequest("/api/runner/start", { method: "POST", signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return (await res.json()) as HelperStatus;
  } catch {
    clearTimeout(timer);
    return null;
  }
}
