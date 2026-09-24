import { isIP } from "node:net";
import type { EvidenceItem } from "./evidence";

/**
 * Entity graph — aggregate evidence into nodes (entities) and links (relations).
 *
 * The graph is derived purely from segment result `data` shapes produced in
 * src/lib/segments. Unknowable or pass-through tools (jq, python3) simply
 * contribute no entities. Everything is normalized and deduped by lowercased id.
 */

export type EntityType = "username" | "domain" | "host" | "ip" | "email" | "url" | "port";

export interface Entity {
  id: string;
  label: string;
  type: EntityType;
}

export interface Edge {
  source: string;
  target: string;
  kind: string;
}

export interface Graph {
  nodes: Entity[];
  links: Edge[];
}

const HOSTNAME_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?)*$/;
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

function norm(id: string): string {
  return id.trim().toLowerCase().replace(/\/$/, "");
}

function isIp(v: string): boolean {
  return isIP(v) !== 0;
}

function hostOfUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const h = u.hostname.toLowerCase();
    return HOSTNAME_RE.test(h) || isIp(h) ? h : null;
  } catch {
    return null;
  }
}

function pushNode(map: Map<string, Entity>, entity: Entity): void {
  if (!map.has(entity.id)) map.set(entity.id, entity);
}

function pushEdge(links: Edge[], seen: Set<string>, a: string, b: string, kind: string): void {
  const [s, t] = [norm(a), norm(b)];
  if (!s || !t || s === t) return;
  const key = `${s}|${t}|${kind}`;
  if (seen.has(key)) return;
  seen.add(key);
  links.push({ source: s, target: t, kind });
}

/** Build one (label, type) entity from a raw value. */
function entity(value: string, type: EntityType): Entity {
  const label = norm(value);
  return { id: label, label, type };
}

interface Collector {
  nodes: Map<string, Entity>;
  links: Edge[];
  seen: Set<string>;
  addNode: (e: Entity) => void;
  addEdge: (a: string, b: string, kind: string) => void;
}

function collector(): Collector {
  const nodes = new Map<string, Entity>();
  const links: Edge[] = [];
  const seen = new Set<string>();
  return {
    nodes,
    links,
    seen,
    addNode: (e) => pushNode(nodes, e),
    addEdge: (a, b, kind) => pushEdge(links, seen, a, b, kind),
  };
}

function portId(host: string, port: unknown): string {
  return `${norm(host)}:${String(port)}`;
}

function portType(): "port" {
  return "port";
}

/** Extract entities/links from a single tool's evidence record. */
export function extractEvidence(item: EvidenceItem): Graph {
  const c = collector();
  const data = (item.data ?? {}) as Record<string, unknown>;

  switch (item.tool) {
    case "sherlock":
    case "maigret": {
      const username = String(item.target ?? "").toLowerCase();
      if (!username) break;
      c.addNode(entity(username, "username"));
      const found = (data.found ?? []) as Array<Record<string, string | undefined>>;
      for (const f of found.slice(0, 80)) {
        const site = (f.site || "").trim().toLowerCase();
        const host = hostOfUrl(f.url || site);
        const hub = host ?? site;
        if (!hub) continue;
        c.addNode(entity(hub, host ? "host" : "url"));
        c.addEdge(username, hub, "profile");
      }
      break;
    }

    case "nmap":
    case "netcat":
    case "masscan": {
      const host = norm(String(item.target ?? ""));
      if (!host) break;
      c.addNode(entity(host, host.includes(".") && !isIp(host) && host !== "localhost" ? "host" : "ip"));
      const ports = (data.ports ?? []) as Array<Record<string, unknown>>;
      for (const p of ports) {
        if (p.state === "closed" || p.state === "filtered") continue;
        c.addNode(entity(portId(host, p.port), portType()));
        c.addEdge(host, portId(host, p.port), "port");
      }
      break;
    }

    case "dig":
    case "host": {
      const host = norm(String(item.target ?? ""));
      if (!host) break;
      c.addNode(entity(host, "host"));
      const records = (data.records ?? []) as Array<Record<string, unknown>>;
      for (const r of records) {
        const value = String(r.value ?? "").trim();
        if (!value) continue;
        if (isIp(value)) {
          c.addNode(entity(value, "ip"));
          c.addEdge(host, value, "resolution");
        } else if (HOSTNAME_RE.test(value) && !value.endsWith(`.${host}`)) {
          c.addNode(entity(value, "host"));
          c.addEdge(host, value, "resolution");
        }
      }
      break;
    }

    case "whois": {
      const domain = String(item.target ?? data.domain ?? "").toLowerCase();
      if (!domain) break;
      c.addNode(entity(domain, "domain"));
      const ns = (data.nameServers ?? []) as string[];
      for (const n of ns.slice(0, 8)) {
        c.addNode(entity(n, "host"));
        c.addEdge(domain, n, "ns");
      }
      break;
    }

    case "dnsrecon": {
      const domain = String(item.target ?? data.domain ?? "").toLowerCase();
      if (!domain) break;
      c.addNode(entity(domain, "domain"));
      const records = (data.records ?? []) as Array<Record<string, string | undefined>>;
      for (const r of records) {
        const host = (r.host || "").toLowerCase();
        const ip = (r.ip || "").trim();
        if (host) {
          c.addNode(entity(host, "host"));
          c.addEdge(domain, host, "subdomain");
        }
        if (host && ip && isIp(ip)) {
          c.addNode(entity(ip, "ip"));
          c.addEdge(host, ip, "resolution");
        }
      }
      break;
    }

    case "sublist3r": {
      const domain = String(item.target ?? data.domain ?? "").toLowerCase();
      if (!domain) break;
      c.addNode(entity(domain, "domain"));
      const subs = (data.subs ?? []) as string[];
      for (const s of subs.slice(0, 100)) {
        const sub = s.toLowerCase();
        if (!sub) continue;
        c.addNode(entity(sub, "host"));
        c.addEdge(domain, sub, "subdomain");
      }
      break;
    }

    case "theHarvester": {
      const domain = String(item.target ?? data.domain ?? "").toLowerCase();
      if (!domain) break;
      c.addNode(entity(domain, "domain"));
      const emails = (data.emails ?? []) as string[];
      for (const e of emails.slice(0, 50)) {
        if (!EMAIL_RE.test(e)) continue;
        const em = e.toLowerCase();
        const local = em.split("@")[0];
        c.addNode(entity(em, "email"));
        c.addNode(entity(local, "username"));
        c.addEdge(domain, em, "email");
        c.addEdge(em, local, "alias");
      }
      const hosts = (data.hosts ?? []) as string[];
      for (const h of hosts.slice(0, 50)) {
        const host = h.toLowerCase();
        if (!host) continue;
        c.addNode(entity(host, "host"));
        c.addEdge(domain, host, "subdomain");
      }
      break;
    }

    case "traceroute": {
      const target = norm(String(item.target ?? ""));
      if (target) c.addNode(entity(target, isIp(target) ? "ip" : "host"));
      const hops = (data.hops ?? []) as Array<Record<string, string | undefined>>;
      const path: string[] = [];
      for (const h of hops) {
        const ip = (h.ip || "").trim();
        if (ip && ip !== "*" && isIp(ip)) path.push(ip);
      }
      const chain = target ? [target, ...path] : [...path];
      for (let i = 0; i < chain.length - 1; i++) {
        const a = chain[i];
        const b = chain[i + 1];
        if (!a || !b) break;
        c.addNode(entity(a, isIp(a) ? "ip" : "host"));
        c.addNode(entity(b, isIp(b) ? "ip" : "host"));
        c.addEdge(a, b, "hop");
      }
      break;
    }

    case "curl": {
      const url = String(data.url ?? item.target ?? "");
      const host = hostOfUrl(url);
      if (!host) break;
      c.addNode(entity(host, isIp(host) ? "ip" : "host"));
      break;
    }

    case "openssl": {
      const host = String(data.host ?? item.target ?? "").split(":")[0].toLowerCase();
      if (!host || !HOSTNAME_RE.test(host)) break;
      c.addNode(entity(host, "host"));
      const san = (data.san ?? []) as string[];
      for (const s of san.slice(0, 20)) {
        const name = s.replace(/^DNS:/, "").replace(/^\*\./, "").toLowerCase();
        if (!HOSTNAME_RE.test(name) || name === host) continue;
        c.addNode(entity(name, "host"));
        c.addEdge(host, name, "san");
      }
      break;
    }

    case "gobuster": {
      const target = String(item.target ?? "");
      const host = hostOfUrl(target) || target.split("/")[0].toLowerCase();
      if (!host) break;
      c.addNode(entity(host, isIp(host) ? "ip" : "host"));
      const hits = (data.hits ?? []) as Array<Record<string, string | number | undefined>>;
      for (const h of hits.slice(0, 60)) {
        const path = String(h.path ?? "");
        if (!path) continue;
        const id = `${host}${path}`;
        c.addNode(entity(id, "url"));
        c.addEdge(host, id, "path");
      }
      break;
    }

    default:
      break;
  }

  return { nodes: [...c.nodes.values()], links: c.links };
}

/** Build the full graph from a list of evidence records (newest first). */
export function buildGraph(evidence: EvidenceItem[]): Graph {
  const nodes = new Map<string, Entity>();
  const links: Edge[] = [];
  const seen = new Set<string>();

  for (const item of evidence) {
    const sub = extractEvidence(item);
    for (const n of sub.nodes) pushNode(nodes, n);
    for (const l of sub.links) {
      const key = `${l.source}|${l.target}|${l.kind}`;
      if (seen.has(key)) continue;
      seen.add(key);
      links.push(l);
    }
  }
  return { nodes: [...nodes.values()], links };
}