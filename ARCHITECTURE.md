# Architecture

OSINT Portal is organized so that new intelligence tools ("segments") plug in
through a single, stable seam instead of touching the whole platform.

## Layer map

```
┌─────────────────────────────────────────────────────────────┐
│ UI                                                          │
│  Navbar / Hero / Metrics / ToolsGrid / Pipeline / Ethics    │
│  bilingual context → src/i18n, LanguageProvider             │
├─────────────────────────────────────────────────────────────┤
│ Motion                                                      │
│  src/lib/animations.ts (GSAP register, reduced-motion)      │
│  SmoothScroll.tsx (Lenis ↔ GSAP ticker, one loop)           │
│  hero/WebGLBackground.tsx (Three.js, pause offscreen)       │
├─────────────────────────────────────────────────────────────┤
│ Data / catalog                                              │
│  src/lib/tools.ts   → single source of truth for tool cards │
│  src/lib/utils.ts   → cn() / helpers                        │
├─────────────────────────────────────────────────────────────┤
│ API (Route Handlers, all `force-dynamic`)                   │
│  GET  /api/health                                           │
│  GET  /api/tools                    catalog + PATH probing  │
│  GET|POST /api/tools/[tool]        run a tool (stub)        │
├─────────────────────────────────────────────────────────────┤
│ Executor seam                                               │
│  src/lib/executor.ts  runTool(req) → ToolRunResult          │
│  • validates id against catalog                             │
│  • rejects shell metacharacters in args (/[;&|`$<>(){}\n\r]/)│
│  • probes local availability with `which` (cached)          │
└─────────────────────────────────────────────────────────────┘
```

## The segment contract

`runTool(req: ToolRequest): Promise<ToolRunResult>`

```ts
interface ToolRequest {
  tool: string;        // catalog id, single source of truth
  target?: string;     // Ip / Host / Username / Domain (explicitly allow-listed)
  args?: string[];     // validated, sanitized; never raw shell
}

interface ToolRunResult {
  tool: string;
  connected: boolean;  // false until a real segment is wired
  message: string;
  durationMs: number;
  startedAt: string;
  local?: boolean;
  available?: boolean;
  excerpt?: string;
}
```

Each segment implements this contract, then flips `status` from `"planned"` to
`"module"`/`"online"` in `src/lib/tools.ts`. The UI cards, local detection, and
API all read the same catalog, so a single PR wires a tool into everything.

## Safety model (per-segment)

Segments are the only place a process is ever spawned. Enforced now:

- Shell metacharacters are rejected before any executor runs.
- Tool ids must match `/^[a-z0-9-_.]+$/i`.
- Route handlers are all `force-dynamic` (never prerendered/static).

Coming as segments land (see `SECURITY.md`):

- Explicit target allow-lists (owned/authorized CIDRs & domains) from `.env`.
- Timeouts and output-size caps per tool.
- Argument allow-lists instead of a block-list where possible.
- Structured, auditable run logs.

## Bilingual UI

`src/i18n/en.ts` exports the `Dictionary` type; `src/i18n/ru.ts` is typed
against it, so a missing RU translation is a build-time type error, not a
runtime crash. `LanguageProvider` (client) persists the choice to
`localStorage` and hydrates after mount to avoid SSR/CSR mismatch.

## Motion conventions

- One GSAP ticker drives Lenis; `ScrollTrigger.update` on Lenis scroll — no
  second `requestAnimationFrame` loop anywhere.
- All scroll/entrance animations go through `gsap.context()` in `useEffect`
  and are reverted on unmount.
- Every animated component honors `prefers-reduced-motion` via
  `src/lib/usePrefersReducedMotion.ts` (`useSyncExternalStore`, SSR-safe).