# Double-click installer (Windows).
#
# Right-click -> Run with PowerShell, or run it from a terminal. Registers the
# native host for every browser found on the machine, using the HKCU hive so
# nothing needs administrator rights.
$ErrorActionPreference = "Stop"

Set-Location -Path $PSScriptRoot

function Get-NodeVersion {
  $command = Get-Command node -ErrorAction SilentlyContinue
  if (-not $command) { return $null }
  try { return (& node -p "process.versions.node" 2>$null) } catch { return $null }
}

$version = Get-NodeVersion

if (-not $version) {
  Write-Host ""
  Write-Host "  Нужен Node.js. Установите версию 20 или новее и запустите файл снова:"
  Write-Host "    https://nodejs.org"
  Write-Host ""
  Read-Host "  Enter, чтобы закрыть"
  exit 1
}

$parts = $version.Split(".")
$major = [int]$parts[0]
$minor = [int]$parts[1]

if ($major -lt 20) {
  Write-Host ""
  Write-Host "  Node $version слишком старый: нужна версия 20 или новее."
  Write-Host ""
  Read-Host "  Enter, чтобы закрыть"
  exit 1
}

if ($major -lt 23 -or ($major -eq 23 -and $minor -lt 5)) {
  Write-Host ""
  Write-Host "  Внимание: Node $version не запускает TypeScript сам."
  Write-Host "  Если node_modules нет, выполните: npm install"
  Write-Host ""
}

# Execution policy blocks scripts run from a downloaded zip by default, and
# changing the machine-wide policy for a one-shot install would be rude.
try {
  & node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON helper/install.ts @args
} catch {
  Write-Host ""
  Write-Host "  Не удалось запустить установщик: $_"
  Write-Host "  Если PowerShell заблокировал скрипт, выполните в этом окне:"
  Write-Host "    Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass"
  Write-Host ""
  Read-Host "  Enter, чтобы закрыть"
  exit 1
}

Write-Host ""
Read-Host "  Enter, чтобы закрыть"
