import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";

import { HOST_NAME, installNativeHost, removeNativeHost, type RegRunner } from "./nativehost.ts";

const IDS = { chromium: "abcdefghijklmnopabcdefghijklmnop", gecko: "osint-portal@local.tools" };

/** Redirect the home directory so nothing touches the real browser profiles. */
function withTempHome<T>(fn: (home: string) => T): T {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "osint-home-"));
  try {
    return fn(home);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
}

const noRegistry: RegRunner = () => ({ ok: true, out: "" });

after(() => {
  // Never leave a real host manifest behind from a test run.
  removeNativeHost({}, noRegistry);
});

describe("installNativeHost", () => {
  it("installs for a browser whose profile exists but whose manifest directory does not", () => {
    withTempHome((home) => {
      // This is the shape of a fresh Chrome install, and the case the previous
      // detection missed: the profile directory is there, the directory the
      // manifest belongs in is not, because the browser only makes it once
      // somebody registers a host.
      fs.mkdirSync(path.join(home, ".config/google-chrome"), { recursive: true });

      const result = installNativeHost("/opt/host.js", IDS, { home, platform: "linux" }, noRegistry);

      assert.equal(result.installed.length, 1);
      assert.equal(result.installed[0].browser, "Google Chrome");
      assert.ok(fs.existsSync(path.join(home, ".config/google-chrome/NativeMessagingHosts", `${HOST_NAME}.json`)));
    });
  });

  it("pins a Chromium browser with allowed_origins", () => {
    withTempHome((home) => {
      fs.mkdirSync(path.join(home, ".config/google-chrome"), { recursive: true });
      installNativeHost("/opt/host.js", IDS, { home, platform: "linux" }, noRegistry);

      const manifest = JSON.parse(
        fs.readFileSync(path.join(home, ".config/google-chrome/NativeMessagingHosts", `${HOST_NAME}.json`), "utf8"),
      );
      assert.deepEqual(manifest.allowed_origins, [`chrome-extension://${IDS.chromium}/`]);
      assert.equal(manifest.allowed_extensions, undefined);
      assert.equal(manifest.path, "/opt/host.js");
    });
  });

  it("pins Firefox with allowed_extensions, which Firefox is the one that reads", () => {
    withTempHome((home) => {
      fs.mkdirSync(path.join(home, ".mozilla/firefox"), { recursive: true });

      const result = installNativeHost("/opt/host.js", IDS, { home, platform: "linux" }, noRegistry);

      const firefox = result.installed.find((t) => t.browser === "Firefox");
      assert.ok(firefox, "Firefox should be registered when its profile tree exists");
      const manifest = JSON.parse(fs.readFileSync(firefox.manifest, "utf8"));
      assert.deepEqual(manifest.allowed_extensions, [IDS.gecko]);
      assert.equal(manifest.allowed_origins, undefined);
    });
  });

  it("refuses to write a manifest without an id instead of allowing every extension", () => {
    withTempHome((home) => {
      fs.mkdirSync(path.join(home, ".config/google-chrome"), { recursive: true });

      const result = installNativeHost("/opt/host.js", { chromium: "", gecko: null }, { home, platform: "linux" }, noRegistry);

      assert.equal(result.installed.length, 0);
      assert.equal(result.errors.length, 1);
      assert.match(result.errors[0].message, /key/);
      assert.equal(fs.existsSync(path.join(home, ".config/google-chrome/NativeMessagingHosts", `${HOST_NAME}.json`)), false);
    });
  });

  it("skips browsers that are not installed", () => {
    withTempHome((home) => {
      const result = installNativeHost("/opt/host.js", IDS, { home, platform: "linux" }, noRegistry);
      assert.equal(result.installed.length, 0);
      assert.ok(result.skipped.length > 0);
    });
  });

  it("reports a registry failure rather than pretending it worked", () => {
    withTempHome((home) => {
      fs.mkdirSync(path.join(home, "Google/Chrome/User Data"), { recursive: true });
      const failing: RegRunner = () => ({ ok: false, out: "access denied" });

      const result = installNativeHost(
        "/opt/host.js",
        IDS,
        { home, platform: "win32", localAppData: home, windowsManifestDir: path.join(home, "nmh") },
        failing,
      );

      assert.equal(result.installed.length, 0);
      assert.equal(result.errors.length, 1);
      assert.match(result.errors[0].message, /access denied/);
    });
  });
});

describe("installNativeHost on Windows", () => {
  it("writes one manifest per engine and a registry value pointing at each", () => {
    withTempHome((home) => {
      fs.mkdirSync(path.join(home, "Google/Chrome/User Data"), { recursive: true });
      fs.mkdirSync(path.join(home, "Microsoft/Edge/User Data"), { recursive: true });
      fs.mkdirSync(path.join(home, "Mozilla/Firefox/Profiles"), { recursive: true });

      const calls: string[][] = [];
      const rec: RegRunner = (args) => {
        calls.push(args);
        return { ok: true, out: "" };
      };

      const result = installNativeHost(
        "C:\\host\\host.js",
        IDS,
        { home, platform: "win32", localAppData: home, appData: home, windowsManifestDir: path.join(home, "nmh") },
        rec,
      );

      const chrome = result.installed.find((t) => t.browser === "Google Chrome");
      const edge = result.installed.find((t) => t.browser === "Microsoft Edge");
      const firefox = result.installed.find((t) => t.browser === "Firefox");
      assert.ok(chrome && edge && firefox, JSON.stringify(result.installed));

      // Both engines share one directory, so the files must not collide.
      assert.notEqual(chrome.manifest, firefox.manifest);
      assert.equal(chrome.registryKey, `Software\\Google\\Chrome\\NativeMessagingHosts\\${HOST_NAME}`);
      assert.equal(edge.registryKey, `Software\\Microsoft\\Edge\\NativeMessagingHosts\\${HOST_NAME}`);
      assert.equal(firefox.registryKey, `Software\\Mozilla\\NativeMessagingHosts\\${HOST_NAME}`);

      // The Chromium file is pinned by origin, the Gecko one by add-on id.
      const chromiumManifest = JSON.parse(fs.readFileSync(chrome.manifest, "utf8"));
      const geckoManifest = JSON.parse(fs.readFileSync(firefox.manifest, "utf8"));
      assert.ok(chromiumManifest.allowed_origins);
      assert.ok(geckoManifest.allowed_extensions);

      assert.equal(calls.length, 3);
      for (const call of calls) {
        assert.equal(call[0], "ADD");
        assert.ok(call[1].startsWith("HKCU\\Software\\"));
      }
    });
  });

  it("clears the registry values and the files on removal", () => {
    withTempHome((home) => {
      fs.mkdirSync(path.join(home, "Google/Chrome/User Data"), { recursive: true });
      const calls: string[][] = [];
      const rec: RegRunner = (args) => {
        calls.push(args);
        return { ok: true, out: "" };
      };
      const options = { home, platform: "win32" as const, localAppData: home, windowsManifestDir: path.join(home, "nmh") };

      installNativeHost("C:\\host\\host.js", IDS, options, rec);
      const removed = removeNativeHost(options, rec);

      assert.ok(removed.length > 0);
      for (const target of removed) assert.equal(fs.existsSync(target.manifest), false);
      assert.ok(calls.some((call) => call[0] === "DELETE"));
    });
  });
});
