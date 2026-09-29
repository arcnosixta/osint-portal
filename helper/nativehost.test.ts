import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";

import { HOST_NAME, extensionIdFromPath, installNativeHost, removeNativeHost, targetDirs } from "./nativehost";
import { readHostConfig, writeHostConfig } from "./hostconfig";

/** Redirect the home directory so targetDirs() writes into a sandbox. */
function withTempHome<T>(fn: (home: string) => T): T {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "osint-home-"));
  const previous = process.env.HOME;
  process.env.HOME = home;
  try {
    return fn(home);
  } finally {
    process.env.HOME = previous;
    fs.rmSync(home, { recursive: true, force: true });
  }
}

after(() => {
  // Never leave a real host manifest behind from a test run.
  removeNativeHost();
});

describe("extensionIdFromPath", () => {
  it("maps the digest into the a-p alphabet Chromium uses", () => {
    const id = extensionIdFromPath("extension/dist/chrome");
    assert.equal(id.length, 32);
    assert.ok(/^[a-p]{32}$/.test(id), `unexpected id: ${id}`);
  });

  it("is stable for the same directory", () => {
    assert.equal(extensionIdFromPath("/tmp/x"), extensionIdFromPath("/tmp/x"));
  });

  it("differs between the chrome and firefox builds", () => {
    assert.notEqual(extensionIdFromPath("extension/dist/chrome"), extensionIdFromPath("extension/dist/firefox"));
  });
});

describe("installNativeHost", () => {
  it("writes a manifest for every browser directory that exists", () => {
    withTempHome((home) => {
      const chromeDir = path.join(home, ".config/google-chrome/NativeMessagingHosts");
      fs.mkdirSync(chromeDir, { recursive: true });

      const result = installNativeHost("/opt/host.js", [], path.join(home, "ext"));

      assert.equal(result.installed.length, 1);
      assert.equal(result.installed[0].browser, "Google Chrome");

      const manifest = JSON.parse(fs.readFileSync(path.join(chromeDir, `${HOST_NAME}.json`), "utf8"));
      assert.equal(manifest.name, HOST_NAME);
      assert.equal(manifest.path, "/opt/host.js");
      assert.equal(manifest.type, "stdio");
      assert.deepEqual(manifest.allowed_origins, [`chrome-extension://${extensionIdFromPath(path.join(home, "ext"))}/`]);
    });
  });

  it("skips browsers that are not installed", () => {
    withTempHome(() => {
      const result = installNativeHost("/opt/host.js");
      assert.equal(result.installed.length, 0);
      assert.ok(result.skipped.length > 0);
    });
  });

  it("omits allowed_origins when no extension directory is given", () => {
    withTempHome((home) => {
      fs.mkdirSync(path.join(home, ".config/chromium/NativeMessagingHosts"), { recursive: true });
      installNativeHost("/opt/host.js");
      const manifest = JSON.parse(
        fs.readFileSync(path.join(home, ".config/chromium/NativeMessagingHosts", `${HOST_NAME}.json`), "utf8"),
      );
      assert.equal(manifest.allowed_origins, undefined);
    });
  });

  it("removes what it wrote", () => {
    withTempHome((home) => {
      const dir = path.join(home, ".config/chromium/NativeMessagingHosts");
      fs.mkdirSync(dir, { recursive: true });
      installNativeHost("/opt/host.js");
      const removed = removeNativeHost();
      assert.equal(removed.length, 1);
      assert.equal(fs.existsSync(path.join(dir, `${HOST_NAME}.json`)), false);
    });
  });
});

describe("targetDirs", () => {
  it("covers Chromium and Gecko browsers on linux", () => {
    const browsers = targetDirs("linux").map((t) => t.browser);
    assert.ok(browsers.includes("Google Chrome"));
    assert.ok(browsers.includes("Chromium"));
    assert.ok(browsers.includes("Microsoft Edge"));
    assert.ok(browsers.includes("Firefox"));
  });

  it("puts macOS browsers under Application Support", () => {
    const chrome = targetDirs("darwin").find((t) => t.browser === "Google Chrome");
    assert.ok(chrome);
    assert.ok(chrome.manifest.includes("Application Support"), chrome.manifest);
  });
});

describe("host config", () => {
  it("round-trips the helper command", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "osint-cfg-"));
    const result = writeHostConfig(path.join(dir, "host.js"));
    assert.equal(result.ok, true);
    const config = readHostConfig(path.join(dir, "host.config.json"));
    assert.ok(config);
    assert.deepEqual(config?.args, ["tsx", "helper/agent.ts"]);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("returns null for a damaged config", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "osint-cfg-"));
    fs.writeFileSync(path.join(dir, "host.config.json"), "{ not json");
    assert.equal(readHostConfig(path.join(dir, "host.config.json")), null);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("returns null when the command is missing", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "osint-cfg-"));
    fs.writeFileSync(path.join(dir, "host.config.json"), JSON.stringify({ args: [] }));
    assert.equal(readHostConfig(path.join(dir, "host.config.json")), null);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
