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

## The vision

OSINT is a chain, not a single command:

```
sherlock username ──► nmap target ──► whois domain ──► dig DNS ──► jq merge
```

The portal wires the links: you type one target, the platform orchestrates the
collectors, correlates the results into a graph, and produces a report.

## Current state

- [x] **Cinematic landing** — WebGL particle field, kinetic typography, glitch
      effects, scanlines, terminal simulation, smooth scroll (Lenis + GSAP).
- [x] **Bilingual interface** — EN/RU switch, persisted to localStorage.
- [x] **Tool catalog** — 16 modules across 6 capability groups, live detection
      of locally-installed binaries.
- [x] **OSINT pipeline section** — pinned scroll through
      Collect → Correlate → Analyze → Visualize → Report.
- [x] **API skeleton** — safe seams (`/api/tools/*`) for tool execution with
      built-in shell-metacharacter filtering.
- [x] **Six live segments** (one PR per tool, all behind per-segment
      argument allow-lists, timeouts and output caps, with parser tests):
      - **nmap** — network scan (ports, service/OS fingerprint), `data.ports`.
      - **netcat** — TCP connect-probe of single ports (Ncat), `data.ports`.
      - **dig** — DNS lookups (A/AAAA/MX/TXT/NS/…), `data.records`.
      - **host** — lightweight DNS resolution, `data.records`.
      - **whois** — registry data (wired; needs `sudo apt install whois`).
      - **sherlock** — username search across 400+ platforms
        (`pip install --user sherlock-project`), `data.found`.
- [ ] **More segments** — wiring real execution one pull request per tool.
- [ ] **Workbench** — visual command center that drives the pipeline.

## Tech stack

| Layer | Choice |
|---|---|
| Web | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS v4, design tokens (matrix-green cyberpunk) |
| Motion | GSAP + ScrollTrigger + SplitText, Lenis smooth scroll, Motion (Framer) |
| Scene | Three.js custom WebGL particle/reticle background |
| API | Next.js Route Handlers (`/api/tools/*`) |

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Production build:

```bash
npm run build && npm run start
```

## API

```bash
# Catalog + local binary detection
curl http://localhost:3000/api/tools

# Run a tool — nmap segment is live (allow-listed targets only)
curl -X POST http://localhost:3000/api/tools/nmap \
  -H 'Content-Type: application/json' \
  -d '{"target":"127.0.0.1","args":["-p","80,443"]}'

# DNS lookup (public hostnames allowed for read-only DNS segments)
curl -X POST http://localhost:3000/api/tools/dig \
  -H 'Content-Type: application/json' \
  -d '{"target":"example.com","args":["-t","MX"]}'

# Username search (installed via `pip install --user sherlock-project`)
curl -X POST http://localhost:3000/api/tools/sherlock \
  -H 'Content-Type: application/json' \
  -d '{"target":"octocat","args":["--timeout","3"]}'

# Run the tests
npm test

# Health
curl http://localhost:3000/api/health
```

By default only loopback/private targets are allowed; extend with
`OSINT_ALLOWED_TARGETS` (see [`.env.example`](./.env.example)). Raw IP/CIDR
targets are always gated; read-only DNS/registry segments (dig, host, whois)
accept public hostname targets.

## Responsible use

This project exists for **ethical investigations only**: authorized security
assessments, transparency research and verification. See the in-app ethics
section and [`SECURITY.md`](./SECURITY.md). The API layer rejects shell
metacharacters and will gate execution behind explicit target allow-lists as
segments land.

## Contributing — adding a segment

Each tool is a "segment". Adding one is intentionally small:

1. Register the tool in [`src/lib/tools.ts`](./src/lib/tools.ts) (id, name,
   command, description EN/RU, category, status).
2. Implement a segment in `src/lib/segments/` — declare its argument
   allow-list via the shared validator in `args.ts`, gate the target with
   `allowList.contains(...)`, run through `spawn.ts`, parse structured output,
   then register it in `src/lib/segments/index.ts`.
3. Ship tests (`src/lib/**/*.test.ts`). That's a reviewable PR that plugs the
   tool into the whole platform — cards, detection, and workbench APIs at once.

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the detailed contract.

## Roadmap

- [ ] More segment wiring (maigret, sublist3r, theHarvester, gobuster, ...) behind allow-lists
- [ ] Interactive workbench / graph visualization
- [ ] Evidence store + reproducible reports
- [ ] GitHub Actions CI

## License

[Apache 2.0](./LICENSE) © arcnosixta