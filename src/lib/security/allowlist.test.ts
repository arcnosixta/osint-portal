import { test } from "node:test";
import assert from "node:assert/strict";
import { AllowList, ipv6ToBigInt } from "./allowlist";

test("default allow-list contains loopback and private ranges", () => {
  const a = new AllowList([]);
  assert.ok(a.contains("127.0.0.1"));
  assert.ok(a.contains("127.0.0.255"));
  assert.ok(a.contains("10.1.2.3"));
  assert.ok(a.contains("172.16.0.1"));
  assert.ok(a.contains("172.31.255.255"));
  assert.ok(a.contains("192.168.5.5"));
  assert.ok(a.contains("::1"));
  assert.ok(a.contains("localhost"));
});

test("default allow-list rejects public and forged targets", () => {
  const a = new AllowList([]);
  assert.ok(!a.contains("8.8.8.8"));
  assert.ok(!a.contains("93.184.216.34"));
  assert.ok(!a.contains("172.32.0.1"));
  assert.ok(!a.contains("192.169.0.1"));
  assert.ok(!a.contains("example.com"));
  assert.ok(!a.contains(""));
  assert.ok(!a.contains("http://127.0.0.1"));
  assert.ok(!a.contains("127.0.0.1:8080"));
  assert.ok(!a.contains("10.0.0.999"));
});

test("OSINT-style CIDR entries extend the allow-list", () => {
  const a = new AllowList(["0.0.0.0/0", "example.com"]);
  assert.ok(a.contains("8.8.8.8"));
  assert.ok(a.contains("93.184.216.34"));
  assert.ok(a.contains("example.com"));
  assert.ok(a.contains("sub.example.com"));
  assert.ok(!a.contains("example.org"));
  assert.ok(!a.contains("notexample.com"));
});

test("CIDR target must be contained in an allowed block", () => {
  const a = new AllowList(["10.0.0.0/8"]);
  assert.ok(a.contains("10.0.0.0/8"));
  assert.ok(a.contains("10.1.2.0/24"));
  assert.ok(!a.contains("10.0.0.0/7"));
  assert.ok(!a.contains("11.0.0.0/8"));
});

test("narrower allowed blocks contain nothing wider", () => {
  const a = new AllowList(["203.0.113.0/24"]);
  assert.ok(a.contains("203.0.113.7"));
  assert.ok(!a.contains("203.0.114.7"));
  assert.ok(!a.contains("203.0.0.0/16"));
});

test("ipv6ToBigInt parses compressed and embedded forms", () => {
  assert.equal(ipv6ToBigInt("::1"), 1n);
  assert.equal(ipv6ToBigInt("::"), 0n);
  assert.equal(ipv6ToBigInt("fc00::1"), (0xfc00n << 112n) | 1n);
  assert.ok(ipv6ToBigInt("::ffff:192.168.0.1") !== null);
  assert.equal(ipv6ToBigInt("not-an-ip"), null);
  assert.equal(ipv6ToBigInt("1:2:3:4:5:6:7"), null);
  assert.equal(ipv6ToBigInt("2001:db8::1::2"), null);
});