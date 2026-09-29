/**
 * Build the loadable extension folders.
 *
 * The sources are kept as `manifest.chromium.json` and `manifest.firefox.json`
 * because the two browsers disagree on more than the background script: Gecko
 * needs an explicit add-on id, and it rejects a manifest that carries Chromium's
 * `key`. A single file cannot satisfy both, and the browser only ever loads a
 * directory whose manifest is called exactly `manifest.json`.
 *
 * So this copies the scripts and writes the right manifest for each target into
 * extension/dist/<browser>/. That directory is what the user loads unpacked, and
 * the id it produces is what the native host manifest is pinned to.
 */

import fs from "node:fs";
import path from "node:path";
import { idsFromManifest } from "./extension-id.ts";
import { projectPath } from "./root.ts";

const SOURCE_DIR = projectPath("extension");
const OUT_DIR = path.join(SOURCE_DIR, "dist");

interface Target {
  browser: "chrome" | "firefox";
  manifest: string;
}

const TARGETS: Target[] = [
  { browser: "chrome", manifest: "manifest.chromium.json" },
  { browser: "firefox", manifest: "manifest.firefox.json" },
];

const SCRIPTS = ["background.js", "content.js"];

export interface BuiltExtension {
  outDir: string;
  manifestPath: string;
  browser: string;
  /** Thrown instead of shipping a build the browser would reject. */
  problem?: string;
}

function readManifest(target: Target): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(SOURCE_DIR, target.manifest), "utf8")) as Record<string, unknown>;
}

/**
 * Fail on the two manifest mistakes that produce a silent failure: a Chromium
 * build with no key cannot be pre-pinned to the host, and a Gecko build with no
 * add-on id cannot be named in `allowed_extensions`. Both are caught here so
 * the installer never writes a host manifest that points at nothing.
 */
function check(target: Target, manifest: Record<string, unknown>): string | undefined {
  const ids = idsFromManifest(manifest);
  if (target.browser === "chrome" && !ids.chromium) return "manifest.chromium.json: нет поля key — id расширения не зафиксирован";
  if (target.browser === "firefox" && !ids.gecko) return "manifest.firefox.json: нет browser_specific_settings.gecko.id";
  return undefined;
}

export function buildExtension(): { outDir: string; browser: string }[] {
  const built: { outDir: string; browser: string }[] = [];

  for (const target of TARGETS) {
    const outDir = path.join(OUT_DIR, target.browser);
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.mkdirSync(outDir, { recursive: true });

    const manifest = readManifest(target);
    const problem = check(target, manifest);
    if (problem) throw new Error(`Сборка расширения остановлена: ${problem}`);

    fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");

    for (const script of SCRIPTS) {
      fs.copyFileSync(path.join(SOURCE_DIR, script), path.join(outDir, script));
    }

    built.push({ outDir, browser: target.browser });
  }

  return built;
}

/** Ids of both built extensions, read back from what was actually written. */
export function builtIds(): { chrome: { chromium: string; gecko: string | null }; firefox: { chromium: string; gecko: string | null } } {
  const read = (browser: string) =>
    JSON.parse(fs.readFileSync(path.join(OUT_DIR, browser, "manifest.json"), "utf8")) as unknown;

  return {
    chrome: idsFromManifest(read("chrome")),
    firefox: idsFromManifest(read("firefox")),
  };
}

function main(): void {
  const built = buildExtension();
  const ids = builtIds();
  process.stdout.write("\n  OSINT Portal — сборка расширения\n\n");
  for (const item of built) {
    process.stdout.write(`  ✓ ${item.browser}: ${item.outDir}\n`);
  }
  process.stdout.write(`\n  Chromium id: ${ids.chrome.chromium}\n`);
  process.stdout.write(`  Gecko id:    ${ids.firefox.gecko ?? "—"}\n\n`);
  process.stdout.write("  Загрузите папку в браузере: Настройки → Расширения → Режим разработчика → Загрузить распакованное.\n\n");
}

// `require` does not exist when Node runs this file as an ES module, which is
// now the normal path; the guard keeps the tsx fallback working too.
const isDirectRun = typeof require !== "undefined" && require.main === module;
if (isDirectRun) main();
