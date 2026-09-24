"use client";

import { ExternalLink, Info } from "lucide-react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import type { ResultView as ResultViewKind } from "@/lib/workbench";

/**
 * Structured renderer for segment `data` payloads. Each view maps to the
 * shapes produced by the segments (src/lib/segments) with tolerant field
 * access so a slightly different shape still renders gracefully.
 */

interface PortRow {
  port?: number;
  protocol?: string;
  state?: string;
  service?: string;
}

interface RecordRow {
  name?: string;
  ttl?: number;
  type?: string;
  value?: string;
}

interface FoundRow {
  site?: string;
  url?: string;
}

interface WhoisData {
  domain?: string;
  registrar?: string;
  creationDate?: string;
  expiryDate?: string;
  updatedDate?: string;
  nameServers?: string[];
  raw?: string;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="border-b border-border px-3 py-2 text-left font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
      {children}
    </th>
  );
}

function Td({ children, tone }: { children: React.ReactNode; tone?: "ok" | "muted" }) {
  return (
    <td
      className={
        tone === "ok"
          ? "border-b border-border/60 px-3 py-2 font-mono text-[13px] text-primary"
          : tone === "muted"
            ? "border-b border-border/60 px-3 py-2 font-mono text-[13px] text-muted-foreground"
            : "border-b border-border/60 px-3 py-2 font-mono text-[13px] text-foreground/90"
      }
    >
      {children}
    </td>
  );
}

export default function ResultView({
  view,
  data,
}: {
  view: ResultViewKind;
  data: unknown;
}) {
  const { dict } = useLanguage();
  const t = dict.workbench.result;

  if (view === "ports") {
    const ports = asArray<PortRow>((data as { ports?: unknown })?.ports);
    if (ports.length === 0) return <PlainNote text={t.noRows} />;
    return (
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <Th>{t.port}</Th>
              <Th>{t.protocol}</Th>
              <Th>{t.state}</Th>
              <Th>{t.service}</Th>
            </tr>
          </thead>
          <tbody>
            {ports.map((p, i) => (
              <tr key={i} className="transition-colors hover:bg-card/60">
                <Td>{p.port ?? "—"}</Td>
                <Td tone="muted">{p.protocol ?? "—"}</Td>
                <Td tone={p.state === "open" ? "ok" : "muted"}>{p.state ?? "—"}</Td>
                <Td tone="muted">{p.service ?? "—"}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (view === "records") {
    const records = asArray<RecordRow>((data as { records?: unknown })?.records);
    if (records.length === 0) return <PlainNote text={t.noRows} />;
    return (
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <Th>{t.name}</Th>
              <Th>{t.ttl}</Th>
              <Th>{t.type}</Th>
              <Th>{t.value}</Th>
            </tr>
          </thead>
          <tbody>
            {records.map((r, i) => (
              <tr key={i} className="transition-colors hover:bg-card/60">
                <Td tone="muted">{r.name || "—"}</Td>
                <Td tone="muted">{r.ttl ?? "—"}</Td>
                <Td>{r.type ?? "—"}</Td>
                <Td>{r.value ?? "—"}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (view === "found") {
    const found = asArray<FoundRow>((data as { found?: unknown })?.found);
    if (found.length === 0) return <PlainNote text={t.noRows} />;
    return (
      <ul className="flex flex-col">
        {found.map((f, i) => (
          <li key={i} className="border-b border-border/60 last:border-b-0">
            <a
              href={f.url}
              target="_blank"
              rel="noreferrer noopener"
              className="group flex items-center justify-between gap-4 px-2 py-2.5 transition-colors hover:bg-card/60"
            >
              <span className="font-mono text-[13px] text-foreground/90">{f.site || "—"}</span>
              <span className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground transition-colors group-hover:text-primary">
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                {f.url || "—"}
              </span>
            </a>
          </li>
        ))}
      </ul>
    );
  }

  if (view === "whois") {
    const w = data as WhoisData | undefined;
    const fields: { label: string; value: string }[] = [
      { label: t.domain, value: w?.domain ?? "—" },
      { label: t.registrar, value: w?.registrar ?? "—" },
      { label: t.created, value: w?.creationDate ?? "—" },
      { label: t.updated, value: w?.updatedDate ?? "—" },
      { label: t.expires, value: w?.expiryDate ?? "—" },
      { label: t.nameServers, value: (w?.nameServers ?? []).join(", ") || "—" },
    ];
    return (
      <div className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.label} className="rounded-lg border border-border bg-card/50 px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                {f.label}
              </p>
              <p className="mt-1.5 break-words font-mono text-[13px] text-foreground/90">{f.value}</p>
            </div>
          ))}
        </div>
        {w?.raw ? (
          <details className="group rounded-lg border border-border">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-primary">
              <Info className="h-3.5 w-3.5" aria-hidden="true" />
              {t.rawOutput}
            </summary>
            <pre className="scanlines relative max-h-64 overflow-auto px-4 pb-4 font-mono text-xs leading-relaxed text-foreground/80">
              {w.raw}
            </pre>
          </details>
        ) : null}
      </div>
    );
  }

  return null;
}

function PlainNote({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed border-border px-4 py-3 font-mono text-xs text-muted-foreground">
      <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {text}
    </div>
  );
}