#!/bin/sh
# Double-click installer (macOS).
#
# Same script as install.sh; a separate name so Finder shows it as a
# double-clickable application and does not try to run it in a terminal.
set -e

here=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$here"

if ! command -v node >/dev/null 2>&1; then
  echo ""
  echo "  Нужен Node.js. Установите версию 20 или новее и запустите файл снова:"
  echo "    brew install node   (или https://nodejs.org)"
  echo ""
  read -r -p "  Enter, чтобы закрыть: " _ || true
  exit 1
fi

version=$(node -p "process.versions.node")
major=$(echo "$version" | cut -d. -f1)
minor=$(echo "$version" | cut -d. -f2)

if [ "$major" -lt 20 ]; then
  echo ""
  echo "  Node $version слишком старый: нужна версия 20 или новее."
  echo ""
  read -r -p "  Enter, чтобы закрыть: " _ || true
  exit 1
fi

if [ "$major" -lt 23 ] || { [ "$major" -eq 23 ] && [ "$minor" -lt 5 ]; }; then
  echo ""
  echo "  Внимание: Node $version не запускает TypeScript сам."
  echo "  Если node_modules нет, выполните: npm install"
  echo ""
fi

node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON helper/install.ts "$@"

echo ""
read -r -p "  Enter, чтобы закрыть: " _ || true
