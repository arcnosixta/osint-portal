import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";

import { isInstalled, manifestPathFor, platformBrowsers } from "./browsers.ts";

const HOST = "osintportalhelper";
const LINUX_HOME = "/home/tester";

function byName(browsers: ReturnType<typeof platformBrowsers>, name: string) {
  const found = browsers.find((b) => b.name === name);
  assert.ok(found, `${name} should be in the platform list`);
  return found;
}

describe("platformBrowsers", () => {
  it("puts Linux browsers under .config", () => {
    const browsers = platformBrowsers({ platform: "linux", home: LINUX_HOME, hostName: HOST });
    const chrome = byName(browsers, "Google Chrome");

    assert.equal(chrome.engine, "chromium");
    assert.equal(chrome.manifestDir, path.join(LINUX_HOME, ".config/google-chrome/NativeMessagingHosts"));
    assert.equal(chrome.registryKey, undefined, "Linux Chromium reads a file, not a registry value");
  });

  it("puts macOS browsers under Application Support", () => {
    const browsers = platformBrowsers({ platform: "darwin", home: LINUX_HOME, hostName: HOST });
    const chrome = byName(browsers, "Google Chrome");
    const firefox = byName(browsers, "Firefox");

    assert.ok(chrome.manifestDir.includes("Application Support"), chrome.manifestDir);
    assert.ok(firefox.manifestDir.includes("Mozilla"), firefox.manifestDir);
  });

  it("gives Firefox a Gecko engine and no key", () => {
    const firefox = byName(platformBrowsers({ platform: "linux", home: LINUX_HOME, hostName: HOST }), "Firefox");
    assert.equal(firefox.engine, "gecko");
    assert.equal(firefox.fileName, undefined, "on Linux and macOS the file name is fixed by the host name");
  });

  it("gives every Windows browser a registry key", () => {
    const browsers = platformBrowsers({
      platform: "win32",
      home: "C:\\Users\\tester",
      localAppData: "C:\\Users\\tester\\AppData\\Local",
      hostName: HOST,
    });

    for (const browser of browsers) {
      assert.ok(browser.registryKey, `${browser.name} needs a registry key on Windows`);
      assert.ok(browser.registryKey.startsWith("Software\\"), browser.registryKey);
    }
  });

  it("cites the profile tree, not the manifest directory, as proof Firefox is installed", () => {
    const firefox = byName(platformBrowsers({ platform: "linux", home: LINUX_HOME, hostName: HOST }), "Firefox");
    assert.ok(firefox.probes.every((p) => p.includes(".mozilla/firefox")), firefox.probes.join(", "));
  });

  it("discovers per-profile directories from the profile list", () => {
    const browsers = platformBrowsers({
      platform: "linux",
      home: LINUX_HOME,
      hostName: HOST,
      readDir: (p) => {
        if (p.endsWith(".mozilla/firefox")) return ["abc123.default-release"];
        if (p.endsWith("abc123.default-release")) return ["prefs.js"];
        return [];
      },
    });

    const profile = browsers.find((b) => b.id === "firefox-profile");
    assert.ok(profile, "a per-profile directory should be found when the profile list can be read");
    // A profile that never registered a host has no native-messaging-hosts
    // directory, and that is the normal case: it must still be discovered, and
    // the directory created at install time.
    assert.ok(profile.manifestDir.includes("abc123.default-release"), profile.manifestDir);
    assert.ok(profile.manifestDir.endsWith("native-messaging-hosts"), profile.manifestDir);
  });

  it("ignores a profile directory that is not there", () => {
    const browsers = platformBrowsers({
      platform: "linux",
      home: LINUX_HOME,
      hostName: HOST,
      readDir: (p) => {
        if (p.endsWith(".mozilla/firefox")) return ["gone.default"];
        throw new Error("ENOENT");
      },
    });
    assert.equal(browsers.find((b) => b.id === "firefox-profile"), undefined);
  });
});

describe("isInstalled", () => {
  const browser = byName(platformBrowsers({ platform: "linux", home: LINUX_HOME, hostName: HOST }), "Chromium");

  it("is true when the profile directory exists", () => {
    assert.equal(isInstalled(browser, (p) => p === path.join(LINUX_HOME, ".config/chromium")), true);
  });

  it("is false when nothing matches", () => {
    assert.equal(isInstalled(browser, () => false), false);
  });
});

describe("manifestPathFor", () => {
  it("names the file after the host by default", () => {
    const chrome = byName(platformBrowsers({ platform: "linux", home: LINUX_HOME, hostName: HOST }), "Google Chrome");
    assert.equal(path.basename(manifestPathFor(chrome, HOST)), `${HOST}.json`);
  });
});
