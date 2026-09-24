import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPython3Args, parsePython3Output } from "./python3";

test("buildPython3Args allows only version probes", () => {
  assert.deepEqual(buildPython3Args([]), { args: [] });
  assert.deepEqual(buildPython3Args(["--version"]), { args: ["--version"] });
  assert.deepEqual(buildPython3Args(["-V"]), { args: ["-V"] });
});

test("buildPython3Args blocks arbitrary code and scripts", () => {
  assert.ok("error" in buildPython3Args(["-c", "'print(1)'"]));
  assert.ok("error" in buildPython3Args(["tool.py", "target"]));
  assert.ok("error" in buildPython3Args(["-O", "x"]));
  assert.ok("error" in buildPython3Args(["../evil.sh"]));
});

test("parsePython3Output extracts version from stdout or stderr", () => {
  assert.deepEqual(parsePython3Output("Python 3.11.8\n", ""), { python: "Python 3.11.8" });
  assert.deepEqual(parsePython3Output("", "Python 3.12.3\n"), { python: "Python 3.12.3" });
  assert.deepEqual(parsePython3Output("", ""), { python: "unknown" });
});