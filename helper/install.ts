/**
 * One-shot installer: `npm run helper:install`
 *
 * Registers the browser protocol, enables autostart and starts the helper once
 * so the control page is already there when the user opens the site.
 */

import path from "node:path";
import {
  detectOs,
  installAutostart,
  isAutostartEnabled,
  removeAutostart,
} from "./autostart";
import { SCHEME, installProtocol, removeProtocol } from "./protocol";
import { HELPER_HOST, HELPER_PORT } from "./policy";
import { HOST_NAME, extensionIdFromPath, installNativeHost, removeNativeHost } from "./nativehost";
import { writeHostConfig } from "./hostconfig";
import { buildExtension } from "./extension-build";

// Flags must be bare words. Both `node` and `npm` claim anything starting with
// `--` (`--no-autostart` is swallowed by npm as an npm config toggle), so pass
// them after a bare `--`: `npm run helper:install -- skip-autostart`.
const args = process.argv.slice(2).map((a) => a.replace(/^--?/, ""));
const uninstall = args.includes("uninstall");
const skipAutostart = args.includes("skip-autostart");
// Optional: the extension id, needed to let the browser accept this host.
const extensionId = args.find((a) => /^ext-[a-p]{32}$/.test(a.replace(/^ext-/, "")) && a.startsWith("ext-"));

const PROJECT_ROOT = path.resolve(__dirname, "..");
const HOST_PATH = path.join(PROJECT_ROOT, "native", "host.js");
// The id comes from the built folder, because that is what the browser loads.
const EXTENSION_DIR = path.join(PROJECT_ROOT, "extension", "dist", "chrome");

function line(label: string, ok: boolean, detail?: string): void {
  const mark = ok ? "✓" : "✗";
  process.stdout.write(`  ${mark} ${label}${detail ? ` — ${detail}` : ""}\n`);
}

async function main(): Promise<void> {
  process.stdout.write(`\n  OSINT Portal — установка локального помощника (${detectOs()})\n\n`);

  if (uninstall) {
    const auto = await removeAutostart();
    line("автозапуск", auto.ok);
    const proto = removeProtocol();
    line("схема браузера", proto.ok);
    const removed = removeNativeHost();
    line("native host", true, removed.length ? `снят в ${removed.length} браузерах` : "не был установлен");
    process.stdout.write("\n  Готово. Помощник удалён из автозагрузки.\n\n");
    return;
  }

  const protocol = installProtocol();
  line("схема " + SCHEME + "://", protocol.ok, protocol.message);

  const built = buildExtension();
  line("расширение собрано", true, built.map((b) => b.browser).join(", "));

  const config = writeHostConfig(HOST_PATH);
  line("конфиг нативного хоста", config.ok, config.message);

  const native = installNativeHost(HOST_PATH, extensionId ? [extensionId] : [], EXTENSION_DIR);
  line("native host " + HOST_NAME, native.installed.length > 0, native.installed.length
    ? native.installed.map((t) => t.browser).join(", ")
    : "браузеры не найдены");
  if (native.installed.length > 0) {
    process.stdout.write(`\n  id расширения: ${extensionIdFromPath(EXTENSION_DIR)}\n`);
  }

  let auto: Awaited<ReturnType<typeof installAutostart>> | null = null;
  if (skipAutostart) {
    process.stdout.write("\n  Автозапуск пропущен (-- skip-autostart).\n");
  } else {
    auto = await installAutostart();
    line("автозапуск", auto.ok, auto.message);
  }

  process.stdout.write(
    [
      "",
      `  Контрол-страница:  http://${HELPER_HOST}:${HELPER_PORT}`,
      `  Автозапуск:        ${isAutostartEnabled() ? "включён" : "выключен"}`,
      "",
      "  Дальше:",
      "    1. Откройте сайт и нажмите «Запустить утилиты».",
      "    2. Откроется эта локальная страница — нажмите «Запустить утилиты».",
      "    3. Инструменты поднимутся, кнопка на сайте исчезнет сама.",
      "",
    ].join("\n"),
  );

  if (!protocol.ok && protocol.manual) {
    process.stdout.write(`  Вручную: ${protocol.manual}\n\n`);
  }
  if (auto?.manual) {
    process.stdout.write(`  Вручную: ${auto.manual}\n\n`);
  }
}

void main();
