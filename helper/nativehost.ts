/**
 * Registration of the native messaging host.
 *
 * A browser will only launch a local binary that it has a manifest for. This
 * module writes that manifest for every Chromium and Gecko browser it can find,
 * so the extension works without the user hunting for the right path.
 *
 * The rules that are easy to get wrong, and what they cost when they are:
 *
 *  - The host name must be a plain slug. Chromium rejects some punctuation and
 *    reports only "invalid host name", with no hint about the file.
 *  - The allow-list field is engine-specific: `allowed_origins` for Chromium,
 *    `allowed_extensions` for Gecko. Writing the Chromium field for Firefox
 *    produces a manifest Firefox rejects.
 *  - Omitting the allow-list entirely is worse than writing a wrong one: it
 *    tells the browser that *any* installed extension may drive this host. So a
 *    manifest without an id is refused rather than written.
 *  - On Windows both engines read a registry value, not a directory.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import {
  isInstalled,
  manifestPathFor,
  platformBrowsers,
  type BrowserOptions,
  type BrowserSpec,
  type Engine,
  type Platform,
  type PlatformEnv,
} from "./browsers.ts";

/** Must match HOST_NAME in extension/background.js. */
export const HOST_NAME = "osintportalhelper";

/** The ids the browser will use, read out of the built extension manifests. */
export interface HostIds {
  chromium: string;
  gecko: string | null;
}

export interface HostTarget {
  browser: string;
  engine: Engine;
  manifest: string;
  registryKey?: string;
}

export interface InstallResult {
  installed: HostTarget[];
  skipped: HostTarget[];
  errors: { target: HostTarget; message: string }[];
}

export type RegRunner = (args: string[]) => { ok: boolean; out: string };

const defaultRegRunner: RegRunner = (args) => {
  const r = spawnSync("reg.exe", args, { encoding: "utf8" });
  return { ok: r.status === 0, out: `${r.stdout ?? ""}${r.stderr ?? ""}`.trim() };
};

function env(): PlatformEnv {
  return {
    home: homedir(),
    localAppData: process.env.LOCALAPPDATA,
    appData: process.env.APPDATA,
  };
}

function browserOptions(overrides: Partial<BrowserOptions> = {}): BrowserOptions {
  return { ...env(), hostName: HOST_NAME, ...overrides };
}

/** Every browser this machine could use, with the file or registry entry it needs. */
export function targetDirs(platform: Platform = process.platform as Platform, overrides: Partial<BrowserOptions> = {}): HostTarget[] {
  return platformBrowsers(browserOptions({ platform, ...overrides })).map((spec) => ({
    browser: spec.name,
    engine: spec.engine,
    manifest: manifestPathFor(spec, HOST_NAME),
    ...(spec.registryKey ? { registryKey: spec.registryKey } : {}),
  }));
}

function present(spec: BrowserSpec): boolean {
  return isInstalled(spec, (p) => fs.existsSync(p));
}

/** Write a single manifest, and its registry value on Windows. */
function writeOne(
  target: HostTarget,
  manifest: Record<string, unknown>,
  reg: RegRunner,
): { ok: boolean; message?: string } {
  try {
    fs.mkdirSync(path.dirname(target.manifest), { recursive: true });
    fs.writeFileSync(target.manifest, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  } catch (error) {
    return { ok: false, message: String(error) };
  }

  if (!target.registryKey) return { ok: true };

  // Windows: the browser is told where the file is, so the path has to be
  // absolute and in the backslash form reg.exe stores.
  const result = reg(["ADD", `HKCU\\${target.registryKey}`, "/ve", "/t", "REG_SZ", "/d", path.resolve(target.manifest), "/f"]);
  return result.ok ? { ok: true } : { ok: false, message: `реестр: ${result.out || "отказано"}` };
}

/** What a browser expects to find in a native messaging manifest. */
type HostManifest = {
  name: string;
  description: string;
  path: string;
  type: "stdio";
  allowed_origins?: string[];
  allowed_extensions?: string[];
};

function buildManifest(engine: Engine, hostPath: string, ids: HostIds): HostManifest | { error: string } {
  const base: HostManifest = {
    name: HOST_NAME,
    description: "OSINT Portal local helper",
    path: hostPath,
    type: "stdio",
  };

  if (engine === "chromium") {
    if (!ids.chromium) return { error: "в manifest.json расширения нет поля key, поэтому id неизвестен" };
    base.allowed_origins = [`chrome-extension://${ids.chromium}/`];
    return base;
  }

  if (!ids.gecko) return { error: "в manifest.json расширения нет browser_specific_settings.gecko.id" };
  base.allowed_extensions = [ids.gecko];
  return base;
}

/**
 * Write the host manifest for every installed browser.
 *
 * An id is required per engine: a manifest without one is refused, because the
 * alternative is a host that answers any extension on the machine.
 */
export function installNativeHost(
  hostPath: string,
  ids: HostIds,
  overrides: Partial<BrowserOptions> = {},
  reg: RegRunner = defaultRegRunner,
): InstallResult {
  const options = browserOptions(overrides);
  const result: InstallResult = { installed: [], skipped: [], errors: [] };

  for (const spec of platformBrowsers(options)) {
    const target: HostTarget = {
      browser: spec.name,
      engine: spec.engine,
      manifest: manifestPathFor(spec, HOST_NAME),
      ...(spec.registryKey ? { registryKey: spec.registryKey } : {}),
    };

    if (!present(spec)) {
      result.skipped.push(target);
      continue;
    }

    const manifest = buildManifest(spec.engine, hostPath, ids);
    if ("error" in manifest) {
      result.errors.push({ target, message: manifest.error });
      continue;
    }

    const written = writeOne(target, manifest, reg);
    if (written.ok) result.installed.push(target);
    else result.errors.push({ target, message: written.message ?? "неизвестная ошибка" });
  }

  return result;
}

/**
 * Make sure the host file is executable, and report what had to change.
 *
 * This is not cosmetic. The native messaging manifest points at `host.js`
 * itself, and the browser runs that path — there is no interpreter named in the
 * manifest to fall back on, so a host file without the executable bit is a
 * registration the browser silently cannot use.
 *
 * The bit is easy to lose without anyone noticing: an archive written without
 * Unix modes, a copy onto FAT/exFAT, a restore from a backup that stored only
 * contents. The installer calls this so that a successful install means a
 * working one.
 *
 * Windows has no executable bit and launches the host through its file
 * association, so there this reports success without touching anything.
 */
export function ensureHostExecutable(
  hostPath: string,
  platform: Platform = process.platform as Platform,
): { ok: boolean; detail: string; changed: boolean } {
  if (platform === "win32") {
    return { ok: true, detail: "не требуется на Windows", changed: false };
  }
  try {
    if ((fs.statSync(hostPath).mode & 0o111) === 0o111) {
      return { ok: true, detail: "уже установлены", changed: false };
    }
    fs.chmodSync(hostPath, 0o755);
    const nowExecutable = (fs.statSync(hostPath).mode & 0o111) === 0o111;
    return nowExecutable
      ? { ok: true, detail: "восстановлены", changed: true }
      : { ok: false, detail: "не удалось установить", changed: false };
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
      changed: false,
    };
  }
}

export function removeNativeHost(
  overrides: Partial<BrowserOptions> = {},
  reg: RegRunner = defaultRegRunner,
): HostTarget[] {
  const removed: HostTarget[] = [];

  for (const spec of platformBrowsers(browserOptions(overrides))) {
    const target: HostTarget = {
      browser: spec.name,
      engine: spec.engine,
      manifest: manifestPathFor(spec, HOST_NAME),
      ...(spec.registryKey ? { registryKey: spec.registryKey } : {}),
    };

    // Registry entries are cleared for every known browser, not only installed
    // ones: a browser can be uninstalled later and leave its key behind.
    if (target.registryKey) reg(["DELETE", `HKCU\\${target.registryKey}`, "/f"]);

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
