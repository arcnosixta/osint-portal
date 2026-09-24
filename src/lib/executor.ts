import { getToolById, type Tool } from "./tools";
import { isBinaryAvailable } from "./binary";
import { SEGMENTS, isSegmentConnected } from "./segments";

/**
 * Execution seam for the OSINT toolkit.
 *
 * Every "segment" (self-hosted tool / provider / collector) plugs in here.
 * Wired segments (src/lib/segments) execute their runner; everything else falls
 * through to the placeholder response below. The contract stays stable:
 *
 *   - `tool`    — tool id from the catalog (single source of truth)
 *   - `target`  — an explicit, *allow-listed* target (Ip / Host / Username / Domain)
 *   - `args`    — validated, sanitized arguments (never raw shell)
 */

export interface ToolRequest {
  tool: string;
  target?: string;
  args?: string[];
}

export type RunStatus = "ok" | "error" | "blocked";

export interface ToolRunResult {
  tool: string;
  connected: boolean;
  message: string;
  durationMs: number;
  startedAt: string;
  local?: boolean;
  available?: boolean;
  excerpt?: string;
  status?: RunStatus;
  blocked?: boolean;
  data?: unknown;
  stdout?: string;
  exitCode?: number | null;
}

const META_RE = /[;&|`$<>(){}\n\r]/;

function validateRequest(
  req: ToolRequest & { started: number },
  tool: Tool,
): ToolRunResult | null {
  const dirtyArg = (req.args ?? []).find((a) => META_RE.test(a));
  if (dirtyArg) {
    return {
      tool: tool.id,
      connected: false,
      message: "argument blocked: shell metacharacters are not allowed.",
      durationMs: Date.now() - req.started,
      startedAt: new Date().toISOString(),
    };
  }
  if (req.target && META_RE.test(req.target)) {
    return {
      tool: tool.id,
      connected: false,
      message: "target blocked: shell metacharacters are not allowed.",
      durationMs: Date.now() - req.started,
      startedAt: new Date().toISOString(),
    };
  }
  return null;
}

export async function runTool(req: ToolRequest): Promise<ToolRunResult> {
  const started = Date.now();
  const tool: Tool | undefined = getToolById(req.tool);

  if (!tool) {
    return {
      tool: req.tool,
      connected: false,
      message: `unknown tool: "${req.tool}". See the catalog in src/lib/tools.ts.`,
      durationMs: Date.now() - started,
      startedAt: new Date().toISOString(),
    };
  }

  const base = {
    tool: tool.id,
    connected: false,
    durationMs: Date.now() - started,
    startedAt: new Date().toISOString(),
  };

  const invalid = validateRequest({ ...req, started }, tool);
  if (invalid) return invalid;

  const available = tool.local ? isBinaryAvailable(tool.name.toLowerCase()) : false;

  if (isSegmentConnected(tool.id)) {
    const segmentResult = await SEGMENTS[tool.id]({
      tool: tool.id,
      target: req.target,
      args: req.args ?? [],
    });
    return {
      ...base,
      connected: true,
      local: tool.local,
      available,
      durationMs: Date.now() - started,
      ...segmentResult,
    };
  }

  return {
    ...base,
    message:
      "module not connected yet — this is where the segment wiring lands. PRs welcome.",
    local: tool.local,
    available,
    excerpt: `$ ${tool.command}`,
  };
}