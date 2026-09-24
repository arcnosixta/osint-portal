import { NextResponse } from "next/server";
import { listEvidence, evidenceCount } from "@/lib/evidence";
import { buildGraph } from "@/lib/graph";

export const dynamic = "force-dynamic";

export async function GET() {
  const graph = buildGraph(listEvidence());
  return NextResponse.json({
    ok: true,
    count: evidenceCount(),
    nodes: graph.nodes,
    links: graph.links,
  });
}