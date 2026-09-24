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

## What's new

- **Entity graph + evidence store.** Every successful run is recorded
  (`/api/evidence`) and correlated into a visual graph (`/api/graph`). New
  `/graph` page: canvas, counters, legend, click-to-inspect panels with
  "next-tool" suggestions.
- **Static, remembered layouts.** Graph nodes no longer drift on their own —
  they settle once and only move while dragged. Positions and the last
  snapshot are cached in localStorage; an empty/offline API falls back to the
  cached copy with a *local cache* badge.
- **Localization complete.** Workbench result badges, terminal banner,
  related-tool cards and ARIA labels are now EN/RU (dictionaries are 1:1).
- **Stable run history.** Shared history entries got globally-unique IDs (no
  more React key collisions between tools), with migration of old entries.
- **All tool binaries installed & documented** — see the matrix below and the
  per-OS "install from scratch" guides (official sources only).

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
- [x] **Seventeen live segments** (each behind per-segment argument allow-lists,
      with parser tests):

| Segment | What it does | Result view |
|---|---|---|
| `nmap` | port scan, service/OS fingerprint | ports table |
| `netcat` | TCP connect-probe of single ports (Ncat) | ports table |
| `masscan` | line-speed scans across huge port ranges | ports table |
| `dig` | DNS lookups (A/AAAA/MX/TXT/NS/…) | records table |
| `host` | lightweight DNS resolution | records table |
| `whois` | registry data (needs `whois` installed) | whois cards |
| `dnsrecon` | DNS enumeration: records, cache snooping, brute | records table |
| `sublist3r` | subdomain discovery via engines + cert logs | subdomains list |
| `theHarvester` | emails, hosts and subdomains from public sources | emails + hosts |
| `traceroute` | network path: numbered hops + RTT samples | hops table |
| `sherlock` | username search across 400+ platforms | found list |
| `maigret` | username search across thousands of sites | profile list |
| `curl` | read-only HTTP(S) probe, headers & status | plain |
| `openssl` | live TLS certificate fingerprint (subject/SAN/dates) | cert cards |
| `gobuster` | directory/subdomain/vhost/DNS brute-force | hits list |
| `jq` | fetch JSON from an allow-listed URL and filter it | plain |
| `python3` | verified interpreter version probe (no arbitrary code) | version card |

- [x] **Anya** — a living AI assistant (floating chat, bottom-right). An
      animated avatar blinks, tracks what you type, thinks and speaks; Anya
      explains tools, reads workbench results and suggests next steps. Plug in
      a **free** model backend (Ollama, Groq, OpenRouter) via `.env.local` —
      or run her built-in offline brain with zero config. A dedicated
      full-screen pink page (`/anya`) cross-fades her mood photos.

- [x] **Evidence store** — every successful run is persisted
      (`/api/evidence`) and correlated into an entity graph (`/api/graph`):
      usernames, domains, hosts, IPs, emails and ports become nodes; links keep
      the "how" (`profile`, `resolution`, `port` …).
- [x] **Entity graph page** (`/graph`) — an interactive canvas where nodes are
      **static until you drag them** (no perpetual wandering), the layout is
      saved to localStorage and restored on reload, and the server snapshot
      falls back to a local cache when the API is empty or offline.
- [x] **Fully localized UI** — workbench result badges, the terminal banner and
      accessibility labels are EN/RU too (1:1 dictionaries, language kept in
      localStorage).

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
| `masscan` | `sudo apt install masscan` | `brew install masscan` | use WSL 2 ↴ |
| `dig` / `host` | `sudo apt install dnsutils` | built-in (BIND) | use WSL 2 ↴ |
| `whois` | `sudo apt install whois` | `brew install whois` | use WSL 2 ↴ |
| `dnsrecon` | `git clone https://github.com/darkoperator/dnsrecon && cd dnsrecon && pip install --user --break-system-packages .` | same (needs Python **≥ 3.12**) | use WSL 2 ↴ |
| `sublist3r` | `git clone https://github.com/aboul3la/Sublist3r && cd Sublist3r && pip install --user --break-system-packages .` | same (needs Python ≥ 3.8) | use WSL 2 ↴ |
| `theHarvester` | `curl -LsSf https://astral.sh/uv/install.sh \| sh` then `git clone https://github.com/laramies/theHarvester && cd theHarvester && uv sync` then `ln -s "$PWD/.venv/bin/theHarvester" "$HOME/.local/bin/theHarvester"` | same (uv manages Python ≥ 3.12 automatically) | use WSL 2 ↴ |
| `maigret` | `pip install --user --break-system-packages maigret` | same (needs Python ≥ 3.8) | use WSL 2 ↴ |
| `gobuster` | download a prebuilt from [GitHub releases](https://github.com/OJ/gobuster/releases) (`gobuster_Linux_x86_64.tar.gz`), or `go install github.com/OJ/gobuster/v3@latest` | `brew install gobuster` | use WSL 2 ↴ |
| `traceroute` | `sudo apt install traceroute` | built-in | `tracert` on Windows |
| `openssl` | `sudo apt install openssl` | built-in (LibreSSL) · `brew install openssl` for full OpenSSL | use WSL 2 or Git-for-Windows' OpenSSL |
| `curl` | `sudo apt install curl` | built-in | built-in (10+) |
| `jq` | `sudo apt install jq` | `brew install jq` | `choco install jq` |
| `sherlock` | `pip install --user sherlock-project` | same (needs Python 3.8+) | use WSL 2 ↴ |
| `python3` | `sudo apt install python3` | `brew install python3` | `winget install Python.Python.3` |
| wordlists | `sudo apt install seclists` (used by gobuster) | `brew install seclists` | use WSL 2 ↴ |

> **PEP 668.** Debian 12+ / Ubuntu 23.04+ (and Homebrew-managed Python) refuse
> `pip install --user` by default. Pass `--break-system-packages` (adds to your
> user site only — the portal's `~/.local/bin`), or use `uv`/`pipx`.
>
> **Avoid the PyPI placeholders.** `pip install theHarvester` / `sublist3r` /
> `dnsrecon` pulls unofficial repacks (e.g. `theHarvester 0.0.1` has no CLI at
> all). Install those three from their official GitHub repos as shown above.
> `maigret` and `sherlock-project` are legit on PyPI.
>
> **`masscan` needs root** (raw sockets): run `sudo masscan …`. The portal
> detects the binary either way, but scans will only run with privileges.
> `gobuster` needs a wordlist on disk or `seclists`.

> **Windows tip.** The portal runs natively on Windows, but most OSINT binaries
> (`dig`, `whois`, `traceroute`, and the pip/Go tooling) are Unix-native. For
> full segment coverage run the whole stack inside **WSL 2** (Ubuntu) — the
> Linux guide below applies verbatim inside a WSL terminal.

---

### 🐧 Linux (Debian / Ubuntu)

```bash
# 1. Node.js 22 LTS (via NodeSource) + core tools + wordlists
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs git python3 python3-pip netcat-openbsd \
  dnsutils whois traceroute openssl curl jq nmap masscan seclists \
  libpcap-dev          # libpcap-dev is only needed to build masscan from source

# 2. Username collectors (official PyPI packages)
pip install --user --break-system-packages sherlock-project maigret
export PATH="$HOME/.local/bin:$PATH"

# 3. DNS/subdomain/email collectors (official GitHub repos — NOT the PyPI placeholders)
git clone https://github.com/darkoperator/dnsrecon
cd dnsrecon && pip install --user --break-system-packages . && cd ..
git clone https://github.com/aboul3la/Sublist3r
cd Sublist3r && pip install --user --break-system-packages . && cd ..

# 4. theHarvester — needs Python ≥ 3.12; uv fetches it automatically
curl -LsSf https://astral.sh/uv/install.sh | sh
export PATH="$HOME/.local/bin:$PATH"
git clone https://github.com/laramies/theHarvester
cd theHarvester && uv sync
ln -s "$PWD/.venv/bin/theHarvester" "$HOME/.local/bin/theHarvester" && cd ..

# 5. gobuster — prebuilt binary from GitHub releases (no Go needed)
curl -L -o /tmp/gobuster.tar.gz \
  https://github.com/OJ/gobuster/releases/download/v3.8.2/gobuster_Linux_x86_64.tar.gz
tar xzf /tmp/gobuster.tar.gz -C "$HOME/.local/bin" gobuster
chmod +x "$HOME/.local/bin/gobuster"

# 6. Get the source
git clone https://github.com/arcnosixta/osint-portal.git
cd osint-portal

# 7. Install dependencies
npm install
cp .env.example .env.local

# 8. Verify tools are detected, then start
npm test          # unit tests for segment parsers and the graph API
npm run dev       # → http://localhost:3000
```

> On Fedora/RHEL swap `apt` for `dnf` and the packages are: `nmap` `ncat`
> `bind-utils` `whois` `traceroute` `openssl` `curl` `jq` `masscan`
> `python3-pip`. The Python collectors (sherlock, maigret, dnsrecon,
> Sublist3r, theHarvester) and gobuster install exactly as in the guide above.

> On Fedora/RHEL swap `apt` for `dnf` and the packages are: `nmap` `ncat`
> `bind-utils` `whois` `traceroute` `openssl` `curl` `jq`.

### 🍎 macOS

```bash
# 1. Homebrew (or use https://nodejs.org for the official installer)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 2. Node.js 22 LTS + toolchain
brew install node@22 git python3 nmap netcat whois \
  openssl jq traceroute masscan gobuster seclists

# 3. Username collectors
python3 -m pip install --user --break-system-packages sherlock-project maigret
export PATH="$HOME/.local/bin:$PATH"          # Homebrew Python… or "$HOME/Library/Python/3.13/bin"

# 4. DNS/subdomain/email collectors from official repos
git clone https://github.com/darkoperator/dnsrecon
cd dnsrecon && python3 -m pip install --user --break-system-packages . && cd ..
git clone https://github.com/aboul3la/Sublist3r
cd Sublist3r && python3 -m pip install --user --break-system-packages . && cd ..

# 5. theHarvester via uv (uv manages its own Python ≥ 3.12)
curl -LsSf https://astral.sh/uv/install.sh | sh
export PATH="$HOME/.local/bin:$PATH"
git clone https://github.com/laramies/theHarvester
cd theHarvester && uv sync
ln -s "$PWD/.venv/bin/theHarvester" "$HOME/.local/bin/theHarvester" && cd ..

# 6. Source + install
git clone https://github.com/arcnosixta/osint-portal.git
cd osint-portal
npm install
cp .env.example .env.local

# 7. Verify + run
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

# Username search across thousands of sites (maigret)
curl -X POST http://localhost:3000/api/tools/maigret \
  -H 'Content-Type: application/json' \
  -d '{"target":"octocat","args":["--timeout","30"]}'

# Subdomain discovery / DNS enumeration
curl -X POST http://localhost:3000/api/tools/sublist3r \
  -H 'Content-Type: application/json' \
  -d '{"target":"example.com"}'
curl -X POST http://localhost:3000/api/tools/dnsrecon \
  -H 'Content-Type: application/json' \
  -d '{"target":"example.com","args":["-t","std"]}'

# Email/host harvesting
curl -X POST http://localhost:3000/api/tools/theHarvester \
  -H 'Content-Type: application/json' \
  -d '{"target":"example.com","args":["-l","100"]}'

# Fast port scanning (private/loopback targets by default)
curl -X POST http://localhost:3000/api/tools/masscan \
  -H 'Content-Type: application/json' \
  -d '{"target":"127.0.0.1","args":["-p","1-1024"]}'

# Directory brute-force — needs a mode + a wordlist on disk or seclists
curl -X POST http://localhost:3000/api/tools/gobuster \
  -H 'Content-Type: application/json' \
  -d '{"target":"http://127.0.0.1:3000","args":["dir"]}'

# Fetch JSON and filter it with jq
curl -X POST http://localhost:3000/api/tools/jq \
  -H 'Content-Type: application/json' \
  -d '{"target":"http://localhost:3000/api/health","args":[".service"]}'

# Health
curl http://localhost:3000/api/health

# Evidence store — every successful run lands here
curl http://localhost:3000/api/evidence

# Correlated entity graph built from the evidence (nodes + links)
curl http://localhost:3000/api/graph

# Wipe evidence (also clears the local graph cache)
curl -X DELETE http://localhost:3000/api/evidence
```

By default only loopback/private targets are allowed; extend with
`OSINT_ALLOWED_TARGETS` (see [`.env.example`](./.env.example)). Raw IP/CIDR
targets are always gated; read-only DNS/registry segments (dig, host, whois)
accept public hostname targets.

### Entity graph (`/graph`)

Open `/graph` to see everything you've collected as one living map: usernames,
domains, hosts, IPs, emails and ports become colored nodes; edges carry the
kind of relation (`profile`, `resolution`, `port`, `service`, `subdomain` …).

Behavior worth knowing:

- **Nodes don't wander** — physics runs only to settle the initial layout and
  while you actively drag a node; otherwise the canvas is static. Pan/zoom
  never stir the layout. With `prefers-reduced-motion` nothing moves at all.
- **Layout survives reloads** — positions are saved to
  `localStorage["osint-portal-graph-layout"]` and restored next visit.
- **Server-first, local fallback** — the page uses `/api/graph` when it has
  data; if the store is empty or offline it shows the last cached snapshot
  from `localStorage["osint-portal-graph"]` with a **local cache** badge.
- **Everything is stale-safe** — clearing evidence (`× Ajax`-free Trash button
  or `DELETE /api/evidence`) also drops both local keys.

UI keys the app persists (`osint-portal-*` prefix):

| Key | Holds |
|---|---|
| `osint-portal-lang` | chosen UI language (`en` / `ru`) |
| `osint-portal-workbench-history` | last 8 runs per shared history |
| `osint-portal-graph` | last graph payload snapshot (local fallback) |
| `osint-portal-graph-layout` | node positions for a stable, static layout |

### Environment variables

| Variable | Purpose | Default |
|---|---|---|
| `OSINT_ALLOWED_TARGETS` | comma-separated extra targets (CIDRs/IPs/domains) | loopback + private ranges |
| `OSINT_RUN_TIMEOUT_MS` | hard timeout per tool run | 20000 (sherlock 60000) |
| `OSINT_MAX_OUTPUT_BYTES` | max captured stdout/stderr per run | 64000 |
| `ANYA_OLLAMA_URL` | local Ollama endpoint (used automatically) | `http://127.0.0.1:11434` |
| `ANYA_GROQ_API_KEY` | free Groq key (Llama 3.1 8B) | — |
| `ANYA_OPENROUTER_API_KEY` | free OpenRouter `:free` models | — |
| `ANYA_API_KEY` + `ANYA_BASE_URL` + `ANYA_MODEL` | any OpenAI-compatible endpoint | — |
| `ANYA_TIMEOUT_MS` | hard timeout per Anya reply | 30000 |

Copy `.env.example` to `.env.local` to override.

### Anya — the AI assistant

Anya lives in the bottom-right corner of every page (except the full-screen
`/anya` chat, where the widget hides itself):

```bash
# Chat with Anya
curl -X POST http://localhost:3000/api/anya \
  -H 'Content-Type: application/json' \
  -d '{"language":"ru","messages":[{"role":"user","content":"как использовать nmap?"}]}'

# See which model backends are configured
curl http://localhost:3000/api/anya
```

**Free backends — pick any:**

| Backend | Setup | Cost |
|---|---|---|
| [Ollama](https://ollama.com) (local) | `curl -fsSL https://ollama.com/install.sh \| sh` then `ollama pull qwen2.5:3b` | free, your hardware |
| [Groq](https://console.groq.com/keys) | put `ANYA_GROQ_API_KEY` in `.env.local` | free tier |
| [OpenRouter](https://openrouter.ai/keys) | put `ANYA_OPENROUTER_API_KEY` in `.env.local` (uses `:free` models) | free tier |
| Any OpenAI-compatible API | `ANYA_API_KEY`/`ANYA_BASE_URL`/`ANYA_MODEL` | provider-dependent |

With no backend configured Anya stays online using her built-in offline brain —
and tells you how to upgrade her.

**Full-screen pink chat:** open `/anya` (link in the widget header) for a
dedicated page where her mood slowly cross-fades the backdrop photo.

**Photos (emotions):** push your own into `public/anya/` — the code reads exactly
these names and never renames them:

| File | Used for |
|---|---|
| `public/anya/anya.png` | neutral / default portrait |
| `public/anya/thinking_anya.png` | she's thinking (waiting for a reply) |
| `public/anya/zlaia_anya.png` | angry (your message made her mad) |
| `public/anya/happy_anya.png` | happy (celebrating with you) |
| `public/anya/hope_anya.png` | hoping (wishes you luck) |
| `public/anya/bye_anya.png` | goodbye (saying farewell) |

Missing photos fall back to the procedural SVG avatar, so nothing breaks before
you push the images.

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

- [x] Entity graph visualization / evidence store (`/graph`, `/api/evidence`)
- [ ] Reproducible reports
- [ ] Expand the catalog beyond the current 18 tools
- [ ] GitHub Actions CI

## License

[Apache 2.0](./LICENSE) © arcnosixta