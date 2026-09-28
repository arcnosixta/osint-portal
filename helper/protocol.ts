import { writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { detectOs, type OsKind } from "./autostart";
import { HELPER_HOST, HELPER_PORT } from "./policy";

/**
 * Register `osint-runner://` so a website can ask the OS to start the helper.
 *
 * This is the only mechanism browsers expose for reaching a local program, and
 * it comes with a confirmation dialog — which is exactly the permission step the
 * user should be seeing. The helper is idempotent, so repeating this is safe.
 */

export const SCHEME = "osint-runner";
export const APP_ID = "arcnosixta.osint-portal.helper";

function run(cmd: string, args: string[]): { ok: boolean; out: string } {
  const r = spawnSync(cmd, args, { encoding: "utf8" });
  return { ok: r.status === 0, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

function agentEntry(): string {
  return join(process.cwd(), "helper", "agent.ts");
}

function nodeBin(): string {
  return process.execPath;
}

/** What the OS launches when it handles the scheme. */
export function protocolCommand(): string {
  return `"${nodeBin()}" --import tsx "${agentEntry()}" --from-protocol`;
}

export interface ProtocolResult {
  ok: boolean;
  message: string;
  manual?: string;
}

/**
 * Linux: a .desktop entry in the user's applications dir, marked as handling
 * the scheme, then refresh the desktop database so the association is visible.
 */
function installLinux(): ProtocolResult {
  const dir = join(homedir(), ".local", "share", "applications");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${APP_ID}.desktop`);

  writeFileSync(
    file,
    [
      "[Desktop Entry]",
      "Type=Application",
      "Name=OSINT Portal local helper",
      "Comment=Start the OSINT Portal local runner",
      "Exec=" + protocolCommand(),
      "Terminal=false",
      "NoDisplay=true",
      "MimeType=x-scheme-handler/" + SCHEME + ";",
      "",
    ].join("\n"),
    "utf8",
  );

  run("update-desktop-database", [dir]);

  const manual = "xdg-mime default " + APP_ID + ".desktop x-scheme-handler/" + SCHEME;
  run("xdg-mime", ["default", APP_ID + ".desktop", "x-scheme-handler/" + SCHEME]);

  return {
    ok: true,
    message: "Схема " + SCHEME + ":// зарегистрирована.",
    manual: "Если браузер не спрашивает разрешение, выполните вручную: " + manual,
  };
}

/** macOS only honours schemes declared by an app bundle's Info.plist. */
function installMac(): ProtocolResult {
  const bundle = join(homedir(), "Applications", `${APP_ID}.app`);
  const macos = join(bundle, "Contents", "MacOS");
  mkdirSync(macos, { recursive: true });

  writeFileSync(
    join(bundle, "Contents", "Info.plist"),
    `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>OSINT Portal helper</string>
  <key>CFBundleIdentifier</key><string>${APP_ID}</string>
  <key>CFBundleExecutable</key><string>helper</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleURLTypes</key>
  <array>
    <dict>
      <key>CFBundleURLName</key><string>${APP_ID}</string>
      <key>CFBundleURLSchemes</key><array><string>${SCHEME}</string></array>
    </dict>
  </array>
</dict>
</plist>
`,
    "utf8",
  );

  writeFileSync(
    join(macos, "helper"),
    `#!/bin/bash
cd "${process.cwd()}"
exec "${nodeBin()}" --import tsx "${agentEntry()}" --from-protocol
`,
    "utf8",
  );
  run("chmod", ["+x", join(macos, "helper")]);

  return {
    ok: true,
    message: `Приложение создано в ~/Applications.`,
    manual: `Подтвердите регистрацию один раз: /System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "${bundle}"`,
  };
}

/** Windows keeps the association in HKCU, which needs no admin rights. */
function installWindows(): ProtocolResult {
  const key = `HKCU\\Software\\Classes\\${SCHEME}`;
  const cmd = `"${nodeBin()}" --import tsx "${agentEntry()}" --from-protocol %1`;

  const steps: Array<[string, string[]]> = [
    ["reg", ["add", key, "/ve", "/t", "REG_SZ", "/d", `URL:${SCHEME}`, "/f"]],
    ["reg", ["add", key, "/v", "URL Protocol", "/t", "REG_SZ", "/d", "", "/f"]],
    ["reg", ["add", `${key}\\shell\\open\\command`, "/ve", "/t", "REG_SZ", "/d", cmd, "/f"]],
  ];

  for (const [bin, args] of steps) {
    const r = run(bin, args);
    if (!r.ok) return { ok: false, message: "Не удалось записать ветку реестра.", manual: cmd };
  }
  return { ok: true, message: `Схема ${SCHEME}:// зарегистрирована в реестре.` };
}

export function installProtocol(os: OsKind = detectOs()): ProtocolResult {
  if (os === "linux") return installLinux();
  if (os === "macos") return installMac();
  return installWindows();
}

export function removeProtocol(os: OsKind = detectOs()): ProtocolResult {
  if (os === "linux") {
    const file = join(homedir(), ".local", "share", "applications", `${APP_ID}.desktop`);
    if (existsSync(file)) rmSync(file, { force: true });
    return { ok: true, message: "Регистрация схемы удалена." };
  }
  if (os === "macos") {
    const bundle = join(homedir(), "Applications", `${APP_ID}.app`);
    if (existsSync(bundle)) rmSync(bundle, { recursive: true, force: true });
    return { ok: true, message: "Приложение удалено." };
  }
  run("reg", ["delete", `HKCU\\Software\\Classes\\${SCHEME}`, "/f"]);
  return { ok: true, message: "Регистрация схемы удалена." };
}

/** Called when the OS hands us the scheme: we are already the helper, so just report. */
export function describeProtocolStart(): void {
  process.stdout.write(
    [
      "",
      "  Запуск по запросу из браузера",
      `  control      http://${HELPER_HOST}:${HELPER_PORT}`,
      "  Раннер утилит поднимется, как только вы подтвердите на контрол-странице.",
      "",
    ].join("\n"),
  );
}
