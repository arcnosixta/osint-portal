import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { TOOLS } from "./tools";

/**
 * Binary discovery. Resolves a tool's executable to an absolute path so
 * segments can spawn it without relying on the runtime PATH (user bins like
 * `~/.local/bin` from pip --user are checked explicitly).
 */
const resolveCache = new Map<string, string | null>();

export function resolveBinary(name: string): string | null {
  if (resolveCache.has(name)) return resolveCache.get(name)!;

  const which = spawnSync("which", [name], { stdio: "pipe", shell: false });
  if (which.status === 0 && which.stdout) {
    const path = which.stdout.toString().trim().split("\n")[0];
    if (path) {
      resolveCache.set(name, path);
      return path;
    }
  }

  const home = homedir();
  for (const dir of [join(home, ".local", "bin"), join(home, "bin")]) {
    const candidate = join(dir, name);
    if (existsSync(candidate)) {
      resolveCache.set(name, candidate);
      return candidate;
    }
  }

  resolveCache.set(name, null);
  return null;
}

export function isBinaryAvailable(name: string): boolean {
  return resolveBinary(name) !== null;
}

export function detectLocalToolStatus(): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  for (const tool of TOOLS) {
    if (!tool.local) continue;
    result[tool.id] = isBinaryAvailable(tool.name.toLowerCase());
  }
  return result;
}