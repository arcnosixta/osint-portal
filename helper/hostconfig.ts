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

export interface HostConfigResult {
  ok: boolean;
  message: string;
}

export function writeHostConfig(hostPath: string, platform = process.platform): HostConfigResult {
  const dir = path.dirname(hostPath);
  const configPath = path.join(dir, "host.config.json");
  const projectRoot = path.resolve(dir, "..");

  // tsx runs the TypeScript helper directly, which keeps a single source of
  // truth: there is no compiled copy of the helper to fall out of date.
  const isWindows = platform === "win32";
  const config = {
    command: isWindows ? "npx.cmd" : "npx",
    args: ["tsx", "helper/agent.ts"],
    cwd: projectRoot,
  };

  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf8");
    return { ok: true, message: configPath };
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
