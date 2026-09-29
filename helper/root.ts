/**
 * Where the project is, for entry points that run outside a bundler.
 *
 * `__dirname` is the usual answer and it is not available here: these files are
 * run directly by Node as TypeScript, and Node parses them as ES modules, where
 * `__dirname` does not exist. `import.meta.url` would be the modern equivalent
 * but it cannot be written unconditionally, because the same files are also run
 * through tsx for older Node versions and that path is transpiled to CommonJS.
 *
 * `process.argv[1]` is the resolved path of the entry script in every one of
 * those modes, needs no syntax that changes meaning, and is exactly the file
 * whose location we are trying to recover.
 *
 * The answer is then confirmed rather than assumed. A wrong project root is not
 * a crash: it produces a host config, an autostart entry and a native host
 * manifest that all point at files which are not there, and nothing complains
 * until the tools silently refuse to start. So the root is the nearest ancestor
 * that actually looks like this project.
 */

import { existsSync } from "node:fs";
import path from "node:path";

/** A directory only counts as the project root if it has both of these. */
function looksLikeRoot(dir: string): boolean {
  return existsSync(path.join(dir, "package.json")) && existsSync(path.join(dir, "helper"));
}

function walkUp(from: string): string {
  let dir = path.resolve(from);

  for (;;) {
    if (looksLikeRoot(dir)) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  // Nothing above here is this project. Fall back to the nearest package root,
  // which is what the caller would have got from the old fixed `..`.
  let dir2 = path.resolve(from);
  for (;;) {
    if (existsSync(path.join(dir2, "package.json"))) return dir2;
    const parent = path.dirname(dir2);
    if (parent === dir2) return path.resolve(from);
    dir2 = parent;
  }
}

/** Absolute path of the directory holding the entry script. */
export function scriptDir(): string {
  const entry = process.argv[1];
  if (entry) return path.dirname(path.resolve(entry));
  return process.cwd();
}

/** Absolute project root: the nearest ancestor that is this project. */
export function projectRoot(): string {
  return walkUp(scriptDir());
}

/** Absolute path inside the project. */
export function projectPath(...parts: string[]): string {
  return path.join(projectRoot(), ...parts);
}
