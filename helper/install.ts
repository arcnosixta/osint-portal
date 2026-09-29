/**
 * One-shot installer.
 *
 * Everything the browser needs to start the tools on its own happens here, and
 * afterwards the site does the rest. What it writes:
 *
 *  1. the loadable extension folders, and the ids the browser will derive from
 *     them;
 *  2. the native messaging manifest for every browser found on the machine,
 *     in the format that browser actually reads;
 *  3. host.config.json, the command the native host runs.
 *
 * Autostart is opt-in. The extension launches the helper the first time the
 * site asks for it, so a login item is a second way to do something that
 * already works, and a process that keeps running after the browser is closed.
 */

import {
  builtIds,
  buildExtension,
} from "./extension-build.ts";
import { detectOs, installAutostart, removeAutostart } from "./autostart.ts";
import { HOST_NAME, installNativeHost, removeNativeHost } from "./nativehost.ts";
import { writeHostConfig } from "./hostconfig.ts";
import { describeLaunch, isDependencyFree } from "./runtime.ts";
import { projectPath } from "./root.ts";

// Flags must be bare words. Both `node` and `npm` claim anything starting with
// `--` (`--autostart` is swallowed by npm as an npm config toggle), so they are
// accepted with or without dashes and must come after a bare `--`.
const args = process.argv.slice(2).map((a) => a.replace(/^--?/, ""));
const uninstall = args.includes("uninstall");
const withAutostart = args.includes("autostart");

const HOST_PATH = projectPath("native", "host.js");

function line(label: string, ok: boolean, detail?: string): void {
  process.stdout.write(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}\n`);
}

async function main(): Promise<void> {
  process.stdout.write(`\n  OSINT Portal — установка локального помощника (${detectOs()})\n\n`);

  if (uninstall) {
    const removed = removeNativeHost();
    line("native host", true, removed.length ? `снят в ${removed.length} местах` : "не был установлен");
    const auto = await removeAutostart();
    line("автозапуск", auto.ok, auto.message);
    process.stdout.write("\n  Готово. Расширение можно удалить в браузере.\n\n");
    return;
  }

  const built = buildExtension();
  const ids = builtIds();
  line("расширение собрано", true, built.map((b) => b.browser).join(", "));
  line("запуск", true, describeLaunch());

  const config = writeHostConfig(HOST_PATH);
  line("конфиг нативного хоста", config.ok, config.message);

  const native = installNativeHost(HOST_PATH, { chromium: ids.chrome.chromium, gecko: ids.firefox.gecko });
  line(`native host ${HOST_NAME}`, native.installed.length > 0, native.installed.length ? native.installed.map((t) => t.browser).join(", ") : "браузеры не найдены");

  for (const failure of native.errors) {
    line(`${failure.target.browser} (${failure.target.engine})`, false, failure.message);
  }

  if (withAutostart) {
    const auto = await installAutostart();
    line("автозапуск", auto.ok, auto.message);
    if (auto.manual) process.stdout.write(`\n  Вручную: ${auto.manual}\n`);
  } else {
    process.stdout.write("\n  Автозапуск не включаю: расширение само запускает помощник. Включить принудительно — с флагом autostart.\n");
  }

  process.stdout.write(`\n  id расширения: chromium ${ids.chrome.chromium} · gecko ${ids.firefox.gecko ?? "—"}\n`);
  if (!isDependencyFree()) {
    process.stdout.write("\n  Внимание: на этой версии Node нужен npm install, иначе утилиты не поднимутся.\n");
  }

  process.stdout.write(
    [
      "",
      "  Остался один шаг — поставить расширение, дальше оно само:",
      "",
      "    Chrome / Edge / Brave / Vivaldi / Opera:",
      "      Настройки → Расширения → Режим разработчика → Загрузить распакованное",
      `      папка: ${projectPath("extension", "dist", "chrome")}`,
      "",
      "    Firefox:",
      "      about:debugging#/runtime/this-firefox → Загрузить временное дополнение",
      `      файл: ${projectPath("extension", "dist", "firefox", "manifest.json")}`,
      "",
      "  Временное дополнение в Firefox снимается при перезапуске браузера.",
      "",
    ].join("\n"),
  );

  if (native.skipped.length > 0) {
    process.stdout.write(`  Остальные браузеры (${native.skipped.length}) на машине не найдены — им манифест не нужен.\n\n`);
  }
}

void main();
