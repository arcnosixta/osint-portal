/**
 * Evidence store — the portal's short-term "case file".
 *
 * Every successful tool run lands a normalized EvidenceItem here (in-memory,
 * process-wide). The entity-graph (`src/lib/graph.ts`) and the `/api/evidence`
 * endpoints read from this list. Cap is intentionally small to keep the dev
 * server memory-light; evidence resets on restart.
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

export function recordEvidence(item: Omit<EvidenceItem, "id">): EvidenceItem {
  const entry: EvidenceItem = {
    id: `${Date.now().toString(36)}-${(++seq).toString(36)}`,
    ...item,
  };
  evidence = [entry, ...evidence].slice(0, EVIDENCE_CAP);
  return entry;
}

export function listEvidence(): EvidenceItem[] {
  return evidence;
}

export function clearEvidence(): void {
  evidence = [];
  seq = 0;
}

export function evidenceCount(): number {
  return evidence.length;
}

/* istanbul ignore next -- dev/diagnostic only */
export function evidenceSource(): string {
  return "in-memory (resets on restart)";
}