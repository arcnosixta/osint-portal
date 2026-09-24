import { NextResponse } from "next/server";
import { detectLocalToolStatus, isBinaryAvailable } from "@/lib/executor";
import { TOOLS } from "@/lib/tools";

export const dynamic = "force-dynamic";

export async function GET() {
  const localStatus = detectLocalToolStatus();

  const items = TOOLS.map((tool) => ({
    id: tool.id,
    name: tool.name,
    category: tool.category,
    command: tool.command,
    status: tool.status,
    local: tool.local ?? false,
    available: tool.local ? localStatus[tool.id] ?? false : null,
    binary: tool.local ? isBinaryAvailable(tool.name.toLowerCase()) : null,
  }));

  return NextResponse.json({
    ok: true,
    count: items.length,
    localCount: items.filter((i) => i.available).length,
    tools: items,
  });
}