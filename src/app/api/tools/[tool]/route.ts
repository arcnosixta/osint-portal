import { NextRequest, NextResponse } from "next/server";
import { runTool, type ToolRequest } from "@/lib/executor";

export const dynamic = "force-dynamic";

interface Body {
  target?: string;
  args?: string[];
}

export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/tools/[tool]">,
) {
  const { tool } = await ctx.params;
  if (!/^[a-z0-9-_.]+$/i.test(tool)) {
    return NextResponse.json({ ok: false, message: "invalid tool id" }, { status: 400 });
  }

  let body: Body = {};
  try {
    body = (await request.json()) as Body;
  } catch {
    // no body — fine, defaults apply
  }

  const req: ToolRequest = {
    tool,
    target: typeof body.target === "string" ? body.target.slice(0, 253) : undefined,
    args: Array.isArray(body.args) ? body.args.map(String) : [],
  };

  const result = await runTool(req);
  return NextResponse.json({ ok: result.connected, ...result });
}

export async function GET(_request: NextRequest, ctx: RouteContext<"/api/tools/[tool]">) {
  const { tool } = await ctx.params;
  const result = await runTool({ tool });
  return NextResponse.json({ ok: result.connected, ...result });
}