import { test } from "node:test";
import assert from "node:assert/strict";
import { buildNmapArgs, parseNmapOutput, NmapData } from "./nmap";

test("buildNmapArgs allows whitelisted flags and values", () => {
  assert.deepEqual(buildNmapArgs(["-sV", "-sC"]), { args: ["-sV", "-sC"] });
  assert.deepEqual(buildNmapArgs(["-p", "1-1024", "--open"]), {
    args: ["-p", "1-1024", "--open"],
  });
  assert.deepEqual(buildNmapArgs(["-p", "80,443,8080-8090"]), { args: ["-p", "80,443,8080-8090"] });
  assert.deepEqual(buildNmapArgs(["-p", "-"]), { args: ["-p", "-"] });
  assert.deepEqual(buildNmapArgs(["--top-ports", "100", "-T4", "-vv"]), {
    args: ["--top-ports", "100", "-T4", "-vv"],
  });
});

test("buildNmapArgs rejects dangerous or unknown args", () => {
  assert.ok("error" in buildNmapArgs(["-oN", "out.txt"]));
  assert.ok("error" in buildNmapArgs(["--script", "-sC"]));
  assert.ok("error" in buildNmapArgs(["-iL", "/etc/hosts"]));
  assert.ok("error" in buildNmapArgs(["-p"]));
  assert.ok("error" in buildNmapArgs(["-p", "1-1024;rm"]));
  assert.ok("error" in buildNmapArgs(["--top-ports", "all"]));
  assert.ok("error" in buildNmapArgs(["-T"]));
  assert.ok("error" in buildNmapArgs(["-T9"]));
  assert.ok("error" in buildNmapArgs(["--random-host"]));
});

const SAMPLE = `Starting Nmap 7.94 ( https://nmap.org ) at 2026-09-24 12:00 UTC
Nmap scan report for 127.0.0.1
Host is up (0.0001s latency).

PORT      STATE  SERVICE
22/tcp    open   ssh
25/tcp    closed smtp
80/tcp    open   http
443/tcp   open   https
8888/tcp  filtere

Nmap done: 1 IP address (1 host up) scanned in 0.05 seconds
`;

test("parseNmapOutput extracts host, open ports and summary", () => {
  const data: NmapData = parseNmapOutput(SAMPLE);
  assert.equal(data.ip, "127.0.0.1");
  assert.equal(data.host, "127.0.0.1");
  assert.equal(data.hostsUp, "1");
  assert.deepEqual(data.ports.map((p) => p.port), [22, 25, 80, 443]);
  const open = data.ports.filter((p) => p.state === "open");
  assert.equal(open.length, 3);
  assert.deepEqual(open.map((p) => p.service), ["ssh", "http", "https"]);
});

test("parseNmapOutput handles CIDR report where host is an IP", () => {
  const out = `Nmap scan report for 10.0.0.7
Host is up (0.01s latency).
PORT     STATE  SERVICE
53/tcp   open   domain
Nmap done: 1 IP address (1 host up) scanned`;
  const data = parseNmapOutput(out);
  assert.equal(data.ip, "10.0.0.7");
  assert.equal(data.ports[0].service, "domain");
});

test("parseNmapOutput survives malformed output", () => {
  const empty = parseNmapOutput("");
  assert.deepEqual(empty, { ports: [] } as NmapData);
  const garbage = parseNmapOutput("hello\nworld\n");
  assert.deepEqual(garbage.ports, []);
});