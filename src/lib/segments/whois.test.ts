import { test } from "node:test";
import assert from "node:assert/strict";
import { parseWhoisOutput, parseWhoisLabel } from "./whois";

const SAMPLE = `% IANA WHOIS server
% for more information on IANA, please visit https://www.iana.org
whois server: some.registry.example

Domain Name: EXAMPLE.COM
Registry Domain ID: 2336799_DOMAIN_COM-VRSN
Registrar: Name Media, LLC.
Domain Status: clientDeleteProhibited
Creation Date: 1995-08-14T04:00:00Z
Registry Expiry Date: 2027-08-13T04:00:00Z
Updated Date: 2022-08-14T07:01:28Z
Name Server: A.IANA-SERVERS.NET
Name Server: B.IANA-SERVERS.NET
`;

test("extracts key registry fields and name servers", () => {
  const r = parseWhoisOutput(SAMPLE);
  assert.equal(r.domain, "EXAMPLE.COM");
  assert.equal(r.registrar, "Name Media, LLC.");
  assert.equal(r.creationDate, "1995-08-14T04:00:00Z");
  assert.equal(r.expiryDate, "2027-08-13T04:00:00Z");
  assert.deepEqual(r.nameServers, ["A.IANA-SERVERS.NET", "B.IANA-SERVERS.NET"]);
});

test("falls back to whois-server section for unknown registrar blocks", () => {
  const r = parseWhoisOutput("whois server: fallback.registry\nRegistry Expiry Date: 2028-01-01\n");
  assert.equal(r.domain, "fallback.registry");
  assert.equal(r.expiryDate, "2028-01-01");
});

test("empty output yields empty result", () => {
  const r = parseWhoisOutput("");
  assert.equal(r.domain, undefined);
  assert.deepEqual(r.nameServers, []);
});

test("label cleanup trims quotes and repeated spaces", () => {
  assert.equal(parseWhoisLabel(' "  Two  Words  " '), "Two Words");
});