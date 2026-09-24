import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTracerouteOutput, type Hop } from "./traceroute";

test("parses numbered hops with rtt samples", () => {
  const out = [
    "traceroute to example.com (93.184.216.34), 30 hops max, 60 byte packets",
    " 1  192.168.1.1  1.012 ms  0.9 ms  1.1 ms",
    " 2  10.0.0.1  2.5 ms  2.1 ms  2.3 ms",
    " 3  93.184.216.34  12.3 ms  11.9 ms  12.0 ms",
  ].join("\n");
  assert.deepEqual(parseTracerouteOutput(out), [
    { n: 1, ip: "192.168.1.1", rtt: ["1.012", "0.9", "1.1"] },
    { n: 2, ip: "10.0.0.1", rtt: ["2.5", "2.1", "2.3"] },
    { n: 3, ip: "93.184.216.34", rtt: ["12.3", "11.9", "12.0"] },
  ] as Hop[]);
});

test("star hops are preserved", () => {
  const out = [" 1  192.168.1.1  1.0 ms  1.0 ms  1.0 ms", " 2  * * *", " 3  93.184.216.34  12 ms  13 ms  12.1 ms"].join("\n");
  assert.deepEqual(parseTracerouteOutput(out)[1], { n: 2, ip: "*", rtt: ["*"] });
});

test("empty and malformed output yields no hops", () => {
  assert.deepEqual(parseTracerouteOutput(""), []);
  assert.deepEqual(parseTracerouteOutput("traceroute to nowhere (0.0.0.0), 30 hops max"), []);
  assert.deepEqual(parseTracerouteOutput("some random noise"), []);
});