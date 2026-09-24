import { NextResponse } from "next/server";
import { listEvidence, clearEvidence, evidenceCount } from "@/lib/evidence";

export const dynamic = "force-dynamic";

export async function GET() {
  const items = listEvidence();
  return NextResponse.json({
    ok: true,
    count: evidenceCount(),
    items,
  });
}

export async function DELETE() {
  clearEvidence();
  return NextResponse.json({ ok: true, count: 0 });
}