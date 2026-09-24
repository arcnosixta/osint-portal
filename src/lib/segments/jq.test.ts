import { test } from "node:test";
import assert from "node:assert/strict";
import { validateArgs } from "./args";
import { pickFilter } from "./jq";

test("pickFilter defaults to dot", () => {
  assert.equal(pickFilter([]), ".");
  assert.equal(pickFilter([""]), ".");
  assert.equal(pickFilter([" . "]), ".");
});

test("pickFilter keeps a real filter", () => {
  assert.equal(pickFilter([".version"]), ".version");
  assert.equal(pickFilter([".items[0].name"]), ".items[0].name");
});

test("controls accept simple filters, reject flag-like input", () => {
  assert.deepEqual(validateArgs([".items[0]"], { positional: /^[^\-].*$/, maxPositional: 1 }, "jq"), {
    args: [],
    positionals: [".items[0]"],
  });
  assert.ok("error" in validateArgs([".a", ".b"], { positional: /^[^\-].*$/, maxPositional: 1 }, "jq"));
  assert.ok("error" in validateArgs(["-C"], { positional: /^[^\-].*$/, maxPositional: 1 }, "jq"));
});