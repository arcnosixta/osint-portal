/**
 * Where tool execution actually happens.
 *
 * The site is deployed to the internet but the OSINT binaries live on the
 * operator's machine, and a Vercel function has no route to 127.0.0.1 on that
 * machine. The browser can reach it, so when `NEXT_PUBLIC_RUNNER_URL` is set
 * the client talks to the local runner directly and the site only serves UI.
 *
 * The variable is read in the browser, so every visitor resolves the runner on
 * their own host — which is exactly right: someone opening the deployed site
 * without a runner simply gets "runner is not running".
 *
 * Unset (the default) keeps the previous behaviour: requests go to the same
 * origin and the Next server runs the tools itself.
 */
const RAW = (process.env.NEXT_PUBLIC_RUNNER_URL ?? "").trim();

export const RUNNER_URL = RAW.replace(/\/+$/, "");

export const runnerEnabled = RUNNER_URL.length > 0;

/** Absolute runner URL when configured, otherwise the current origin. */
export function runnerApi(path: string): string {
  return `${RUNNER_URL}${path}`;
}
