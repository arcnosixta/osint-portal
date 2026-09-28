import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

/**
 * Autostart for the local helper.
 *
 * The helper is a plain Node process, so the OS-specific bits are only about
 * *where* to put the launcher. Every implementation is idempotent: installing
 * twice rewrites the same file, and status is detected by looking for that file.
 */

export type OsKind = "linux" | "macos" | "windows";

export function detectOs(): OsKind {
  if (process.platform === "win32") return "windows";
  if (process.platform === "darwin") return "macos";
  return "linux";
}

export const APP_ID = "arcnosixta.osint-portal.helper";

function run(cmd: string, args: string[]): { ok: boolean; out: string } {
  const r = spawnSync(cmd, args, { encoding: "utf8" });
  return { ok: r.status === 0, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

/** Absolute path of the launcher for the current OS. */
export function autostartPath(os: OsKind = detectOs()): string {
  const home = homedir();
  if (os === "macos") return join(home, "Library", "LaunchAgents", `${APP_ID}.plist`);
  if (os === "windows") {
    return join(home, "AppData", "Roaming", "Microsoft", "Windows", "Start Menu", "Programs", "Startup", "osint-portal-helper.cmd");
  }
  return join(home, ".config", "systemd", "user", `${APP_ID}.service`);
}

function nodeBin(): string {
  return process.execPath;
}

function projectRoot(): string {
  // helper/ lives one level below the project root.
  return process.cwd();
}

function agentEntry(): string {
  return join(projectRoot(), "helper", "agent.ts");
}

/**
 * Autostart launches the *helper*, not the runner: the helper is what keeps
 * the control page reachable, so the website's "start tools" button always has
 * something to talk to, and the permission step always has a place to live.
 */
export function autostartCommand(): string {
  return `${nodeBin()} --import tsx ${agentEntry()}`;
}

function systemdUnit(): string {
  return [
    "[Unit]",
    "Description=OSINT Portal local helper (control page + tool runner)",
    "After=network.target",
    "",
    "[Service]",
    "Type=simple",
    `ExecStart=${autostartCommand()}`,
    `WorkingDirectory=${projectRoot()}`,
    "Environment=NODE_ENV=production",
    "Restart=on-failure",
    "RestartSec=5",
    "",
    "[Install]",
    "WantedBy=default.target",
    "",
  ].join("\n");
}

function launchAgentPlist(): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    "<dict>",
    "  <key>Label</key>",
    `  <string>${APP_ID}</string>`,
    "  <key>ProgramArguments</key>",
    "  <array>",
    `    <string>${nodeBin()}</string>`,
    "    <string>--import</string>",
    "    <string>tsx</string>",
    `    <string>${agentEntry()}</string>`,
    "  </array>",
    `  <key>WorkingDirectory</key>`,
    `  <string>${projectRoot()}</string>`,
    "  <key>RunAtLoad</key>",
    "  <true/>",
    "  <key>KeepAlive</key>",
    "  <true/>",
    "</dict>",
    "</plist>",
    "",
  ].join("\n");
}

function windowsCmd(): string {
  return [
    "@echo off",
    `cd /d "${projectRoot()}"`,
    `start "" "${nodeBin()}" --import tsx "${agentEntry()}"`,
    "",
  ].join("\r\n");
}

export function isAutostartEnabled(os: OsKind = detectOs()): boolean {
  if (!existsSync(autostartPath(os))) return false;
  if (os === "linux") return run("systemctl", ["--user", "is-enabled", `${APP_ID}.service`]).out.trim() === "enabled";
  if (os === "macos") return true; // the plist living in LaunchAgents is enough
  return true;
}

export interface AutostartResult {
  ok: boolean;
  message: string;
  /** Manual step the user must run themselves, if any. */
  manual?: string;
}

export async function installAutostart(os: OsKind = detectOs()): Promise<AutostartResult> {
  const path = autostartPath(os);
  mkdirSync(join(path, ".."), { recursive: true });

  if (os === "linux") {
    writeFileSync(path, systemdUnit(), "utf8");
    const enable = run("systemctl", ["--user", "enable", "--now", `${APP_ID}.service`]);
    if (!enable.ok) {
      return {
        ok: false,
        message: "Не удалось включить systemd-юнит автоматически.",
        manual: `systemctl --user daemon-reload && systemctl --user enable --now ${APP_ID}.service`,
      };
    }
    return { ok: true, message: "Раннер будет стартовать при входе в систему." };
  }

  if (os === "macos") {
    writeFileSync(path, launchAgentPlist(), "utf8");
    const load = run("launchctl", ["load", "-w", path]);
    if (!load.ok) {
      return {
        ok: false,
        message: "LaunchAgent создан, но launchctl его не подхватил.",
        manual: `launchctl load -w "${path}"`,
      };
    }
    return { ok: true, message: "Раннер будет стартовать при входе в систему." };
  }

  writeFileSync(path, windowsCmd(), "utf8");
  return { ok: true, message: "Ярлык создан в автозагрузке Windows." };
}

export async function removeAutostart(os: OsKind = detectOs()): Promise<AutostartResult> {
  const path = autostartPath(os);

  if (os === "linux") {
    run("systemctl", ["--user", "disable", "--now", `${APP_ID}.service`]);
  } else if (os === "macos") {
    run("launchctl", ["unload", "-w", path]);
  }

  if (existsSync(path)) rmSync(path, { force: true });
  return { ok: true, message: "Автозапуск отключён." };
}
