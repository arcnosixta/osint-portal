/**
 * Build the loadable extension folders.
 *
 * The sources are kept as `manifest.chromium.json` and `manifest.firefox.json`
 * because the two browsers disagree on the background script declaration and a
 * single file cannot satisfy both. The browser, however, only ever loads a
 * directory whose manifest is called exactly `manifest.json`.
 *
 * So this copies the scripts and writes the right manifest for each target into
 * extension/dist/<browser>/. That directory is what the user loads unpacked.
 */

import fs from "node:fs";
import path from "node:path";

const SOURCE_DIR = path.resolve(__dirname, "..", "extension");
const OUT_DIR = path.join(SOURCE_DIR, "dist");

const TARGETS = [
  { browser: "chrome", manifest: "manifest.chromium.json" },
  { browser: "firefox", manifest: "manifest.firefox.json" },
] as const;

const SCRIPTS = ["background.js", "content.js"];

export function buildExtension(): { outDir: string; browser: string }[] {
  const built: { outDir: string; browser: string }[] = [];

  for (const target of TARGETS) {
    const outDir = path.join(OUT_DIR, target.browser);
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.mkdirSync(outDir, { recursive: true });

    const manifest = JSON.parse(fs.readFileSync(path.join(SOURCE_DIR, target.manifest), "utf8")) as object;
    fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");

    for (const script of SCRIPTS) {
      fs.copyFileSync(path.join(SOURCE_DIR, script), path.join(outDir, script));
    }

    built.push({ outDir, browser: target.browser });
  }

  return built;
}

function main(): void {
  const built = buildExtension();
  process.stdout.write("\n  OSINT Portal — сборка расширения\n\n");
  for (const item of built) {
    process.stdout.write(`  ✓ ${item.browser}: ${item.outDir}\n`);
  }
  process.stdout.write("\n  Загрузите папку в браузере: Настройки → Расширения → Режим разработчика → Загрузить распакованное.\n\n");
}

if (require.main === module) main();
