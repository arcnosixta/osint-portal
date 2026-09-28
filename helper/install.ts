/**
 * One-shot installer: `npm run helper:install`
 *
 * Registers the browser protocol, enables autostart and starts the helper once
 * so the control page is already there when the user opens the site.
 */

import {
  detectOs,
  installAutostart,
  isAutostartEnabled,
  removeAutostart,
} from "./autostart";
import { SCHEME, installProtocol, removeProtocol } from "./protocol";
import { HELPER_HOST, HELPER_PORT } from "./policy";

// Flags must be bare words. Both `node` and `npm` claim anything starting with
// `--` (`--no-autostart` is swallowed by npm as an npm config toggle), so pass
// them after a bare `--`: `npm run helper:install -- skip-autostart`.
const args = process.argv.slice(2).map((a) => a.replace(/^--?/, ""));
const uninstall = args.includes("uninstall");
const skipAutostart = args.includes("skip-autostart");

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
    process.stdout.write("\n  Готово. Помощник удалён из автозагрузки.\n\n");
    return;
  }

  const protocol = installProtocol();
  line("схема " + SCHEME + "://", protocol.ok, protocol.message);

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
