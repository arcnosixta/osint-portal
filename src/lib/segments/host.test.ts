import { test } from "node:test";
import assert from "node:assert/strict";
import { parseHostOutput } from "./host";

const SAMPLE = `example.com has address 172.66.147.243
example.com has IPv6 address 2606:4700:10::ac42:93f3
example.com mail is handled by 0 .
example.com name server a.iana-servers.net.
example.com has TXT record "v=spf1 -all"
alias.example.com is an alias for example.com
example.com has no MX record
`;

test("parses A, AAAA, MX, NS, TXT and CNAME rows", () => {
  const records = parseHostOutput(SAMPLE);
  assert.equal(records.length, 6);
  const [a, aaaa, mx, ns, txt, cname] = records;
  assert.deepEqual(a, { type: "A", value: "172.66.147.243", target: "example.com" });
  assert.deepEqual(aaaa, { type: "AAAA", value: "2606:4700:10::ac42:93f3", target: "example.com" });
  assert.deepEqual(mx, { type: "MX", value: ".", preference: 0, target: "example.com" });
  assert.deepEqual(ns, { type: "NS", value: "a.iana-servers.net.", target: "example.com" });
  assert.equal(txt.type, "TXT");
  assert.equal(cname.value, "example.com");
  assert.deepEqual(cname, { type: "CNAME", value: "example.com", target: "alias.example.com" });
});

test("no-data lines ignored", () => {
  assert.equal(parseHostOutput("example.com has no MX record").length, 0);
  assert.equal(parseHostOutput("").length, 0);
});