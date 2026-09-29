/**
 * Module resolution for the local helper and runner.
 *
 * Node runs TypeScript itself, but it resolves specifiers the way the web does
 * not: `./tools` is a broken import in ES modules, and the code under src/lib
 * is written the bundler way, because it is shared with the Next.js app and 97
 * of its imports would have to change otherwise. Rewriting shared library code
 * to suit a local daemon is the wrong trade.
 *
 * So the local runtime carries its own resolver instead. It only adds the two
 * things a bundler does and Node does not — try `.ts`, then `index.ts` — for
 * relative specifiers, and is loaded through `--import` before the entry point.
 * It is a separate file with no imports of its own, because it has to be in
 * place before anything else is loaded.
 *
 * This affects the helper and the runner only. Next.js never sees it.
 */

import { existsSync, statSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

registerHooks({
  resolve(specifier, context, nextResolve) {
    const relative = specifier.startsWith(".") || specifier.startsWith("/");
    if (!relative) return nextResolve(specifier, context);

    const parent = context.parentURL ? path.dirname(fileURLToPath(context.parentURL)) : process.cwd();
    const base = specifier.startsWith("/") ? specifier : path.resolve(parent, specifier);

    for (const candidate of [base, `${base}.ts`, path.join(base, "index.ts")]) {
      try {
        if (existsSync(candidate) && statSync(candidate).isFile()) {
          return { url: pathToFileURL(candidate).href, shortCircuit: true };
        }
      } catch {
        // Unreadable candidate: fall through to the next one.
      }
    }

    return nextResolve(specifier, context);
  },
});
