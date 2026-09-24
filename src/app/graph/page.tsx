"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Eraser,
  RefreshCw,
  TerminalSquare,
  Users,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import GraphCanvas, { NODE_COLORS, NODE_TYPES } from "@/components/graph/GraphCanvas";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { gsap } from "@/lib/animations";
import { cn } from "@/lib/utils";
import type { EntityType } from "@/lib/graph";

interface GraphPayload {
  ok: boolean;
  count: number;
  nodes: { id: string; label: string; type: EntityType }[];
  links: { source: string; target: string; kind: string }[];
}

const NEXT_TOOLS: Partial<Record<EntityType, string[]>> = {
  username: ["sherlock", "maigret"],
  domain: ["whois", "sublist3r", "dnsrecon", "theHarvester"],
  host: ["dig", "openssl", "curl", "gobuster"],
  ip: ["nmap", "masscan", "netcat", "traceroute"],
  email: ["theHarvester"],
  url: ["curl", "gobuster"],
  port: ["nmap", "netcat"],
};

const GRAPH_KEY = "osint-portal-graph";
const LAYOUT_KEY = "osint-portal-graph-layout";
const EMPTY_PAYLOAD: GraphPayload = { ok: true, count: 0, nodes: [], links: [] };

function readLocal<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota/oversize */
  }
}

function removeLocal(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function isPayload(x: unknown): x is GraphPayload {
  if (!x || typeof x !== "object") return false;
  const o = x as { nodes?: unknown; links?: unknown };
  return Array.isArray(o.nodes) && Array.isArray(o.links);
}

type GraphSource = "server" | "local";

export default function GraphPage() {
  const { dict } = useLanguage();
  const t = dict.graph;
  const [payload, setPayload] = useState<GraphPayload | null>(null);
  const cached = useRef<GraphPayload | null>(null);
  useEffect(() => {
    if (!cached.current) {
      const p = readLocal<unknown>(GRAPH_KEY);
      if (isPayload(p) && p.count > 0) cached.current = p;
    }
  }, []);
  const [source, setSource] = useState<GraphSource>("server");
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

const load = useCallback(
  async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setBusy(true);
    try {
      const res = await fetch("/api/graph", { cache: "no-store" });
      const json = (await res.json()) as GraphPayload;
      if (!res.ok || !json.ok) throw new Error("bad response");
      if (json.count > 0) {
        writeLocal(GRAPH_KEY, json);
        cached.current = json;
        setPayload(json);
        setSource("server");
        setError(null);
      } else if (cached.current && cached.current.count > 0) {
        setPayload(cached.current);
        setSource("local");
        setError(null);
      } else {
        cached.current = null;
        setPayload(EMPTY_PAYLOAD);
        setSource("server");
        setError(null);
      }
    } catch {
      if (cached.current && cached.current.count > 0) {
        setPayload(cached.current);
        setSource("local");
        setError(null);
      } else {
        setError(dict.workbench.networkError);
      }
    } finally {
      if (!opts?.silent) setBusy(false);
    }
  },
  [dict.workbench.networkError],
);

useEffect(() => {
  let alive = true;
  fetch("/api/graph", { cache: "no-store" })
    .then((res) => res.json())
    .then((json: GraphPayload) => {
      if (!alive) return;
      if (json.ok && json.count > 0) {
        writeLocal(GRAPH_KEY, json);
        cached.current = json;
        setPayload(json);
        setSource("server");
      } else if (cached.current && cached.current.count > 0) {
        setPayload(cached.current);
        setSource("local");
      } else {
        cached.current = null;
        setPayload(EMPTY_PAYLOAD);
        setSource("server");
      }
      setError(null);
    })
    .catch(() => {
      if (!alive) return;
      if (cached.current && cached.current.count > 0) {
        setPayload(cached.current);
        setSource("local");
        setError(null);
      } else {
        setError(dict.workbench.networkError);
      }
    });
  return () => {
    alive = false;
  };
}, [dict.workbench.networkError]);

const clearEvidence = useCallback(async () => {
  setBusy(true);
  try {
    await fetch("/api/evidence", { method: "DELETE" });
    removeLocal(GRAPH_KEY);
    removeLocal(LAYOUT_KEY);
    cached.current = null;
    setPayload(EMPTY_PAYLOAD);
    setSelected(null);
    setSource("server");
    setError(null);
  } finally {
    setBusy(false);
  }
}, []);

const restoreLayout = useMemo(() => {
  const raw = readLocal<unknown>(LAYOUT_KEY);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: Record<string, { x: number; y: number }> = {};
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    const p = v as { x?: unknown; y?: unknown };
    if (
      typeof p === "object" &&
      p !== null &&
      typeof p.x === "number" &&
      typeof p.y === "number" &&
      Number.isFinite(p.x) &&
      Number.isFinite(p.y)
    ) {
      out[id] = { x: p.x, y: p.y };
    }
  }
  return Object.keys(out).length ? out : null;
}, []);

const persistLayout = useCallback((layout: Record<string, { x: number; y: number }>) => {
  writeLocal(LAYOUT_KEY, layout);
}, []);

  // entrance animation
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const ctx = gsap.context(() => {
      gsap.from("[data-graph-head]", { y: 28, autoAlpha: 0, duration: 0.7, ease: "power3.out", stagger: 0.08 });
    }, root);
    return () => ctx.revert();
  }, []);

  const nodes = useMemo(() => payload?.nodes ?? [], [payload]);
  const links = useMemo(() => payload?.links ?? [], [payload]);
  const selectedNode = useMemo(
    () => (selected ? nodes.find((n) => n.id === selected) ?? null : null),
    [selected, nodes],
  );
  const neighbors = useMemo(
    () =>
      selectedNode
        ? links
            .filter((l) => l.source === selectedNode.id || l.target === selectedNode.id)
            .map((l) => ({ id: l.source === selectedNode.id ? l.target : l.source, kind: l.kind }))
        : [],
    [selectedNode, links],
  );
  const suggestions = selectedNode ? NEXT_TOOLS[selectedNode.type] ?? [] : [];

  return (
    <>
      <Navbar />
      <main ref={rootRef} className="relative min-h-screen pt-24 pb-16">
        <div className="mx-auto w-full max-w-6xl px-6 sm:px-10">
          {/* head */}
          <div data-graph-head className="max-w-2xl">
            <p className="font-mono text-xs font-medium uppercase tracking-[0.45em] text-primary glow-soft">
              {t.kicker}
            </p>
            <h1 className="mt-4 font-sans text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              {t.title}
            </h1>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
              {t.subtitle}
            </p>
          </div>

          {/* toolbar */}
          <div data-graph-head className="mt-8 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1.5 font-mono text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary pulse-soft" />
              {payload?.count ?? 0} {t.evidence} · {nodes.length} {t.nodes} · {links.length} {t.links}
            </span>
            {source === "local" && (
              <span className="inline-flex items-center gap-2 rounded-full border border-dashed border-accent/50 bg-accent/5 px-3 py-1.5 font-mono text-xs text-accent">
                {t.local}
              </span>
            )}
            <button
              onClick={() => void load()}
              disabled={busy}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", busy && "animate-spin")} aria-hidden="true" />
              {t.refresh}
            </button>
            <button
              onClick={() => void clearEvidence()}
              disabled={busy || !payload?.count}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:border-accent/60 hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Eraser className="h-3.5 w-3.5" aria-hidden="true" />
              {t.clear}
            </button>
            <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">
              {t.legend}
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {NODE_TYPES.map((type) => (
                <span
                  key={type}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: NODE_COLORS[type] }} />
                  {t.types[type]}
                </span>
              ))}
            </div>
          </div>

          {/* body */}
          <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            {/* canvas */}
            <div className="min-h-[58vh]">
              {error ? (
                <div className="flex h-[50vh] flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card/40 text-center">
                  <TerminalSquare className="h-8 w-8 text-accent" aria-hidden="true" />
                  <p className="max-w-sm font-mono text-sm text-muted-foreground">{error}</p>
                  <button onClick={() => void load()} className="cursor-pointer rounded-lg border border-primary/50 px-4 py-2 font-mono text-xs text-primary transition-colors hover:bg-primary/10">
                    {t.refresh}
                  </button>
                </div>
              ) : payload && payload.nodes.length === 0 ? (
                <div className="flex h-[50vh] flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card/40 text-center">
                  <Users className="h-8 w-8 text-muted-foreground/40" aria-hidden="true" />
                  <p className="font-mono text-sm font-semibold text-foreground">{t.emptyTitle}</p>
                  <p className="max-w-sm text-sm text-muted-foreground">{t.emptyDesc}</p>
                  <Link
                    href="/#tools"
                    className="mt-1 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-5 py-2.5 font-mono text-xs font-semibold text-black transition-all hover:bg-primary-dim"
                  >
                    {t.openTools}
                  </Link>
                </div>
              ) : (
                <GraphCanvas
                  graph={{ nodes, links }}
                  onSelect={(node) => setSelected(node ? node.id : null)}
                  selectedId={selected}
                  initialLayout={restoreLayout}
                  onLayout={persistLayout}
                  ariaLabel={t.title}
                  className="h-[58vh] w-full overflow-hidden rounded-xl border border-border bg-black/30 lg:h-[72vh]"
                />
              )}
            </div>

            {/* detail panel */}
            <aside className="flex flex-col gap-6 lg:sticky lg:top-24">
              <div className="overflow-hidden rounded-xl border border-border bg-card/40 backdrop-blur-sm">
                <div className="flex items-center gap-2 border-b border-border px-5 py-4 font-mono text-sm text-foreground">
                  <TerminalSquare className="h-4 w-4 text-primary" aria-hidden="true" />
                  {t.neighbors}
                </div>
                <div className="flex flex-col gap-4 p-5">
                  {selectedNode ? (
                    <>
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                          {t.types[selectedNode.type]}
                        </p>
                        <p className="mt-1 break-words font-mono text-lg font-semibold text-foreground">
                          {selectedNode.label}
                        </p>
                      </div>

                      {neighbors.length > 0 && (
                        <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto">
                          {neighbors.map((n) => (
                            <li key={`${n.kind}:${n.id}`}>
                              <button
                                onClick={() => setSelected(n.id)}
                                className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-md border border-border bg-black/40 px-3 py-2 text-left transition-colors hover:border-primary/50"
                              >
                                <span className="truncate font-mono text-xs text-foreground/85">{n.id}</span>
                                <span className="shrink-0 rounded border border-border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                                  {n.kind}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}

                      {suggestions.length > 0 && (
                        <div>
                          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                            {t.next}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {suggestions.map((id) => (
                              <Link
                                key={id}
                                href={`/tools/${id}`}
                                className="rounded-md border border-primary/40 bg-primary/5 px-2.5 py-1.5 font-mono text-[11px] text-primary transition-colors hover:bg-primary hover:text-black"
                              >
                                {id}
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="font-mono text-xs text-muted-foreground/60">{t.select}</p>
                  )}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}