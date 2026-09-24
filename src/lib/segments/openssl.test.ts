import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseTarget,
  extractPem,
  parseHandshake,
  parseX509Output,
} from "./openssl";

test("target defaults to port 443", () => {
  assert.deepEqual(parseTarget("example.com"), { host: "example.com", port: 443 });
});

test("target with explicit port", () => {
  assert.deepEqual(parseTarget("example.com:8443"), { host: "example.com", port: 8443 });
});

test("IPv4 target accepted", () => {
  assert.deepEqual(parseTarget("127.0.0.1:3000"), { host: "127.0.0.1", port: 3000 });
});

test("IPv6 literals rejected", () => {
  assert.ok("error" in parseTarget("[::1]:443"));
  assert.ok("error" in parseTarget("2001:db8::1"));
});

test("out-of-range ports rejected", () => {
  assert.ok("error" in parseTarget("example.com:0"));
  assert.ok("error" in parseTarget("example.com:70000"));
  assert.ok("error" in parseTarget("example.com:abc"));
});

test("extractPem finds the first certificate block", () => {
  const out = [
    "Certificate chain",
    " 0 s:CN=example.com",
    "-----BEGIN CERTIFICATE-----",
    "AAAA",
    "-----END CERTIFICATE-----",
    "-----BEGIN CERTIFICATE-----",
    "BBBB",
    "-----END CERTIFICATE-----",
  ].join("\n");
  assert.equal(extractPem(out), "-----BEGIN CERTIFICATE-----\nAAAA\n-----END CERTIFICATE-----");
});

test("extractPem returns null without a block", () => {
  assert.equal(extractPem("connect: Connection refused"), null);
  assert.equal(extractPem("-----BEGIN CERTIFICATE-----\nAAAA"), null);
});

test("parseHandshake reads New, Protocol and Verify lines", () => {
  const out = [
    "New, TLSv1.3, Cipher is TLS_AES_256_GCM_SHA384",
    "Server public key is 256 bit",
    "Verify return code: 0 (ok)",
  ].join("\n");
  assert.deepEqual(parseHandshake(out), {
    protocol: "TLSv1.3",
    cipher: "TLS_AES_256_GCM_SHA384",
    verify: "ok",
  });
});

test("parseHandshake falls back to Protocol/Cipher columns", () => {
  const out = "Protocol  : TLSv1.2\nCipher    : ECDHE-RSA-AES128-GCM-SHA256\nVerify return code: 21 (unable to verify)";
  assert.deepEqual(parseHandshake(out), {
    protocol: "TLSv1.2",
    cipher: "ECDHE-RSA-AES128-GCM-SHA256",
    verify: "unable to verify",
  });
});

test("parseX509Output extracts fields and SAN", () => {
  const out = [
    "subject=CN=example.com",
    "issuer=C=US, O=SSL Corporation, CN=Cloudflare TLS Issuing ECC CA 3",
    "serial=0624D0AB311558780B7D5213B9631831",
    "notBefore=Jul 29 22:10:08 2026 GMT",
    "notAfter=Oct 27 22:17:21 2026 GMT",
    "sha256 Fingerprint=61:53:A9:6F:D1:A6:AB:7F:4D:43:8F:C3:49:32:48:42:99:D0:72:9D:91:40:B3:A1:26:BB:2F:9C:07:B0:22:00",
    "X509v3 Subject Alternative Name:",
    "    DNS:example.com, DNS:*.example.com",
  ].join("\n");
  const parsed = parseX509Output(out, out);
  assert.equal(parsed.subject, "CN=example.com");
  assert.match(parsed.issuer ?? "", /Cloudflare TLS Issuing ECC CA/);
  assert.equal(parsed.serial, "0624D0AB311558780B7D5213B9631831");
  assert.equal(parsed.notAfter, "Oct 27 22:17:21 2026 GMT");
  assert.equal(parsed.fingerprint?.length, 95);
  assert.deepEqual(parsed.san, ["DNS:example.com", "DNS:*.example.com"]);
});