import { test } from "node:test";
import assert from "node:assert/strict";
import { extractStatusCode, parseCurlHeaders } from "./curl";

test("parses a simple HTTP response", () => {
  const { statusLine, headers } = parseCurlHeaders(
    "HTTP/1.1 200 OK\r\nServer: nginx\r\nContent-Type: text/html\r\n\r\n",
  );
  assert.equal(statusLine, "HTTP/1.1 200 OK");
  assert.deepEqual(headers, [
    { name: "Server", value: "nginx" },
    { name: "Content-Type", value: "text/html" },
  ]);
});

test("redirect chain keeps only the final response headers", () => {
  const { statusLine, headers } = parseCurlHeaders(
    "HTTP/1.1 301 Moved Permanently\r\nLocation: /new\r\n\r\nHTTP/1.1 200 OK\r\nServer: nginx\r\n\r\n",
  );
  assert.equal(statusLine, "HTTP/1.1 200 OK");
  assert.equal(headers.length, 1);
  assert.equal(headers[0].name, "Server");
});

test("set-cookie headers are not exposed in the structured result", () => {
  const { headers } = parseCurlHeaders(
    "HTTP/1.1 200 OK\r\nSet-Cookie: a=1\r\nContent-Type: text/plain\r\n\r\n",
  );
  assert.ok(!headers.some((h) => h.name.toLowerCase() === "set-cookie"));
});

test("extracts the status code from a status line", () => {
  assert.equal(extractStatusCode("HTTP/2 204 No Content"), 204);
  assert.equal(extractStatusCode("HTTP/1.1 404 Not Found"), 404);
  assert.equal(extractStatusCode(""), null);
});

test("parses HTTP/2 style status lines", () => {
  const { statusCode } = { statusCode: extractStatusCode("HTTP/2 200") };
  assert.equal(statusCode, 200);
});