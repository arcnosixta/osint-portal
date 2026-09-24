import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildGobusterArgs,
  parseGobusterOutput,
  GOBUSTER_MODES,
} from "./gobuster";

test("buildGobusterArgs accepts a mode and forwarded options", () => {
  assert.deepEqual(buildGobusterArgs(["dir"]), { args: [], mode: "dir" });
  assert.deepEqual(buildGobusterArgs(["dns", "-t", "50"]), { args: ["-t", "50"], mode: "dns" });
  assert.deepEqual(buildGobusterArgs(["vhost", "-k", "-q"]), {
    args: ["-k", "-q"],
    mode: "vhost",
  });
  const wl = buildGobusterArgs(["dir", "-w", "/etc/hosts", "-x", "php,html", "-s", "200,301"]);
  assert.ok("args" in wl && wl.args.length === 6);
});

test("buildGobusterArgs rejects bad modes, wordlists and values", () => {
  assert.ok("error" in buildGobusterArgs(["brute"]));
  assert.ok("error" in buildGobusterArgs(["dir", "-w", "/nonexistent/wl.txt"]));
  assert.ok("error" in buildGobusterArgs(["dir", "-w"]));
  assert.ok("error" in buildGobusterArgs(["dir", "-t", "500"]));
  assert.ok("error" in buildGobusterArgs(["dir", "-x", "php;rm"]));
  assert.ok("error" in buildGobusterArgs(["dir", "-s", "abc"]));
  assert.ok("error" in buildGobusterArgs(["-e", "ext"]));
  assert.ok("error" in buildGobusterArgs([]));
});

test("GOBUSTER_MODES exposes the four supported modes", () => {
  assert.deepEqual(GOBUSTER_MODES, ["dir", "subdomain", "vhost", "dns"]);
});

test("parseGobusterOutput extracts directory hits with status and size", () => {
  const out = `===============================================================
Gobuster v3.6
[+] Url:                     http://127.0.0.1:3000
===============================================================
/admin (Status: 200) [Size: 1024]
/robots.txt (Status: 200) [Size: 300]
/index (Status: 301) [Size: 0] [--> http://127.0.0.1:3000/index/]
Progress: 100 / 100
`;
  const hits = parseGobusterOutput(out, "dir");
  assert.deepEqual(
    hits.map((h) => h.path),
    ["/admin", "/robots.txt", "/index"],
  );
  assert.equal(hits[0].status, 200);
  assert.equal(hits[0].size, 1024);
});

test("parseGobusterOutput extracts subdomain and dns hits", () => {
  const sub = parseGobusterOutput("Found: api.example.com\nFound: www.example.com\n", "subdomain");
  assert.deepEqual(sub.map((h) => h.path), ["api.example.com", "www.example.com"]);
  const dns = parseGobusterOutput(
    "Found: mail.example.com [Status: 200, Size: 50]\n[ERROR] something",
    "dns",
  );
  assert.equal(dns.length, 1);
  assert.equal(dns[0].status, 200);
});