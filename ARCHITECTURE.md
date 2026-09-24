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
│  • routes wired segments via src/lib/segments               │
│ Segments (src/lib/segments)                                 │
│  • index.ts       → SEGMENTS registry, isSegmentConnected   │
│  • spawn.ts       → shell-free runner, timeout + cap        │
│  • args.ts        → shared flag/value/positional validator  │
│  • nmap.ts        → reference network scanner               │
│  • netcat.ts      → TCP port probe (Ncat, one port/process) │
│  • dig.ts, host.ts, whois.ts → DNS / registry read-only     │
│  • sherlock.ts    → username search (pip --user install)    │
│ Allow-list (src/lib/security/allowlist.ts)                  │
│  • CIDR/IPv6/domain matcher, defaults private+loopback      │
│  • env OSINT_ALLOWED_TARGETS extends it                     │
│  • publicHostnames opt-in for read-only DNS/registry runs   │
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
  connected: boolean;  // false for unwired/misconfigured tools
  message: string;
  durationMs: number;
  startedAt: string;
  local?: boolean;
  available?: boolean;
  excerpt?: string;
  status?: "ok" | "error" | "blocked";
  blocked?: boolean;   // 403 at the route layer
  data?: unknown;      // structured segment output (e.g. nmap: ports, os)
  stdout?: string;     // capped raw output
  exitCode?: number | null;
}
```

Each segment implements this contract, then flips `status` from `"planned"` to
`"module"`/`"online"` in `src/lib/tools.ts`. The UI cards, local detection, and
API all read the same catalog, so a single PR wires a tool into everything.

## Safety model (per-segment)

Segments are the only place a process is ever spawned. Enforced now:

- **Target allow-list.** `src/lib/security/allowlist.ts` checks every target
  against CIDR/IPv6/domain rules; defaults cover loopback + private ranges, and
  `OSINT_ALLOWED_TARGETS` extends it. Restricted targets → `403`. Raw IP/CIDR
  targets are always gated; read-only DNS/registry segments (dig, host, whois)
  additionally accept well-formed public hostnames via `publicHostnames` — the
  query itself is the intent, and the portal never becomes an open scanning relay.
- **Argument allow-lists per tool.** Every segment declares exactly which flags,
  values and positional tokens it forwards via `src/lib/segments/args.ts`;
  everything else is rejected up front (e.g. netcat `-e/-c`, dig `@resolver`,
  sherlock `--output`, any `>`/`<` redirect).
- Shell metacharacters are rejected before any executor runs.
- Tool ids must match `/^[a-z0-9-_.]+$/i`.
- Every run has a hard timeout (`OSINT_RUN_TIMEOUT_MS`, default 20s) and an
  output cap (`OSINT_MAX_OUTPUT_BYTES`, default 64KB) enforced in `spawn.ts`.
- Route handlers are all `force-dynamic` (never prerendered/static).

## Testing

`npm test` runs `src/lib/**/*.test.ts` with the node test runner (via `tsx`):
allow-list semantics (incl. `publicHostnames`), shared argument validation,
and parser tests for nmap, netcat, dig, host, whois and sherlock output.

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