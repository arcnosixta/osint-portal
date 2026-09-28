/**
 * Security policy for the local helper.
 *
 * The helper owns the OSINT binaries, so it must never be drivable by a
 * website. Any page on the internet can reach `127.0.0.1` — a malicious
 * <img> or a fetch from a random tab included — so "it's bound to loopback"
 * is not a permission model on its own.
 *
 * The rule is the opposite of the runner's: the helper accepts control
 * requests *only* from its own control page. The website's "start tools"
 * button therefore cannot start anything; it can only open the local control
 * page, where a human clicks "allow". That keeps the human in the loop.
 */

export const HELPER_HOST = "127.0.0.1";
export const HELPER_PORT = 8788;
export const RUNNER_PORT = 8787;
export const HELPER_ORIGIN = `http://${HELPER_HOST}:${HELPER_PORT}`;

const LOCAL_HOSTNAMES = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);

/**
 * Only the helper's own control page may start or stop the runner.
 *
 * A missing Origin is allowed: non-browser clients (curl, the registered
 * `osint-runner://` handler) send no Origin, and they are already limited to
 * this machine. A *foreign* Origin is always rejected, whatever it is.
 */
export function isControlOrigin(origin: string | undefined | null): boolean {
  if (origin === undefined || origin === null || origin === "") return true;
  if (origin === "null") return true; // sandboxed iframe / local file

  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }

  if (url.protocol !== "http:") return false;
  if (!LOCAL_HOSTNAMES.has(url.hostname)) return false;

  // Any loopback port is our own helper: the control page may be reached
  // through a different port if the user changed HELPER_PORT.
  return url.port === "" || /^\d+$/.test(url.port);
}

/** Health probe the website may perform. Read-only, so any origin is fine. */
export function isProbeRequest(method: string): boolean {
  return method === "GET" || method === "HEAD";
}
