/**
 * Client for the local helper.
 *
 * The helper is optional: if it is not running the site still works, tools just
 * show the start button. This module is browser-only and deliberately cannot
 * start the runner — control actions require the local control page, which
 * checks the Origin header (see helper/policy.ts).
 */

export const HELPER_PORT = 8788;
export const HELPER_URL = `http://127.0.0.1:${HELPER_PORT}`;

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
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(`${HELPER_URL}/api/status`, {
      signal: ctrl.signal,
      cache: "no-store",
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return (await res.json()) as HelperStatus;
  } catch {
    return null;
  }
}
