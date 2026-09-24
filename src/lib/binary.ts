import { spawnSync } from "node:child_process";
import { TOOLS } from "./tools";

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