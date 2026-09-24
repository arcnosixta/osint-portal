import { NextRequest, NextResponse } from "next/server";
import { runAnya } from "@/lib/anya";
import { summarizeProviders } from "@/lib/anya/providers";
import type { AnyaRequest } from "@/lib/anya/types";

export const dynamic = "force-dynamic";

const MAX_CONTENT = 2000;
const MAX_MESSAGES = 20;

export async function POST(request: NextRequest) {
  let body: Partial<AnyaRequest> = {};
  try {
    body = (await request.json()) as Partial<AnyaRequest>;
  } catch {
    return NextResponse.json(
      { ok: false, message: "invalid json body" },
      { status: 400 },
    );
  }

  const language = body.language === "ru" ? "ru" : "en";
  const messages = Array.isArray(body.messages)
    ? body.messages
        .filter(
          (m) =>
            m &&
            (m.role === "user" || m.role === "assistant") &&
            typeof m.content === "string",
        )
        .slice(-MAX_MESSAGES)
        .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CONTENT) }))
    : [];

  if (messages.length === 0) {
    return NextResponse.json(
      { ok: false, message: "at least one message is required" },
      { status: 400 },
    );
  }

  const result = await runAnya({ messages, language });
  return NextResponse.json({ ok: true, ...result });
}

export async function GET() {
  return NextResponse.json({
    name: "anya",
    status: "online",
    providers: summarizeProviders(process.env),
  });
}