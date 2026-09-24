import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSublist3rArgs, parseSublist3rOutput } from "./sublist3r";

test("buildSublist3rArgs accepts allowed options", () => {
  assert.deepEqual(buildSublist3rArgs([]), { args: [] });
  assert.deepEqual(buildSublist3rArgs(["-v", "-t", "30"]), { args: ["-v", "-t", "30"] });
  assert.deepEqual(buildSublist3rArgs(["-e", "baidu,yahoo", "-t", "10"]), {
    args: ["-e", "baidu,yahoo", "-t", "10"],
  });
});

test("buildSublist3rArgs rejects bad values and brute without wordlist", () => {
  assert.ok("error" in buildSublist3rArgs(["-t", "500"]));
  assert.ok("error" in buildSublist3rArgs(["-e", "engine;rm"]));
  assert.ok("error" in buildSublist3rArgs(["-b"]));
  assert.ok("error" in buildSublist3rArgs(["-b", "-w", "/nonexistent"]));
  assert.ok("error" in buildSublist3rArgs(["-o", "out.txt"]));
});

test("parseSublist3rOutput collects only subdomains of the target", () => {
  const out = `
[+] Enumerating subdomains of example.com
[+]    www.example.com
[+]    api.example.com
example.net should not count
[+]    mail.example.com
-------------- [ example.net ] -------
[!] No subdomains
[-] Total Unique Subdomains Found: 3
`;
  const found = parseSublist3rOutput(out, "example.com");
  assert.deepEqual(found, ["www.example.com", "api.example.com", "mail.example.com"]);
});

test("parseSublist3rOutput ignores duplicates and malformed lines", () => {
  const found = parseSublist3rOutput("api.example.com\napi.example.com\nnope\n", "example.com");
  assert.deepEqual(found, ["api.example.com"]);
});