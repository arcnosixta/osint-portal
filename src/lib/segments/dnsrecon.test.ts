import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDnsreconArgs, parseDnsreconOutput, DNSRECON_TYPES } from "./dnsrecon";

test("buildDnsreconArgs accepts allowed types and flags", () => {
  assert.deepEqual(buildDnsreconArgs([]), { args: [], type: "std" });
  assert.deepEqual(buildDnsreconArgs(["-t", "brt"]), { args: ["-t", "brt"], type: "brt" });
  assert.deepEqual(buildDnsreconArgs(["-v", "-t", "crt"]), {
    args: ["-v", "-t", "crt"],
    type: "crt",
  });
});

test("buildDnsreconArgs rejects unknown types and args", () => {
  assert.ok("error" in buildDnsreconArgs(["-t", "axfr"]));
  assert.ok("error" in buildDnsreconArgs(["-t"]));
  assert.ok("error" in buildDnsreconArgs(["-t", "std;sh"]));
  assert.ok("error" in buildDnsreconArgs(["-z", "x"]));
  assert.ok("error" in buildDnsreconArgs(["-t", "std", "-z", "x"]));
});

test("DNSRECON_TYPES is the exact supported set", () => {
  assert.deepEqual(DNSRECON_TYPES, ["std", "brt", "crt", "snoop"]);
});

test("parseDnsreconOutput extracts host/IP records", () => {
  const out = `[*] Performing SOA record check...
[*]  Host: ns1.example.com  IP: 192.0.2.1
[*]  Host: ns2.example.com  IP: 192.0.2.2
[*]  Host: www.example.com  IP: 198.51.100.7
[+] 0 records found for google.com NS
[*] Performing additional enumeration...`;
  const records = parseDnsreconOutput(out);
  assert.equal(records.length, 3);
  assert.deepEqual(records[0], { host: "ns1.example.com", ip: "192.0.2.1" });
  assert.equal(records[2].host, "www.example.com");
});

test("parseDnsreconOutput dedupes and ignores garbage", () => {
  const records = parseDnsreconOutput(
    "[*]  Host: a.example.com  IP: 1.1.1.1\n[*]  Host: a.example.com  IP: 1.1.1.1\nnot a record",
  );
  assert.equal(records.length, 1);
  assert.deepEqual(parseDnsreconOutput(""), []);
});