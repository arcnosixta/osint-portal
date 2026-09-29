/**
 * Registration of the native messaging host.
 *
 * A browser will only launch a local binary that it has a manifest for, and it
 * only looks in its own profile directory. This module writes that manifest for
 * every Chromium and Gecko browser it can find, so the extension works without
 * the user hunting for the right path.
 *
 * Two details that are easy to get wrong and expensive to debug:
 *
 *  - the host name must be a plain slug. Chromium rejects some punctuation, and
 *    it reports the failure as "invalid host name" with no hint about the file.
 *  - `allowed_origins` pins the extension id. Without it any installed
 *    extension could drive the host, which is exactly the hole the whole
 *    design is meant to close.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** Must match HOST_NAME in extension/background.js. */
export const HOST_NAME = "osintportalhelper";

/** A browser we know how to register with, before the manifest path is built. */
interface BrowserDir {
  browser: string;
  dir: string;
}

export interface HostTarget {
  browser: string;
  manifest: string;
}

function chromiumTargets(): BrowserDir[] {
  const home = os.homedir();
  return [
    { browser: "Google Chrome", dir: ".config/google-chrome" },
    { browser: "Chromium", dir: ".config/chromium" },
    { browser: "Microsoft Edge", dir: ".config/microsoft-edge" },
    { browser: "Brave", dir: ".config/BraveSoftware/Brave-Browser" },
    { browser: "Vivaldi", dir: ".config/vivaldi" },
  ].map(({ browser, dir }) => ({
    browser,
    dir: path.join(home, dir, "NativeMessagingHosts"),
  }));
}

function geckoTargets(): BrowserDir[] {
  const home = os.homedir();
  const app = process.platform === "darwin" ? "Library/Application Support/Mozilla/NativeMessagingHosts" : ".mozilla/native-messaging-hosts";
  return [
    { browser: "Firefox", dir: path.join(home, app) },
    // Gecko also reads a per-profile directory, which covers installs that
    // never touch the application-level one.
    { browser: "Firefox (профиль)", dir: path.join(home, ".mozilla/firefox/Default/native-messaging-hosts") },
  ];
}

/**
 * Every browser this machine could use, with the directory the browser itself
 * reads. Directories that do not exist are skipped later, which is how we tell
 * an installed browser from one that is merely supported.
 */
/**
 * The extension id Chromium derives from an unpacked directory.
 *
 * It hashes the absolute path, so the id is stable for a given checkout and
 * predictable ahead of time. That is what lets the installer write
 * allowed_origins without the user having to copy an id out of a settings page:
 * the number the browser will use is the one we compute here.
 */
export function extensionIdFromPath(extensionDir: string): string {
  const digest = crypto.createHash("sha256").update(path.resolve(extensionDir), "utf8").digest("hex");
  return digest
    .slice(0, 32)
    .split("")
    .map((c) => String.fromCharCode(97 + parseInt(c, 16)))
    .join("");
}

export function targetDirs(platform = process.platform): HostTarget[] {
  const macSupport = path.join(os.homedir(), "Library", "Application Support");
  const toMac = (dirs: BrowserDir[]): BrowserDir[] =>
    dirs.map((t) => ({
      ...t,
      dir: t.dir.replace(path.join(os.homedir(), ".config"), macSupport),
    }));

  const targets: BrowserDir[] =
    platform === "darwin"
      ? [...geckoTargets(), ...toMac(chromiumTargets())]
      : [...chromiumTargets(), ...geckoTargets()];

  return targets.map((t) => ({
    browser: t.browser,
    manifest: path.join(t.dir, `${HOST_NAME}.json`),
  }));
}

export interface InstallResult {
  installed: HostTarget[];
  skipped: HostTarget[];
  errors: { target: HostTarget; message: string }[];
}

function exists(target: HostTarget): boolean {
  try {
    return fs.existsSync(path.dirname(target.manifest));
  } catch {
    return false;
  }
}

/**
 * Write the host manifest into every browser profile directory that exists.
 *
 * `extensions` is a list of allowed extension ids. It may be empty when the
 * user has not recorded an id yet, in which case the manifest is written
 * without `allowed_origins` and the helper still works, but the browser will
 * refuse the connection — the extension reports that as "host unavailable" and
 * the user can run the installer again after the id is known.
 */
export function installNativeHost(
  hostPath: string,
  extensions: string[] = [],
  extensionDir?: string,
): InstallResult {
  const allowed = extensionDir ? [extensionIdFromPath(extensionDir)] : extensions;
  const result: InstallResult = { installed: [], skipped: [], errors: [] };

  const manifest: Record<string, unknown> = {
    name: HOST_NAME,
    description: "OSINT Portal local helper",
    path: hostPath,
    type: "stdio",
  };
  if (allowed.length > 0) manifest.allowed_origins = allowed.map((id) => `chrome-extension://${id}/`);

  for (const target of targetDirs()) {
    if (!exists(target)) {
      result.skipped.push(target);
      continue;
    }
    try {
      fs.mkdirSync(path.dirname(target.manifest), { recursive: true });
      fs.writeFileSync(target.manifest, JSON.stringify(manifest, null, 2) + "\n", "utf8");
      result.installed.push(target);
    } catch (error) {
      result.errors.push({ target, message: String(error) });
    }
  }

  return result;
}

export function removeNativeHost(): HostTarget[] {
  const removed: HostTarget[] = [];
  for (const target of targetDirs()) {
    try {
      if (fs.existsSync(target.manifest)) {
        fs.unlinkSync(target.manifest);
        removed.push(target);
      }
    } catch {
      /* a manifest we cannot delete is reported as still present */
    }
  }
  return removed;
}
