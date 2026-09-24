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
- [ ] **Segments** — wiring real execution for each tool (one pull request per tool).
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

# Run a tool (segment wiring lands one-by-one)
curl -X POST http://localhost:3000/api/tools/nmap \
  -H 'Content-Type: application/json' \
  -d '{"target":"10.0.0.7"}'

# Health
curl http://localhost:3000/api/health
```

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
2. Implement an executor in `src/lib/executor.ts` following the existing stub
   contract (validated args, explicit target, structured result).
3. Ship tests. That's a reviewable PR that plugs the tool into the whole
   platform — cards, detection, and workbench APIs at once.

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the detailed contract.

## Roadmap

- [ ] Segment wiring (sherlock, nmap, netcat, whois, dig, ...) behind allow-lists
- [ ] Interactive workbench / graph visualization
- [ ] Evidence store + reproducible reports
- [ ] GitHub Actions CI

## License

[Apache 2.0](./LICENSE) © arcnosixta