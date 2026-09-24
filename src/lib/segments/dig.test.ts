import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDigOutput } from "./dig";

const SAMPLE = `; <<>> DiG 9.20.5-Debian <<>> example.com +noall +answer
;; global options: +cmd
example.com.\t300\tIN\tA\t172.66.147.243
example.com.\t300\tIN\tA\t104.20.23.154
example.com.\t300\tIN\tMX\t0\texample.com.
`;
// note the TXT line is folded onto a continuation line, which must be skipped
const TXT_SAMPLE = `example.com.\t300\tIN\tTXT\t"v=spf1 -all"
\t"additional fold"`;

test("parses A and MX records", () => {
  const records = parseDigOutput(SAMPLE);
  assert.equal(records.length, 3);
  assert.deepEqual(records[0], {
    name: "example.com.",
    ttl: 300,
    type: "A",
    value: "172.66.147.243",
  });
  assert.equal(records[2].type, "MX");
  assert.equal(records[2].value, "0\texample.com.");
});

test("skips comments and folded TXT continuation lines", () => {
  const records = parseDigOutput(TXT_SAMPLE);
  assert.equal(records.length, 1);
  assert.equal(records[0].type, "TXT");
});

test("empty/no-record output yields zero records", () => {
  assert.deepEqual(parseDigOutput(""), []);
  assert.deepEqual(parseDigOutput(";; nothing here\n"), []);
});

test("+short mode surfaces bare values", () => {
  const records = parseDigOutput("172.66.147.243\n104.20.23.154\n", true);
  assert.equal(records.length, 2);
  assert.equal(records[0].type, "value");
  assert.equal(records[0].value, "172.66.147.243");
});