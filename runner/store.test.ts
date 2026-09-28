import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFileBackend, defaultCaseFile } from "./store";
import type { EvidenceItem } from "../src/lib/evidence";

function item(id: string): EvidenceItem {
  return {
    id,
    tool: "dig",
    target: "example.com",
    command: `dig example.com ${id}`,
    status: "ok",
    message: "ok",
    at: "2026-09-28T00:00:00.000Z",
    data: { answers: 1 },
  };
}

function scratch(): { dir: string; file: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "osint-store-"));
  return {
    dir,
    file: join(dir, "nested", "evidence.json"),
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

test("file backend: creates the parent directory and persists across instances", () => {
  const { file, cleanup } = scratch();
  try {
    createFileBackend(file).write([item("a"), item("b")]);

    // A fresh backend stands in for a restarted runner.
    assert.deepEqual(
      createFileBackend(file).read().map((i) => i.id),
      ["a", "b"],
    );
  } finally {
    cleanup();
  }
});

test("file backend: missing file reads as an empty case file", () => {
  const { file, cleanup } = scratch();
  try {
    assert.deepEqual(createFileBackend(file).read(), []);
  } finally {
    cleanup();
  }
});

test("file backend: a truncated case file does not take the runner down", () => {
  const { file, cleanup } = scratch();
  try {
    createFileBackend(file).write([item("a")]);
    writeFileSync(file, '{"id":"a","tool":"dig"', "utf8"); // simulate a crash mid-write
    assert.deepEqual(createFileBackend(file).read(), []);
  } finally {
    cleanup();
  }
});

test("file backend: keeps well-formed entries and drops malformed ones", () => {
  const { file, cleanup } = scratch();
  try {
    createFileBackend(file).write([item("a")]);
    writeFileSync(file, JSON.stringify([item("b"), null, { id: 1 }, { tool: "dig" }]), "utf8");

    assert.deepEqual(
      createFileBackend(file).read().map((i) => i.id),
      ["b"],
    );
  } finally {
    cleanup();
  }
});

test("file backend: reset empties an existing case file but leaves it valid", () => {
  const { file, cleanup } = scratch();
  try {
    createFileBackend(file).write([item("a"), item("b")]);
    createFileBackend(file).reset();

    assert.deepEqual(createFileBackend(file).read(), []);
    assert.equal(readFileSync(file, "utf8"), "[]");
  } finally {
    cleanup();
  }
});

test("file backend: leaves no temp files behind", () => {
  const { dir, file, cleanup } = scratch();
  try {
    const backend = createFileBackend(file);
    for (let n = 0; n < 5; n += 1) backend.write([item(`run-${n}`)]);

    const leftovers = readFileSync(join(dir, "nested", "evidence.json"), "utf8");
    assert.ok(!leftovers.includes(".tmp"));
    assert.equal(readFileSync(file, "utf8").match(/\.tmp/g), null);
  } finally {
    cleanup();
  }
});

test("defaultCaseFile: OSINT_CASE_FILE wins over the project default", () => {
  const previous = process.env.OSINT_CASE_FILE;
  try {
    process.env.OSINT_CASE_FILE = "  /tmp/custom-case.json  ";
    assert.equal(defaultCaseFile(), "/tmp/custom-case.json");
  } finally {
    if (previous === undefined) delete process.env.OSINT_CASE_FILE;
    else process.env.OSINT_CASE_FILE = previous;
  }
});
