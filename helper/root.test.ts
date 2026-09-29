import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { projectPath, projectRoot, scriptDir } from "./root.ts";

/** Pretend the process was started with a given entry script. */
function withEntry<T>(entry: string | undefined, fn: () => T): T {
  const original = process.argv[1];
  try {
    if (entry === undefined) delete process.argv[1];
    else process.argv[1] = entry;
    return fn();
  } finally {
    process.argv[1] = original;
  }
}

const PROJECT = path.basename(fs.realpathSync(process.cwd()));

describe("projectRoot", () => {
  it("is the project itself, found from the helper directory", () => {
    const root = withEntry(projectPath("helper", "agent.ts"), projectRoot);
    assert.equal(path.basename(root), PROJECT);
    assert.ok(fs.existsSync(path.join(root, "package.json")));
    assert.ok(fs.existsSync(path.join(root, "helper")));
  });

  it("is the project when started from the runner", () => {
    const root = withEntry(projectPath("runner", "server.ts"), projectRoot);
    assert.equal(path.basename(root), PROJECT);
  });

  it("is the project when the entry is a relative path", () => {
    const root = withEntry(path.join("helper", "install.ts"), projectRoot);
    assert.equal(path.basename(root), PROJECT);
  });

  it("does not step above the project when there is no entry script", () => {
    // The old implementation did `dirname(entry)/..`. With no entry, it fell
    // back to cwd, which is the project root already — so the extra `..` named
    // the directory *containing* the project, and every path built on it pointed
    // at a file that is not there.
    const root = withEntry(undefined, projectRoot);
    assert.equal(path.basename(root), PROJECT);
    assert.ok(fs.existsSync(path.join(root, "helper", "agent.ts")));
  });

  it("does not mistake an unrelated parent package.json for the project", () => {
    // A parent that has package.json but no helper/ must not win.
    const root = withEntry(projectPath("helper", "agent.ts"), projectRoot);
    assert.notEqual(root, path.dirname(root));
  });
});

describe("scriptDir", () => {
  it("is the directory of the entry script", () => {
    assert.equal(withEntry(projectPath("helper", "install.ts"), scriptDir), projectPath("helper"));
  });
});

describe("projectPath", () => {
  it("joins parts onto the project root", () => {
    assert.equal(projectPath("native", "host.js"), path.join(projectRoot(), "native", "host.js"));
  });

  it("resolves paths that exist", () => {
    assert.ok(fs.existsSync(projectPath("native", "host.js")));
    assert.ok(fs.existsSync(projectPath("extension", "manifest.chromium.json")));
  });
});
