/**
 * Whether tool execution is available on this machine.
 *
 * The site is deployed to the internet but the binaries live on the operator's
 * machine, and a Vercel function has no route to 127.0.0.1 on that machine.
 * Execution is therefore always local, and always on: localRequest() reaches
 * the runner through the browser extension when it is installed and falls back
 * to a direct loopback call when it is not.
 *
 * The flag stays exported because the UI uses it to decide whether to offer
 * local execution at all. A visitor with no helper simply gets
 * "runner is not running" from the first request.
 */
export const runnerEnabled = true;
