import { test } from "node:test";
import assert from "node:assert/strict";
import { buildGraph, extractEvidence, type EntityType } from "./graph";
import type { EvidenceItem } from "./evidence";

function item(partial: Partial<EvidenceItem> & Pick<EvidenceItem, "tool" | "target">): EvidenceItem {
  return {
    id: partial.id ?? "e1",
    status: "ok",
    message: "",
    at: "2026-01-01T00:00:00Z",
    command: "",
    ...partial,
  };
}

function hasType(graph: { nodes: { id: string; type: EntityType }[] }, id: string, type: EntityType): boolean {
  return graph.nodes.some((n) => n.id === id && n.type === type);
}

const sherlockItem = item({
  tool: "sherlock",
  target: "Alex",
  data: {
    found: [
      { site: "GitHub", url: "https://github.com/alex" },
      { site: "Reddit", url: "https://reddit.com/u/alex" },
    ],
  },
});

const digItem = item({
  tool: "dig",
  target: "example.com",
  data: {
    records: [
      { name: "example.com", ttl: 300, type: "A", value: "93.184.216.34" },
      { name: "example.com", ttl: 300, type: "AAAA", value: "2606:2800:220:1::248" },
    ],
  },
});

const nmapItem = item({
  tool: "nmap",
  target: "10.0.0.7",
  data: {
    ports: [
      { port: 22, state: "open", service: "ssh" },
      { port: 80, state: "open", service: "http" },
      { port: 443, state: "closed", service: "https" },
    ],
  },
});

test("normalizes username and links profile hosts", () => {
  const g = extractEvidence(sherlockItem);
  assert.equal(hasType(g, "alex", "username"), true);
  assert.ok(g.nodes.some((n) => n.id === "github.com"));
  assert.ok(g.links.some((l) => l.source === "alex" && l.target === "github.com" && l.kind === "profile"));
});

test("maps DNS A/AAAA records to ip nodes via resolution links", () => {
  const g = extractEvidence(digItem);
  assert.equal(hasType(g, "example.com", "host"), true);
  assert.equal(hasType(g, "93.184.216.34", "ip"), true);
  assert.equal(hasType(g, "2606:2800:220:1::248", "ip"), true);
  assert.ok(g.links.some((l) => l.source === "example.com" && l.target === "93.184.216.34" && l.kind === "resolution"));
});

test("keeps open ports only, as port nodes", () => {
  const g = extractEvidence(nmapItem);
  assert.ok(g.links.length === 2);
  assert.ok(g.nodes.some((n) => n.id === "10.0.0.7:22"));
  assert.equal(g.nodes.some((n) => n.id === "10.0.0.7:443"), false);
});

test("skips pass-through tools (jq, python3)", () => {
  assert.equal(extractEvidence(item({ tool: "jq", target: "{}" })).nodes.length, 0);
  assert.equal(extractEvidence(item({ tool: "python3", target: "x" })).nodes.length, 0);
});

test("pulls emails + usernames from theHarvester", () => {
  const g = extractEvidence(
    item({
      tool: "theHarvester",
      target: "example.com",
      data: { emails: ["alex@example.com"], hosts: ["mail.example.com"] },
    }),
  );
  assert.equal(hasType(g, "alex@example.com", "email"), true);
  assert.equal(hasType(g, "alex", "username"), true);
  assert.equal(hasType(g, "mail.example.com", "host"), true);
});

test("pulls subdomains from dnsrecon and chains to ip", () => {
  const g = extractEvidence(
    item({
      tool: "dnsrecon",
      target: "example.com",
      data: { records: [{ host: "www.example.com", ip: "10.0.0.9" }] },
    }),
  );
  assert.ok(g.links.some((l) => l.source === "example.com" && l.target === "www.example.com" && l.kind === "subdomain"));
  assert.ok(g.links.some((l) => l.source === "www.example.com" && l.target === "10.0.0.9" && l.kind === "resolution"));
});

test("gobuster maps url target to host + discovered paths", () => {
  const g = extractEvidence(
    item({
      tool: "gobuster",
      target: "http://example.com",
      data: { hits: [{ path: "/admin", status: 200, size: 1024 }] },
    }),
  );
  assert.equal(hasType(g, "example.com", "host"), true);
  assert.ok(g.nodes.some((n) => n.id === "example.com/admin"));
  assert.ok(g.links.some((l) => l.source === "example.com" && l.target === "example.com/admin" && l.kind === "path"));
});

test("dedupes nodes and links across evidence records", () => {
  const g = buildGraph([sherlockItem, sherlockItem, digItem, digItem, nmapItem]);
  assert.equal(g.nodes.filter((n) => n.id === "alex").length, 1);
  assert.equal(g.links.filter((l) => l.kind === "profile").length, 2);
});

test("merges shared entities into one graph", () => {
  const g = buildGraph([
    digItem,
    item({
      tool: "theHarvester",
      target: "example.com",
      data: { emails: ["admin@example.com"] },
    }),
    item({
      tool: "whois",
      target: "example.com",
      data: { nameServers: ["ns1.example.com"] },
    }),
  ]);
  assert.equal(g.nodes.filter((n) => n.id === "example.com").length, 1);
  assert.ok(g.links.some((l) => l.kind === "email"));
  assert.ok(g.links.some((l) => l.kind === "ns"));
});