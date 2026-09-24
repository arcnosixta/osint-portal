# OSINT Portal

> Every OSINT tool in one place. Sherlock, netcat, nmap, whois and dozens more —
> installed locally, orchestrated through one clean interface.

![License](https://img.shields.io/badge/License-Apache--2.0-blue.svg)
![Stack](https://img.shields.io/badge/Next.js%2016%20·%20Tailwind%20v4%20·%20GSAP%20·%20Three.js-black)
![Status](https://img.shields.io/badge/status-alpha-white)

**OSINT Portal** is an open-source platform that unifies the OSINT toolchain:
a cinematic, bilingual (EN/RU) web interface with a growing catalog of
battle-tested reconnaissance utilities — all self-hosted, all local. Your data
never leaves your machine.

Every tool has its own **workbench page**: you pick a target, choose flags from
a palette, press **Run**, and a real local process executes through a safe
shell-free API. Results come back as structured tables and a live-console log.

---

## The vision

OSINT is a chain, not a single command:

```
sherlock username ──► nmap target ──► openssl TLS ──► whois domain ──► dig DNS ──► jq merge
```

The portal wires the links: you type one target, the platform orchestrates the
collectors, correlates the results and produces a report.

## Current state

- [x] **Cinematic landing** — WebGL particle field, kinetic typography, glitch
      effects, scanlines, terminal simulation, smooth scroll (Lenis + GSAP).
- [x] **Bilingual interface** — EN/RU switch, persisted to localStorage.
- [x] **Tool catalog** — 18 modules across 6 capability groups, live detection
      of locally-installed binaries.
- [x] **Per-tool workbenches** — `/tools/[tool]` pages with a control deck,
      flag palette, quick presets, run history and structured result views.
- [x] **API skeleton** — safe seams (`/api/tools/*`) with built-in
      shell-metacharacter filtering, target allow-lists, per-run timeouts and
      output caps.
- [x] **Ten live segments** (each behind per-segment argument allow-lists,
      with parser tests):

| Segment | What it does | Result view |
|---|---|---|
| `nmap` | port scan, service/OS fingerprint | ports table |
| `netcat` | TCP connect-probe of single ports (Ncat) | ports table |
| `dig` | DNS lookups (A/AAAA/MX/TXT/NS/…) | records table |
| `host` | lightweight DNS resolution | records table |
| `whois` | registry data (needs `whois` installed) | whois cards |
| `sherlock` | username search across 400+ platforms | found list |
| `curl` | read-only HTTP(S) probe, headers & status | plain |
| `openssl` | live TLS certificate fingerprint (subject/SAN/dates) | cert cards |
| `traceroute` | network path: numbered hops + RTT samples | hops table |
| `jq` | fetch JSON from an allow-listed URL and filter it | plain |

- [ ] **More segments** — wiring real execution one pull request per tool.
- [ ] **Graph visualization** — correlate findings into an entity graph.

---

## System requirements

| Requirement | Minimum | Recommended |
|---|---|---|
| Node.js | ≥ 20.9 | 22 LTS or newer |
| npm | ≥ 10 | latest |
| OS | Linux 20.04+, macOS 12+, Windows 10+ | — |
| RAM / disk | 2 GB / 1 GB | 8 GB |
| Tool binaries | see the matrix below | all of them |

> The panel itself is pure Node — it runs anywhere. The **segments** execute
> real OS tooling, so the more of the matrix below you install, the more
> workbenches become live.

---

## Install from scratch

Pick your operating system. Each guide takes you from an empty system to a
running portal with every workbench unlocked.

### Tool matrix

| Tool | Linux (Debian/Ubuntu) | macOS (Homebrew) | Windows |
|---|---|---|---|
| `nmap` / `ncat` | `sudo apt install nmap` | `brew install nmap` | `choco install nmap` (includes Ncat) |
| `netcat` | `sudo apt install netcat-openbsd` | `brew install netcat` | ships with Nmap |
| `dig` / `host` | `sudo apt install dnsutils` | built-in (BIND) | use WSL 2 ↴ |
| `whois` | `sudo apt install whois` | `brew install whois` | use WSL 2 ↴ |
| `traceroute` | `sudo apt install traceroute` | built-in | `tracert` on Windows |
| `openssl` | `sudo apt install openssl` | built-in (LibreSSL) · `brew install openssl` for full OpenSSL | use WSL 2 or Git-for-Windows' OpenSSL |
| `curl` | `sudo apt install curl` | built-in | built-in (10+) |
| `jq` | `sudo apt install jq` | `brew install jq` | `choco install jq` |
| `sherlock` | `pip install --user sherlock-project` | same (needs Python 3.8+) | use WSL 2 ↴ |

**Windows tip.** The portal runs natively on Windows, but most OSINT binaries
(`dig`, `whois`, `traceroute`) are Unix-native. For full segment coverage run
the whole stack inside **WSL 2** (Ubuntu) — the Linux guide below applies
verbatim inside a WSL terminal.

---

### 🐧 Linux (Debian / Ubuntu)

```bash
# 1. Node.js 22 LTS (via NodeSource) + core tools
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs git python3 python3-pip \
  nmap netcat-openbsd dnsutils whois traceroute openssl curl jq

# 2. Sherlock (username search engine)
pip install --user sherlock-project
export PATH="$HOME/.local/bin:$PATH"

# 3. Get the source
git clone https://github.com/arcnosixta/osint-portal.git
cd osint-portal

# 4. Install dependencies
npm install

# 5. Environment (optional — defaults are safe)
cp .env.example .env.local

# 6. Verify tools are detected, then start
node -e "console.log('node', process.version)"
npm test          # unit tests for segment parsers
npm run dev       # → http://localhost:3000
```

> On Fedora/RHEL swap `apt` for `dnf` and the packages are: `nmap` `ncat`
> `bind-utils` `whois` `traceroute` `openssl` `curl` `jq`.

### 🍎 macOS

```bash
# 1. Homebrew (or use https://nodejs.org for the official installer)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 2. Node.js 22 LTS + toolchain
brew install node@22 git python3 nmap netcat whois \
  openssl jq traceroute

# 3. Sherlock
python3 -m pip install --user sherlock-project
export PATH="$HOME/Library/Python/3.13/bin:$PATH"   # or: "$HOME/.local/bin"

# 4. Source + install
git clone https://github.com/arcnosixta/osint-portal.git
cd osint-portal
npm install
cp .env.example .env.local

# 5. Verify + run
npm test
npm run dev       # → http://localhost:3000
```

> `dig` / `host` / `traceroute` ship with macOS; `openssl` is the system
> LibreSSL — fine for fingerprints, but `brew install openssl` swaps in full
> OpenSSL if you need modern cipher options.

### 🪟 Windows

**Option A — native (limited segments):**

```powershell
# 1. Install Node.js 22 LTS from https://nodejs.org (or via winget)
winget install OpenJS.NodeJS.LTS
winget install Git.Git
winget install jq

# 2. Binary tools (Nmap bundle also provides Ncat)
choco install nmap git -y

# 3. Source + install (use PowerShell)
git clone https://github.com/arcnosixta/osint-portal.git
cd osint-portal
npm install
copy .env.example .env.local

# 4. Run
npm test
npm run dev       # → http://localhost:3000
```

**Option B — WSL 2 (full segment coverage, recommended):**

```powershell
wsl --install -d Ubuntu           # reboot when prompted
```
Then follow the **Linux** guide inside the WSL terminal. The portal is
reachable at `http://localhost:3000` from Windows side too.

---

## Usage

```bash
# Catalog + live detection of locally-installed binaries
curl http://localhost:3000/api/tools

# Run a segment — nmap (allow-listed targets only)
curl -X POST http://localhost:3000/api/tools/nmap \
  -H 'Content-Type: application/json' \
  -d '{"target":"127.0.0.1","args":["-p","80,443"]}'

# TLS certificate fingerprint
curl -X POST http://localhost:3000/api/tools/openssl \
  -H 'Content-Type: application/json' \
  -d '{"target":"example.com:443","args":["-tls1_3"]}'

# DNS lookup (public hostnames allowed for read-only DNS segments)
curl -X POST http://localhost:3000/api/tools/dig \
  -H 'Content-Type: application/json' \
  -d '{"target":"example.com","args":["-t","MX"]}'

# Username search (installed via `pip install --user sherlock-project`)
curl -X POST http://localhost:3000/api/tools/sherlock \
  -H 'Content-Type: application/json' \
  -d '{"target":"octocat","args":["--timeout","3"]}'

# Fetch JSON and filter it with jq
curl -X POST http://localhost:3000/api/tools/jq \
  -H 'Content-Type: application/json' \
  -d '{"target":"http://localhost:3000/api/health","args":[".service"]}'

# Health
curl http://localhost:3000/api/health
```

By default only loopback/private targets are allowed; extend with
`OSINT_ALLOWED_TARGETS` (see [`.env.example`](./.env.example)). Raw IP/CIDR
targets are always gated; read-only DNS/registry segments (dig, host, whois)
accept public hostname targets.

### Environment variables

| Variable | Purpose | Default |
|---|---|---|
| `OSINT_ALLOWED_TARGETS` | comma-separated extra targets (CIDRs/IPs/domains) | loopback + private ranges |
| `OSINT_RUN_TIMEOUT_MS` | hard timeout per tool run | 20000 (sherlock 60000) |
| `OSINT_MAX_OUTPUT_BYTES` | max captured stdout/stderr per run | 64000 |

Copy `.env.example` to `.env.local` to override.

---

## Tech stack

| Layer | Choice |
|---|---|
| Web | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS v4, design tokens (matrix-green cyberpunk) |
| Motion | GSAP + ScrollTrigger + SplitText, Lenis smooth scroll, Motion (Framer) |
| Scene | Three.js custom WebGL particle/reticle background |
| API | Next.js Route Handlers (`/api/tools/*`) + safe segment runners |

---

## Responsible use

This project exists for **ethical investigations only**: authorized security
assessments, transparency research and verification. See the in-app ethics
section and [`SECURITY.md`](./SECURITY.md). The API layer rejects shell
metacharacters and gates execution behind explicit target allow-lists.

## Contributing — adding a segment

Each tool is a "segment". Adding one is intentionally small:

1. Register the tool in [`src/lib/tools.ts`](./src/lib/tools.ts) (id, name,
   command, description EN/RU, category, status).
2. Implement a segment in `src/lib/segments/` — declare its argument
   allow-list via the shared validator in `args.ts`, gate the target with
   `allowList.contains(...)`, run through `spawn.ts`, parse structured output,
   then register it in `src/lib/segments/index.ts`.
3. Add a workbench profile in `src/lib/workbench.ts` (presets, flag palette,
   result view) and a renderer in `src/components/workbench/ResultView.tsx`.
4. Ship tests (`src/lib/**/*.test.ts`). That's a reviewable PR that plugs the
   tool into the whole platform — cards, detection, workbench and API at once.

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the detailed contract.

## Roadmap

- [ ] More segment wiring (maigret, sublist3r, theHarvester, gobuster, ...) behind allow-lists
- [ ] Graph visualization / evidence store
- [ ] Reproducible reports
- [ ] GitHub Actions CI

## License

[Apache 2.0](./LICENSE) © arcnosixta