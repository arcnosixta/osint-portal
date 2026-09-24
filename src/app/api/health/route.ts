import { NextResponse } from "next/server";
import { TOOLS } from "@/lib/tools";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "osint-portal",
    version: "0.1.0",
    catalog: TOOLS.length,
  });
}