/**
 * How a TypeScript entry point gets started on this machine.
 *
 * The local helper and the runner are TypeScript, and for a long time the only
 * way to run them was `tsx` from node_modules. That put an `npm install` in
 * front of every machine that wanted the tools, which is exactly the step this
 * project is trying to remove.
 *
 * Node can execute TypeScript itself by erasing the types at load time, and can
 * resolve `./foo` to `./foo.ts` through a hook, so from Node 23.5 the preferred
 * command is plain `node` with no dependencies at all. `tsx` stays only as a
 * fallback for older versions, and the installer says so out loud when it is in
 * use, because a recorded command that quietly needs node_modules is the kind of
 * thing that works on the machine that wrote it and nowhere else.
 *
 * The version is read from the process doing the install rather than probed
 * separately, so the command recorded in host.config.json is one that
 * demonstrably runs right here.
 */

import path from "node:path";
import { projectRoot } from "./root.ts";

/** registerHooks() arrived in 23.5.0, and is what makes the local runtime work. */
const RESOLVER_HOOKS: Array<[number, number]> = [
  [23, 5],
];

export type LaunchMode = "node" | "tsx";

export interface NodeVersion {
  major: number;
  minor: number;
}

export function parseNodeVersion(version: string = process.versions.node): NodeVersion {
  const [major, minor] = version.split(".").map((part) => Number.parseInt(part, 10));
  return { major: Number.isFinite(major) ? major : 0, minor: Number.isFinite(minor) ? minor : 0 };
}

export function launchMode(version: string = process.versions.node): LaunchMode {
  const { major, minor } = parseNodeVersion(version);
  for (const [needMajor, needMinor] of RESOLVER_HOOKS) {
    if (major > needMajor || (major === needMajor && minor >= needMinor)) return "node";
  }
  return "tsx";
}

/** Absolute path of the resolver hook, which must load before the entry. */
export function resolverPath(): string {
  return path.join(projectRoot(), "helper", "register.ts");
}

/**
 * The warning Node prints for a .ts file in a package without "type". It is
 * noise here — the module type is correct either way — and it would otherwise
 * land in the native host's stderr on every single connection.
 */
const QUIET = "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON";

/** Arguments that run `entry`, given an absolute path. */
export function runArgs(entry: string, version: string = process.versions.node): string[] {
  if (launchMode(version) === "node") return ["--import", resolverPath(), QUIET, entry];
  return ["--import", "tsx", entry];
}

/** The command recorded in host.config.json, for the native host to spawn. */
export function launchCommand(
  entry: string,
  version: string = process.versions.node,
): { command: string; args: string[] } {
  return { command: "node", args: runArgs(entry, version) };
}

/** True when the recorded command will not need an installed dependency. */
export function isDependencyFree(version: string = process.versions.node): boolean {
  return launchMode(version) === "node";
}

/** One line for the installer to print, so the user knows which path is live. */
export function describeLaunch(version: string = process.versions.node): string {
  if (isDependencyFree(version)) return `node ${version} — TypeScript запускает сам Node, зависимости не нужны`;
  return `node ${version} — ниже 23.5, нужен npm install для tsx (или обновите Node)`;
}
