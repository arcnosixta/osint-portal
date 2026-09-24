import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMasscanArgs, parseMasscanOutput } from "./masscan";

test("buildMasscanArgs allows scan type, port, rate and top-ports", () => {
  assert.deepEqual(buildMasscanArgs(["-sS", "-v"]), { args: ["-sS", "-v"] });
  assert.deepEqual(buildMasscanArgs(["-p", "1-1024"]), { args: ["-p", "1-1024"] });
  assert.deepEqual(buildMasscanArgs(["-p", "80,443,8080-8090"]), {
    args: ["-p", "80,443,8080-8090"],
  });
  assert.deepEqual(buildMasscanArgs(["-p", "-"]), { args: ["-p", "-"] });
  assert.deepEqual(buildMasscanArgs(["--rate", "500", "--top-ports", "100"]), {
    args: ["--rate", "500", "--top-ports", "100"],
  });
});

test("buildMasscanArgs rejects dangerous or unknown args", () => {
  assert.ok("error" in buildMasscanArgs(["-oJ", "out.json"]));
  assert.ok("error" in buildMasscanArgs(["-iL", "hosts.txt"]));
  assert.ok("error" in buildMasscanArgs(["-p"]));
  assert.ok("error" in buildMasscanArgs(["-p", "1-1024;rm"]));
  assert.ok("error" in buildMasscanArgs(["--rate", "all"]));
  assert.ok("error" in buildMasscanArgs(["-T9"]));
  assert.ok("error" in buildMasscanArgs(["--banners", "--scan"]));
});

test("parseMasscanOutput extracts discovered ports", () => {
  const out = `Starting masscan 1.3.2 (http://bit.ly/14GZzcT) at 2026-09-24 00:01:00 GMT
Initiating SYN Stealth Scan
Scanning 1 hosts [5 ports/host]
Discovered open port 80/tcp on 127.0.0.1
Discovered open port 443/tcp on 127.0.0.1
Discovered open port 8080/tcp on 127.0.0.1
Scanning 1 hosts [5 ports/host]
`;
  const data = parseMasscanOutput(out, "127.0.0.1");
  assert.equal(data.host, "127.0.0.1");
  assert.deepEqual(data.ports.map((p) => p.port), [80, 443, 8080]);
  assert.equal(data.ports[0].ip, "127.0.0.1");
  assert.equal(data.ports[1].protocol, "tcp");
});

test("parseMasscanOutput dedupes and survives garbage", () => {
  const data = parseMasscanOutput(
    "Discovered open port 80/tcp on 127.0.0.1\nDiscovered open port 80/tcp on 127.0.0.1\nhello",
    "127.0.0.1",
  );
  assert.equal(data.ports.length, 1);
  assert.deepEqual(parseMasscanOutput("", "x").ports, []);
});