import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMaigretArgs, parseMaigretOutput } from "./maigret";

test("buildMaigretArgs accepts allowed options", () => {
  assert.deepEqual(buildMaigretArgs([]), { args: [] });
  assert.deepEqual(buildMaigretArgs(["--print-all", "--timeout", "30"]), {
    args: ["--print-all", "--timeout", "30"],
  });
  assert.deepEqual(buildMaigretArgs(["--retries", "3"]), { args: ["--retries", "3"] });
});

test("buildMaigretArgs rejects file outputs and bad values", () => {
  assert.ok("error" in buildMaigretArgs(["-o", "out.html"]));
  assert.ok("error" in buildMaigretArgs(["--timeout", "0"]));
  assert.ok("error" in buildMaigretArgs(["--timeout", "120"]));
  assert.ok("error" in buildMaigretArgs(["--retries", "99"]));
  assert.ok("error" in buildMaigretArgs(["--sites", "x"]));
});

test("parseMaigretOutput extracts site:url profile pairs", () => {
  const out = `
Starting the search on 2000+ websites...
[+] github.com: https://github.com/bob
[+] twitter.com: https://twitter.com/bob
[+] example.com: https://example.com/bob
Progressing... 45% (bob)
`;
  const found = parseMaigretOutput(out, "bob");
  assert.equal(found.length, 2);
  assert.equal(found[0].site, "github.com");
  assert.equal(found[0].url, "https://github.com/bob");
});

test("parseMaigretOutput ignores dedupe and noise", () => {
  const out = "[+] github.com: https://github.com/bob\n[+] github.com: https://github.com/bob\nspam\n";
  const found = parseMaigretOutput(out, "bob");
  assert.equal(found.length, 1);
  assert.deepEqual(parseMaigretOutput("no urls here", "bob"), []);
});