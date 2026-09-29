/**
 * Where each supported browser keeps its native messaging manifest.
 *
 * The previous version of this file asked a different question: does a
 * NativeMessagingHosts directory already exist? That is the wrong question, and
 * it fails on exactly the machines that need the installer most. Those
 * directories are created by the browser the first time someone registers a
 * host, so on a freshly installed Chrome the profile directory exists and the
 * manifest directory does not — the installer skipped the one browser the user
 * actually had and reported "browsers not found".
 *
 * So detection now asks whether the browser's own configuration directory is
 * there, and creates the manifest directory when it is not. Being able to create
 * it is the whole point.
 *
 * Three facts from the browser documentation shape the rest:
 *
 *  - Chromium pins the caller with `allowed_origins`, Gecko with
 *    `allowed_extensions`. A manifest written for one is not a manifest the
 *    other accepts, and it fails closed: to a user that looks exactly like a
 *    broken installation.
 *  - On Linux and macOS the manifest is a file named after the host, read from
 *    a directory the browser owns. On Windows *both* engines read a registry
 *    value under HKCU instead, so the file itself is ours to place.
 *  - Gecko requires an explicit add-on id in the extension manifest and matches
 *    it against that value, so the id has to be known before the user ever
 *    opens a settings page.
 */

import { readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export type Engine = "chromium" | "gecko";
export type Platform = "linux" | "darwin" | "win32";

export interface BrowserSpec {
  /** Stable key, used in output and as the Windows registry suffix. */
  id: string;
  name: string;
  engine: Engine;
  /** Existence of any of these means the browser is installed. */
  probes: string[];
  /** Directory the manifest file goes in. Never null; on Windows it is ours. */
  manifestDir: string;
  /**
   * Manifest file name. Only Windows needs a non-default one, because there
   * both engines share a directory and would otherwise overwrite each other.
   * On Linux and macOS the name is fixed by the host name and must not vary.
   */
  fileName?: string;
  /** HKCU-relative key whose default value is the manifest path. */
  registryKey?: string;
}

export interface PlatformEnv {
  home?: string;
  /** LOCALAPPDATA / APPDATA on Windows; unused elsewhere. */
  localAppData?: string;
  appData?: string;
}

interface ChromiumDefinition {
  id: string;
  name: string;
  linux: string;
  mac: string;
  windowsLocalAppData: string;
  registryKey: string;
}

const CHROMIUM: ChromiumDefinition[] = [
  {
    id: "chrome",
    name: "Google Chrome",
    linux: ".config/google-chrome",
    mac: "Library/Application Support/Google/Chrome",
    windowsLocalAppData: "Google/Chrome/User Data",
    registryKey: "Software\\Google\\Chrome\\NativeMessagingHosts",
  },
  {
    id: "chromium",
    name: "Chromium",
    linux: ".config/chromium",
    mac: "Library/Application Support/Chromium",
    windowsLocalAppData: "Chromium/User Data",
    registryKey: "Software\\Chromium\\NativeMessagingHosts",
  },
  {
    id: "edge",
    name: "Microsoft Edge",
    linux: ".config/microsoft-edge",
    mac: "Library/Application Support/Microsoft Edge",
    windowsLocalAppData: "Microsoft/Edge/User Data",
    registryKey: "Software\\Microsoft\\Edge\\NativeMessagingHosts",
  },
  {
    id: "brave",
    name: "Brave",
    linux: ".config/BraveSoftware/Brave-Browser",
    mac: "Library/Application Support/BraveSoftware/Brave-Browser",
    windowsLocalAppData: "BraveSoftware/Brave-Browser/User Data",
    registryKey: "Software\\BraveSoftware\\Brave-Browser\\NativeMessagingHosts",
  },
  {
    id: "vivaldi",
    name: "Vivaldi",
    linux: ".config/vivaldi",
    mac: "Library/Application Support/Vivaldi",
    windowsLocalAppData: "Vivaldi/User Data",
    registryKey: "Software\\Vivaldi\\NativeMessagingHosts",
  },
  {
    id: "opera",
    name: "Opera",
    linux: ".config/opera",
    mac: "Library/Application Support/com.operasoftware.Opera",
    windowsLocalAppData: "Opera Software/Opera Stable",
    registryKey: "Software\\Opera Software\\NativeMessagingHosts",
  },
];

function chromiumSpecs(platform: Platform, env: PlatformEnv, hostName: string, sharedDir: string): BrowserSpec[] {
  if (platform === "win32") {
    const local = env.localAppData ?? env.home ?? homedir();
    return CHROMIUM.map((def) => ({
      id: def.id,
      name: def.name,
      engine: "chromium" as const,
      probes: [join(local, def.windowsLocalAppData)],
      manifestDir: sharedDir,
      fileName: `${hostName}.json`,
      registryKey: `${def.registryKey}\\${hostName}`,
    }));
  }

  const home = env.home ?? homedir();
  return CHROMIUM.map((def) => {
    const rel = platform === "darwin" ? def.mac : def.linux;
    return {
      id: def.id,
      name: def.name,
      engine: "chromium" as const,
      probes: [join(home, rel)],
      manifestDir: join(home, rel, "NativeMessagingHosts"),
    };
  });
}

interface GeckoDefinition {
  id: string;
  name: string;
  linux: string;
  mac: string;
  /** Where the profile tree lives, which is the reliable install signal. */
  linuxProfiles: string;
  macProfiles: string;
}

const GECKO: GeckoDefinition[] = [
  {
    id: "firefox",
    name: "Firefox",
    linux: ".mozilla/native-messaging-hosts",
    mac: "Library/Application Support/Mozilla/NativeMessagingHosts",
    linuxProfiles: ".mozilla/firefox",
    macProfiles: "Library/Application Support/Firefox/Profiles",
  },
  {
    id: "firefox-developer",
    name: "Firefox Developer Edition",
    linux: ".mozilla/firefox-dev/native-messaging-hosts",
    mac: "Library/Application Support/Mozilla Developer Edition/NativeMessagingHosts",
    linuxProfiles: ".mozilla/firefox-dev",
    macProfiles: "Library/Application Support/Firefox Developer Edition/Profiles",
  },
];

/**
 * Per-profile manifest directories.
 *
 * Gecko also reads a directory inside each profile. The profile folder name has
 * a random suffix, so the list has to be enumerated rather than guessed.
 */
function geckoProfileDirs(home: string, platform: Platform, readDir: (p: string) => string[]): string[] {
  const root = platform === "darwin" ? join(home, "Library/Application Support/Mozilla/Firefox/Profiles") : join(home, ".mozilla/firefox");

  let entries: string[];
  try {
    entries = readDir(root);
  } catch {
    return [];
  }

  return entries
    .filter((entry) => {
      // The profile directory is the evidence, not the manifest directory:
      // a profile that has never registered a host has no
      // native-messaging-hosts directory, and the installer creates it.
      try {
        readDir(join(root, entry));
        return true;
      } catch {
        return false;
      }
    })
    .map((entry) => join(root, entry));
}

function geckoSpecs(platform: Platform, env: PlatformEnv, hostName: string, sharedDir: string, readDir: (p: string) => string[]): BrowserSpec[] {
  const home = env.home ?? homedir();

  if (platform === "win32") {
    return [
      {
        id: "firefox",
        name: "Firefox",
        engine: "gecko",
        probes: [join(env.appData ?? join(home, "AppData", "Roaming"), "Mozilla/Firefox/Profiles")],
        manifestDir: sharedDir,
        // Shares a directory with Chromium on Windows, and the registry value
        // carries the path, so the file may be named anything.
        fileName: `${hostName}.gecko.json`,
        registryKey: `Software\\Mozilla\\NativeMessagingHosts\\${hostName}`,
      },
    ];
  }

  const specs: BrowserSpec[] = GECKO.map((def) => ({
    id: def.id,
    name: def.name,
    engine: "gecko",
    probes: [join(home, platform === "darwin" ? def.macProfiles : def.linuxProfiles)],
    manifestDir: join(home, platform === "darwin" ? def.mac : def.linux),
  }));

  for (const profileDir of geckoProfileDirs(home, platform, readDir)) {
    specs.push({
      id: "firefox-profile",
      name: "Firefox (профиль)",
      engine: "gecko",
      probes: [profileDir],
      manifestDir: join(profileDir, "native-messaging-hosts"),
    });
  }

  return specs;
}

export interface BrowserOptions extends PlatformEnv {
  platform?: Platform;
  hostName: string;
  /** Where Windows keeps our own manifest file, since it is read from the registry. */
  windowsManifestDir?: string;
  readDir?: (p: string) => string[];
}

/** Every browser worth registering with on this platform. */
export function platformBrowsers(options: BrowserOptions): BrowserSpec[] {
  const platform = options.platform ?? (process.platform as Platform);
  const readDir = options.readDir ?? ((p: string) => readdirSync(p));
  const sharedDir =
    options.windowsManifestDir ?? join(options.localAppData ?? options.home ?? homedir(), "OSINT Portal", "native-messaging-hosts");

  return [
    ...chromiumSpecs(platform, options, options.hostName, sharedDir),
    ...geckoSpecs(platform, options, options.hostName, sharedDir, readDir),
  ];
}

/** Absolute path of the manifest file for a spec. */
export function manifestPathFor(spec: BrowserSpec, hostName: string): string {
  return join(spec.manifestDir, spec.fileName ?? `${hostName}.json`);
}

/** Whether a browser is installed, judged by its own configuration directory. */
export function isInstalled(spec: BrowserSpec, exists: (p: string) => boolean): boolean {
  return spec.probes.some(exists);
}
