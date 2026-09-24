import { test } from "node:test";
import assert from "node:assert/strict";
import { validateArgs } from "./args";

test("flags pass through", () => {
  const r = validateArgs(["-z", "-n"], { flags: ["-z", "-n"] }, "netcat");
  assert.ok(!("error" in r));
  assert.deepEqual(r.args, ["-z", "-n"]);
  assert.deepEqual(r.positionals, []);
});

test("value flags with matching value", () => {
  const r = validateArgs(["-w", "3"], { values: { "-w": /^\d+$/ } }, "netcat");
  assert.ok(!("error" in r));
  assert.deepEqual(r.args, ["-w", "3"]);
});

test("value flag rejects bad value", () => {
  const r = validateArgs(["-w", "abc"], { values: { "-w": /^\d+$/ } }, "netcat");
  assert.ok("error" in r);
  assert.match((r as { error: string }).error, /invalid value for "-w"/);
});

test("value flag without value fails", () => {
  const r = validateArgs(["-w"], { values: { "-w": /^\d+$/ } }, "netcat");
  assert.ok("error" in r);
  assert.match((r as { error: string }).error, /requires a value/);
});

test("positionals collected separately", () => {
  const r = validateArgs(
    ["80,443"],
    { positional: /^[0-9,]+$/, maxPositional: 1 },
    "netcat",
  );
  assert.ok(!("error" in r));
  assert.deepEqual(r.positionals, ["80,443"]);
  assert.deepEqual(r.args, []);
});

test("unknown argument is rejected", () => {
  const r = validateArgs(["-e", "id"], { flags: ["-z"] }, "netcat");
  assert.ok("error" in r);
  assert.match((r as { error: string }).error, /argument not allowed for netcat/);
});

test("too many positionals rejected", () => {
  const r = validateArgs(
    ["80", "443"],
    { positional: /^[0-9,]+$/, maxPositional: 1 },
    "netcat",
  );
  assert.ok("error" in r);
  assert.match((r as { error: string }).error, /too many arguments/);
});

test("empty args are valid", () => {
  const r = validateArgs([], { flags: ["-z"] }, "netcat");
  assert.ok(!("error" in r));
  assert.deepEqual(r.args, []);
  assert.deepEqual(r.positionals, []);
});