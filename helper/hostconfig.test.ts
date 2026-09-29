import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { readHostConfig, writeHostConfig } from "./hostconfig.ts";
import { isDependencyFree, launchMode, parseNodeVersion, runArgs } from "./runtime.ts";

function tempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "osint-cfg-"));
}

describe("host config", () => {
  it("records an absolute helper entry and the project root", () => {
    const dir = tempDir();
    try {
      const result = writeHostConfig(path.join(dir, "host.js"));
      assert.equal(result.ok, true);

      const config = readHostConfig(path.join(dir, "host.config.json"));
      assert.ok(config);
      assert.equal(config.command, "node");
      assert.equal(config.cwd, path.resolve(dir, ".."));
      assert.ok(path.isAbsolute(config.args[config.args.length - 1]), "the entry must be absolute");
      assert.ok(config.args[config.args.length - 1].endsWith(path.join("helper", "agent.ts")));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns null for a damaged config", () => {
    const dir = tempDir();
    try {
      fs.writeFileSync(path.join(dir, "host.config.json"), "{ not json");
      assert.equal(readHostConfig(path.join(dir, "host.config.json")), null);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns null when the command is missing", () => {
    const dir = tempDir();
    try {
      fs.writeFileSync(path.join(dir, "host.config.json"), JSON.stringify({ args: [] }));
      assert.equal(readHostConfig(path.join(dir, "host.config.json")), null);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("launch mode", () => {
  it("needs no dependencies on a current Node", () => {
    assert.equal(launchMode("26.8.2"), "node");
    assert.equal(launchMode("24.0.0"), "node");
    assert.equal(launchMode("23.5.0"), "node");
    assert.equal(isDependencyFree("24.0.0"), true);
  });

  it("falls back to tsx below the version that has the resolver hook", () => {
    assert.equal(launchMode("23.4.0"), "tsx");
    assert.equal(launchMode("22.6.0"), "tsx");
    assert.equal(launchMode("20.11.0"), "tsx");
    assert.equal(isDependencyFree("20.11.0"), false);
  });

  it("parses a version, and survives rubbish", () => {
    assert.deepEqual(parseNodeVersion("24.19.0"), { major: 24, minor: 19 });
    assert.deepEqual(parseNodeVersion("nonsense"), { major: 0, minor: 0 });
  });

  it("loads the resolver hook before the entry", () => {
    const args = runArgs("/abs/helper/agent.ts", "24.0.0");
    assert.equal(args[0], "--import");
    assert.ok(args[1].endsWith(path.join("helper", "register.ts")));
    assert.equal(args[args.length - 1], "/abs/helper/agent.ts");
  });

  it("keeps the tsx loader ahead of the entry when falling back", () => {
    const args = runArgs("/abs/helper/agent.ts", "20.11.0");
    assert.deepEqual(args.slice(0, 2), ["--import", "tsx"]);
    assert.equal(args[args.length - 1], "/abs/helper/agent.ts");
  });
});
