import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { ensureHostExecutable } from "./nativehost.ts";
import { projectPath } from "./root.ts";

const HOST = projectPath("native", "host.js");

/**
 * `native/host.js` has to be executable, because the native messaging manifest
 * points at that file directly and the browser runs it. There is no interpreter
 * named in the manifest to fall back on, so a host file without the executable
 * bit is a registration the browser cannot use.
 *
 * The bit is easy to lose quietly: an archive written without Unix modes, a copy
 * onto FAT/exFAT, a restore from a backup that stored only contents. A user can
 * unpack the connector, read a successful install, and still be left with
 * nothing that works.
 */
describe("native host permissions", () => {
  it("is executable in the tree", () => {
    if (process.platform === "win32") return;
    assert.notEqual(
      fs.statSync(HOST).mode & 0o111,
      0,
      "native/host.js must be executable; the browser runs this path",
    );
  });

  it("restores a stripped executable bit", () => {
    if (process.platform === "win32") return;

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "osint-mode-"));
    const copy = path.join(dir, "host.js");
    try {
      fs.copyFileSync(HOST, copy);
      fs.chmodSync(copy, 0o644);
      assert.equal(fs.statSync(copy).mode & 0o111, 0, "precondition: the bit starts stripped");

      const result = ensureHostExecutable(copy, "linux");

      assert.equal(result.ok, true, `expected success, got ${result.detail}`);
      assert.equal(result.changed, true, "it must report that it changed something");
      assert.equal(fs.statSync(copy).mode & 0o111, 0o111, "the bit must be back");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("leaves an executable file alone", () => {
    if (process.platform === "win32") return;

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "osint-mode-"));
    const copy = path.join(dir, "host.js");
    try {
      fs.copyFileSync(HOST, copy);
      fs.chmodSync(copy, 0o755);

      const result = ensureHostExecutable(copy, "linux");

      assert.equal(result.ok, true);
      assert.equal(result.changed, false, "nothing to do, so nothing should be claimed");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reports failure for a file that does not exist, instead of claiming success", () => {
    const result = ensureHostExecutable(path.join(os.tmpdir(), "osint-not-here", "host.js"), "linux");
    assert.equal(result.ok, false);
    assert.equal(result.changed, false);
  });

  it("is a no-op on Windows, which has no executable bit", () => {
    const result = ensureHostExecutable("/definitely/not/here/host.js", "win32");
    assert.equal(result.ok, true, "Windows launches the host by association; nothing to fix");
    assert.equal(result.changed, false);
  });
});
