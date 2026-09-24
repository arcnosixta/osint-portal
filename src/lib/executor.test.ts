import { test } from "node:test";
import assert from "node:assert/strict";
import { runTool } from "./executor";

test("runTool blocks shell metacharacters in args", async () => {
  const r = await runTool({ tool: "python3", args: ["-c", "x;ls"] });
  assert.equal(r.connected, false);
  assert.match(r.message, /argument blocked/i);
});

test("runTool blocks shell metacharacters in target", async () => {
  const r = await runTool({ tool: "python3", target: "x;rm -rf /" });
  assert.equal(r.connected, false);
  assert.match(r.message, /target blocked/i);
});

test("runTool reports unknown tools", async () => {
  const r = await runTool({ tool: "no-such-tool" });
  assert.equal(r.connected, false);
  assert.match(r.message, /unknown tool/);
});