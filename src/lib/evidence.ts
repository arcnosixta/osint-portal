/**
 * Evidence store — the portal's short-term "case file".
 *
 * Every successful tool run lands a normalized EvidenceItem here. The
 * entity-graph (`src/lib/graph.ts`) and the `/api/evidence` endpoints read from
 * this list. Cap is intentionally small to keep memory bounded; the default
 * backend is in-memory (process-wide), the local runner installs a disk-backed
 * one so the case file survives restarts.
 */

export const EVIDENCE_CAP = 200;

export interface EvidenceItem {
  id: string;
  tool: string;
  target: string;
  command?: string;
  status: "ok" | "error";
  message: string;
  at: string;
  data?: unknown;
}

let evidence: EvidenceItem[] = [];
let seq = 0;
let cache: EvidenceItem[] | null = null;

/**
 * Storage seam for the case file.
 *
 * Defaults to the in-memory list (used by the Next server). The local runner
 * swaps in a disk-backed implementation so evidence survives restarts, which is
 * what makes the graph useful across sessions.
 */
export interface EvidenceBackend {
  read(): EvidenceItem[];
  write(items: EvidenceItem[]): void;
  reset(): void;
}

const memoryBackend: EvidenceBackend = {
  read: () => evidence,
  write: (items) => {
    evidence = items;
  },
  reset: () => {
    evidence = [];
  },
};

let backend: EvidenceBackend = memoryBackend;

export function setEvidenceBackend(next: EvidenceBackend): void {
  backend = next;
  cache = null;
}

function all(): EvidenceItem[] {
  if (cache === null) cache = backend.read();
  return cache;
}

export function recordEvidence(item: Omit<EvidenceItem, "id">): EvidenceItem {
  const entry: EvidenceItem = {
    id: `${Date.now().toString(36)}-${(++seq).toString(36)}`,
    ...item,
  };
  cache = [entry, ...all()].slice(0, EVIDENCE_CAP);
  backend.write(cache);
  return entry;
}

export function listEvidence(): EvidenceItem[] {
  return all();
}

export function clearEvidence(): void {
  seq = 0;
  cache = [];
  backend.reset();
}

export function evidenceCount(): number {
  return all().length;
}

/* istanbul ignore next -- dev/diagnostic only */
export function evidenceSource(): string {
  return backend === memoryBackend ? "in-memory (resets on restart)" : "disk (survives restart)";
}