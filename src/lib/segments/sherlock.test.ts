import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidUsername, parseSherlockOutput, buildSherlockArgs } from "./sherlock";

test("valid usernames accepted", () => {
  assert.ok(isValidUsername("octocat"));
  assert.ok(isValidUsername("a"));
  assert.ok(isValidUsername("foo_bar-2.d"));
  assert.ok(isValidUsername("User.Name"));
});

test("invalid usernames rejected", () => {
  assert.ok(!isValidUsername(""));
  assert.ok(!isValidUsername("-leading"));
  assert.ok(!isValidUsername("trailing-"));
  assert.ok(!isValidUsername("."));
  assert.ok(!isValidUsername("x".repeat(33)));
  assert.ok(!isValidUsername("a b"));
  assert.ok(!isValidUsername("a;b"));
});

test("parses found lines", () => {
  const out = [
    "[*] Checking username github on:",
    "[+] GitHub: https://www.github.com/github",
    "[-] Twitter: Not Found!",
    "[+] Reddit: https://www.reddit.com/user/github",
  ].join("\n");
  assert.deepEqual(parseSherlockOutput(out), [
    { site: "GitHub", url: "https://www.github.com/github" },
    { site: "Reddit", url: "https://www.reddit.com/user/github" },
  ]);
});

test("empty output yields no hits", () => {
  assert.deepEqual(parseSherlockOutput(""), []);
});

test("usernames may not start/end with separators", () => {
  assert.ok(!isValidUsername(".hidden"));
  assert.ok(!isValidUsername("a_"));
});

test("args keep only allowed flags and a timeout", () => {
  assert.deepEqual(buildSherlockArgs([], 6, false), []);
  assert.deepEqual(buildSherlockArgs(["--print-found"], 6, false), ["--print-found"]);
  assert.deepEqual(
    buildSherlockArgs(["--print-found", "--no-color", "--timeout"], 12, true),
    ["--print-found", "--no-color", "--timeout", "12"],
  );
});