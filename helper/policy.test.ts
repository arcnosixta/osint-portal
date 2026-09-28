import { test } from "node:test";
import assert from "node:assert/strict";
import { isControlOrigin, isProbeRequest, HELPER_PORT, RUNNER_PORT } from "./policy";

/**
 * The helper can start binaries, so these tests pin the one rule that keeps a
 * public website from driving it: control actions come from the local control
 * page and nowhere else.
 */

test("control origin: the helper's own page is allowed", () => {
  assert.equal(isControlOrigin(`http://127.0.0.1:${HELPER_PORT}`), true);
  assert.equal(isControlOrigin(`http://localhost:${HELPER_PORT}`), true);
});

test("control origin: a different loopback port is still local", () => {
  assert.equal(isControlOrigin("http://127.0.0.1:9999"), true);
  assert.equal(isControlOrigin("http://localhost"), true);
});

test("control origin: no Origin header is allowed (curl, protocol handler)", () => {
  assert.equal(isControlOrigin(undefined), true);
  assert.equal(isControlOrigin(null), true);
  assert.equal(isControlOrigin(""), true);
});

test("control origin: a public website is rejected", () => {
  assert.equal(isControlOrigin("https://osint-portal-gamma.vercel.app"), false);
  assert.equal(isControlOrigin("https://evil.example"), false);
  assert.equal(isControlOrigin("http://attacker.local"), false);
});

test("control origin: loopback look-alikes are rejected", () => {
  // A hostname that merely contains "127.0.0.1" is not loopback.
  assert.equal(isControlOrigin("http://127.0.0.1.evil.example:8788"), false);
  assert.equal(isControlOrigin("http://localhost.evil.example:8788"), false);
  // And a non-http scheme on loopback is still not the control page.
  assert.equal(isControlOrigin("https://127.0.0.1:8788"), false);
  assert.equal(isControlOrigin("file://127.0.0.1:8788"), false);
});

test("control origin: junk is rejected rather than throwing", () => {
  assert.equal(isControlOrigin("not a url"), false);
  assert.equal(isControlOrigin("://"), false);
});

test("control origin: sandboxed iframe origin is allowed (local file pages)", () => {
  assert.equal(isControlOrigin("null"), true);
});

test("probe requests: only safe methods are treated as read-only", () => {
  assert.equal(isProbeRequest("GET"), true);
  assert.equal(isProbeRequest("HEAD"), true);
  assert.equal(isProbeRequest("POST"), false);
  assert.equal(isProbeRequest("DELETE"), false);
});

test("ports: the helper and the runner never collide", () => {
  assert.notEqual(HELPER_PORT, RUNNER_PORT);
});
