import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTheHarvesterArgs, parseTheHarvesterOutput } from "./theHarvester";

test("buildTheHarvesterArgs accepts allowed options", () => {
  assert.deepEqual(buildTheHarvesterArgs([]), { args: [] });
  assert.deepEqual(buildTheHarvesterArgs(["-v", "-l", "50"]), { args: ["-v", "-l", "50"] });
  assert.deepEqual(buildTheHarvesterArgs(["-b", "bing,baidu", "-l", "500"]), {
    args: ["-b", "bing,baidu", "-l", "500"],
  });
});

test("buildTheHarvesterArgs rejects file outputs and bad values", () => {
  assert.ok("error" in buildTheHarvesterArgs(["-f", "out.html"]));
  assert.ok("error" in buildTheHarvesterArgs(["-l", "0"]));
  assert.ok("error" in buildTheHarvesterArgs(["-l", "9999"]));
  assert.ok("error" in buildTheHarvesterArgs(["-b", "all;rm"]));
  assert.ok("error" in buildTheHarvesterArgs(["-c"]));
});

test("parseTheHarvesterOutput extracts emails and hosts", () => {
  const out = `
[*] Target: example.com
[*] Searching in: Bing
Emails found:
----------------------
admin@example.com
webmaster@example.com
not-an-email
----------------------
Hosts found:
----------------------
Host 1: www.example.com
Host 2: mail.example.com
----------------------
[*] Harvesting complete.
`;
  const data = parseTheHarvesterOutput(out, "example.com");
  assert.deepEqual(data.emails, ["admin@example.com", "webmaster@example.com"]);
  assert.deepEqual(data.hosts.sort(), ["mail.example.com", "www.example.com"]);
});

test("parseTheHarvesterOutput survives partial output", () => {
  const data = parseTheHarvesterOutput("", "example.com");
  assert.deepEqual(data.emails, []);
  assert.deepEqual(data.hosts, []);
});