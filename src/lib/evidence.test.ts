import { test } from "node:test";
import assert from "node:assert/strict";
import { beforeEach, afterEach } from "node:test";
import { recordEvidence, listEvidence, clearEvidence, evidenceCount, EVIDENCE_CAP, type EvidenceItem } from "./evidence";

beforeEach(() => clearEvidence());
afterEach(() => clearEvidence());

test("records and lists newest-first", () => {
  recordEvidence({ tool: "dig", target: "example.com", status: "ok", message: "a", at: "1" });
  recordEvidence({ tool: "nmap", target: "10.0.0.7", status: "ok", message: "b", at: "2" });
  const items = listEvidence();
  assert.equal(items.length, 2);
  assert.equal(items[0].tool, "nmap");
  assert.equal(items[1].tool, "dig");
});

test("assigns unique ids", () => {
  const a = recordEvidence({ tool: "dig", target: "x", status: "ok", message: "", at: "1" });
  const b = recordEvidence({ tool: "dig", target: "x", status: "ok", message: "", at: "2" });
  assert.notEqual(a.id, b.id);
});

test("caps at EVIDENCE_CAP keeping the newest", () => {
  for (let i = 0; i < EVIDENCE_CAP + 25; i++) {
    recordEvidence({ tool: "dig", target: `t${i}`, status: "ok", message: "", at: String(i) });
  }
  assert.equal(evidenceCount(), EVIDENCE_CAP);
  assert.equal(listEvidence()[0].target, `t${EVIDENCE_CAP + 24}`);
});

test("persists the data payload for graph extraction", () => {
  const item: EvidenceItem = {
    id: "x",
    tool: "sherlock",
    target: "alex",
    status: "ok",
    message: "",
    at: "1",
    data: { found: [{ site: "GitHub", url: "https://github.com/alex" }] },
  };
  recordEvidence(item);
  assert.deepEqual(listEvidence()[0].data, item.data);
});