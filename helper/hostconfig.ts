/**
 * host.config.json — how the native host should start the helper.
 *
 * The host runs detached from the browser and cannot know how the project was
 * set up, so the installer records the command here. It lives beside host.js
 * rather than inside the browser-owned native messaging manifest on purpose: the
 * manifest is a file a browser administrator may rewrite, and anything in it
 * would become attacker-controlled. A file that only the installer writes keeps
 * the "run this exact local binary" promise intact.
 */

import fs from "node:fs";
import path from "node:path";
import { isDependencyFree, launchCommand } from "./runtime.ts";

export interface HostConfigResult {
  ok: boolean;
  message: string;
}

export function writeHostConfig(hostPath: string): HostConfigResult {
  const configPath = path.join(path.dirname(hostPath), "host.config.json");
  const projectRoot = path.resolve(path.dirname(hostPath), "..");

  // Node runs the TypeScript helper directly on anything recent, so a fresh
  // machine needs no node_modules at all. The entry is given as an absolute
  // path because the host may be started from any working directory.
  const { command, args } = launchCommand(path.join(projectRoot, "helper", "agent.ts"));
  const config = { command, args, cwd: projectRoot };

  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf8");
    return { ok: true, message: `${configPath}${isDependencyFree() ? "" : " (нужен npm install: tsx)"}` };
  } catch (error) {
    return { ok: false, message: String(error) };
  }
}

export function readHostConfig(configPath: string): { command: string; args: string[]; cwd: string } | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(configPath, "utf8")) as {
      command?: string;
      args?: string[];
      cwd?: string;
    };
    if (!parsed.command || !Array.isArray(parsed.args)) return null;
    return { command: parsed.command, args: parsed.args, cwd: parsed.cwd ?? "" };
  } catch {
    return null;
  }
}
