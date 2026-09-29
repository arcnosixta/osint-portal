import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { idsFromManifest } from "./extension-id.ts";
import { projectPath } from "./root.ts";

const ROOT = path.resolve(projectPath());
const ENTRY = path.join(ROOT, "helper", "extension-build.ts");
const OUT = path.join(ROOT, "extension", "dist");

/**
 * Run the build the way a user without node_modules would: plain Node plus the
 * local resolver hook, no tsx.
 *
 * This exact invocation used to exit 0 without building anything. The entry
 * point was detected with `require.main === module`, which is false when Node
 * loads the file as an ES module — so on the runtime this project prefers most,
 * the build command reported success and produced no output. Nothing else in
 * the suite caught it, because the installer imports `buildExtension` and never
 * goes through the entry point.
 */
function runWithBareNode(): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(
    process.execPath,
    [
      "--import",
      path.join(ROOT, "helper", "register.ts"),
      "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
      ENTRY,
    ],
    { cwd: ROOT, encoding: "utf8", timeout: 60_000 },
  );
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

describe("extension build entry point", () => {
  it("builds both browsers when run directly on bare Node", () => {
    fs.rmSync(OUT, { recursive: true, force: true });

    const run = runWithBareNode();

    assert.equal(run.status, 0, `exit status\n${run.stderr}`);
    assert.match(run.stdout, /chrome/, "must report the chrome build");
    assert.match(run.stdout, /firefox/, "must report the firefox build");

    const chrome = path.join(OUT, "chrome", "manifest.json");
    const firefox = path.join(OUT, "firefox", "manifest.json");
    assert.ok(fs.existsSync(chrome), "chrome manifest must exist");
    assert.ok(fs.existsSync(firefox), "firefox manifest must exist");
  });

  it("pins the built manifests to the same ids the host manifest allows", () => {
    fs.rmSync(OUT, { recursive: true, force: true });
    assert.equal(runWithBareNode().status, 0);

    const chrome = JSON.parse(fs.readFileSync(path.join(OUT, "chrome", "manifest.json"), "utf8"));
    const firefox = JSON.parse(fs.readFileSync(path.join(OUT, "firefox", "manifest.json"), "utf8"));

    // The gecko manifest must not carry Chromium's key, or Firefox rejects it.
    assert.equal(firefox.key, undefined, "gecko manifest must not carry a chromium key");
    assert.ok(firefox.browser_specific_settings?.gecko?.id, "gecko id must be present");

    const ids = idsFromManifest(chrome);
    assert.equal(ids.chromium, "mogbkoolkaapdejniedklkdkkcegdlbd");
    assert.equal(idsFromManifest(firefox).gecko, "osint-portal@local.tools");
  });

  it("does not build when the module is merely imported", () => {
    fs.rmSync(OUT, { recursive: true, force: true });

    const result = spawnSync(
      process.execPath,
      [
        "--import",
        path.join(ROOT, "helper", "register.ts"),
        "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
        "--input-type=module",
        "-e",
        'const m = await import("./helper/extension-build.ts"); if (typeof m.buildExtension !== "function") process.exit(3);',
      ],
      { cwd: ROOT, encoding: "utf8", timeout: 60_000 },
    );

    assert.equal(result.status, 0, `exit status\n${result.stderr}`);
    assert.equal(
      fs.existsSync(OUT),
      false,
      "importing the module must not build; the installer calls the function itself",
    );
  });
});
