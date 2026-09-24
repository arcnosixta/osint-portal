import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseNetcatPortList,
  classifyNetcatOutput,
} from "./netcat";

test("port list accepts comma ints", () => {
  assert.deepEqual(parseNetcatPortList("80,443"), [80, 443]);
  assert.deepEqual(parseNetcatPortList("22"), [22]);
});

test("port list rejects ranges", () => {
  assert.equal(parseNetcatPortList("1-1024"), null);
});

test("port list rejects zero, out-of-range and too many ports", () => {
  assert.equal(parseNetcatPortList("0"), null);
  assert.equal(parseNetcatPortList("70000"), null);
  assert.equal(parseNetcatPortList(Array.from({ length: 26 }, (_, i) => i + 1).join(",")), null);
});

test("open port output classified", () => {
  const out = [
    "Ncat: Version 7.95 ( https://nmap.org/ncat )",
    "Ncat: Connected to 127.0.0.1:3111.",
    "Ncat: 0 bytes sent, 0 bytes received in 0.02 seconds.",
  ].join("\n");
  assert.deepEqual(classifyNetcatOutput(out), { state: "open", detail: "connected" });
});

test("closed port output classified", () => {
  assert.deepEqual(classifyNetcatOutput("Ncat: Connection refused."), {
    state: "closed",
    detail: "connection refused",
  });
});

test("no-response output classified as filtered", () => {
  assert.deepEqual(
    classifyNetcatOutput("Ncat: Connection timed out."),
    { state: "filtered", detail: "no response" },
  );
  assert.deepEqual(
    classifyNetcatOutput("Ncat: No route to host."),
    { state: "filtered", detail: "no response" },
  );
});

test("unresolvable host classified as error", () => {
  assert.deepEqual(
    classifyNetcatOutput("ncat: Could not resolve hostname 'nope.invalid': Name or service not known"),
    { state: "error", detail: "unresolvable" },
  );
});