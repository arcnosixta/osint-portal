# Changelog

All notable changes to this project are documented here. Versions follow
[SemVer](https://semver.org/).

The released artifact is the **OSINT Portal Connector**: a browser extension
plus a native messaging host. Its version is the one in
`extension/manifest.chromium.json` and `extension/manifest.firefox.json`, and
this repository carries the same number.

## [1.1.2] — 2026-09-29

### Fixed

- The installer now restores the executable bit on `native/host.js`. The native
  messaging manifest points at that file path directly, with no interpreter in
  it, so a host file without the bit is a registration the browser cannot use —
  and an archive written without Unix modes loses it. The installer reported
  success and left a connector that never started. Windows is unaffected and is
  a no-op rather than a failure.

Found by unpacking the packaged connector and running the installer from the
extracted copy, which failed with `Permission denied`.

## [1.1.1] — 2026-09-29

Three fixes, all found while packaging the connector as a downloadable
artifact and running the result the way a user would. None of them broke the
installer, which is why all three shipped inside 1.1.0.

### Fixed

- `node helper/extension-build.ts` exited 0 and built nothing on the
  dependency-free runtime this project prefers. The entry point was detected
  with `require.main === module`, which is false when Node loads the file as an
  ES module, so `main()` never ran. The tsx fallback still worked, which is why
  it went unnoticed. Importing the module still does not build, so the
  installer is unaffected.
- The host forwarded `/api/runner/health` to the helper, which has no such
  route. Nothing ever requested that path, so the entry could only produce a
  404 while looking like a working route in the allow-list.
- The README put the evidence file at `runner/evidence.json`; it is
  `.osint-portal/evidence.json`, as the two other places in the README already
  said.

## [1.1.0] — 2026-09-29

The connector gets a name, and setup stops needing a package manager.

### Added

- `install.sh`, `install.command` and `install.ps1` — one-file installers. They
  build the extension, write `native/host.config.json` and register the native
  host with every Chromium and Gecko browser on the machine. `npm install` is no
  longer part of setup.
- A pinned public key in the Chromium manifest, so the extension id is
  `mogbkoolkaapdejniedklkdkkcegdlbd` wherever the folder lives. Firefox gets an
  explicit gecko id, `osint-portal@local.tools`.
- `helper/browsers.ts` — profile paths and registry keys per OS, with
  `allowed_origins` for Chromium and `allowed_extensions` for Gecko.
- `helper/runtime.ts` and `helper/register.ts` — the helper, the runner and the
  installer run straight from source on Node 23.5+ via a local resolver hook,
  with a `tsx` fallback below that.
- `npm run helper:uninstall`, and an opt-in `autostart` flag on every installer.

### Changed

- The extension is named **OSINT Portal Connector**, and the README and UI texts
  use the same name. Dead dictionary keys left over from the old control page
  (`openHelper`, `helperReady`, `manualLink`) are gone.
- Autostart is opt-in rather than on by default: the connector launches the
  host when the site asks, so nothing needs to start at login.

### Fixed

- Firefox profiles were never discovered on a clean install: the check asked
  whether the manifest directory existed rather than whether the profile did,
  and a fresh browser has no such directory. Same trap on Chromium, fixed there
  first.
- `projectRoot()` walked one directory too high when there was no entry script,
  producing paths that looked valid and were not.
- A manifest without an id is now refused instead of written without an
  allow-list, and a failed Windows registry write is reported instead of
  reported as success.

### Removed

- `helper/protocol.ts` and the `osint-runner://` scheme — the previous start
  path, with no remaining caller.

### Verified

Chromium derives the expected id from the pinned key. With `node_modules`
moved off disk, `native/host.js` started the helper from `host.config.json` and
the helper started the runner, which reported 15/18 binaries and 14 evidence
records. Install and uninstall were run against a sandboxed `HOME`: four
manifests written, four removed. 180 tests, `tsc`, lint and build clean.

Not verified: the full page → content script → service worker → host path needs
another browser run, and how the Chrome Web Store treats a manifest key is
unknown.

## [1.0.0] — af8c789

The local tools moved into a browser extension, so no terminal step is needed
per session. See `af8c789`.
