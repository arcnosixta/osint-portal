import { spawnSync } from "node:child_process";
import { getToolById, TOOLS, type Tool } from "./tools";

/**
 * Execution seam for the OSINT toolkit.
 *
 * Every "segment" (self-hosted tool / provider / collector) plugs in here.
 * `runTool` is intentionally a stub for now — the wiring for each tool lands
 * one by one. The contract stays stable so the rest of the platform doesn't
 * churn as modules are added:
 *
 *   - `id`       — tool id from the catalog (single source of truth)
 *   - `args`     — validated, sanitized arguments (never raw shell)
 *   - `target`   — an explicit, *allowed* target (Ip / Host / Username / Domain)
 *   - returns    — `{ status, started, duration, stdout, stderr, exitCode }`
 */

export interface ToolRequest {
  tool: string;
  target?: string;
  args?: string[];
}

export interface ToolRunResult {
  tool: string;
  connected: boolean;
  message: string;
  durationMs: number;
  startedAt: string;
  local?: boolean;
  available?: boolean;
  excerpt?: string;
}

/** Detect whether a binary is present on PATH. Cached to avoid syscall spam. */
const availabilityCache = new Map<string, boolean>();

export function isBinaryAvailable(binary: string): boolean {
  if (availabilityCache.has(binary)) return availabilityCache.get(binary)!;
  const res = spawnSync("which", [binary], { stdio: "ignore", shell: false });
  const available = res.status === 0;
  availabilityCache.set(binary, available);
  return available;
}

export function detectLocalToolStatus(): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  for (const tool of TOOLS) {
    if (!tool.local) continue;
    result[tool.id] = isBinaryAvailable(tool.name.toLowerCase());
  }
  return result;
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

  // Built-in safety: reject shell metacharacters in args before any executor
  // even thinks about spawning a process.
  const forbidden = /[;&|`$<>(){}\n\r]/;
  const dirtyArg = (req.args ?? []).find((a) => forbidden.test(a));
  if (dirtyArg) {
    return {
      tool: tool.id,
      connected: false,
      message: "argument blocked: shell metacharacters are not allowed.",
      durationMs: Date.now() - started,
      startedAt: new Date().toISOString(),
    };
  }

  const available = tool.local ? isBinaryAvailable(tool.name.toLowerCase()) : false;

  return {
    tool: tool.id,
    connected: false,
    message:
      "module not connected yet — this is where the segment wiring lands. PRs welcome.",
    durationMs: Date.now() - started,
    startedAt: new Date().toISOString(),
    local: tool.local,
    available,
    excerpt: `$ ${tool.command}`,
  };
}