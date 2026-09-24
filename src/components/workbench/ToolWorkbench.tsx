"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Copy,
  Eraser,
  History,
  Play,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TerminalSquare,
} from "lucide-react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { gsap, isReducedMotion } from "@/lib/animations";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";
import { getWorkbench } from "@/lib/workbench";
import { TOOL_CATEGORIES, TOOLS, type Tool, type ToolStatus } from "@/lib/tools";
import { cn } from "@/lib/utils";
import { sleep } from "@/lib/utils";
import ResultView from "./ResultView";

const HISTORY_KEY = "osint-portal-workbench-history";

type RunStatus = "ok" | "error" | "blocked";

interface RunResponse {
  ok: boolean;
  connected: boolean;
  message: string;
  durationMs: number;
  startedAt: string;
  status?: RunStatus;
  data?: unknown;
  stdout?: string;
  exitCode?: number | null;
  available?: boolean;
  blocked?: boolean;
  excerpt?: string;
  timedOut?: boolean;
}

interface HistoryItem {
  id: number;
  command: string;
  status: string;
  durationMs: number;
  response: RunResponse;
}

type LineKind = "banner" | "cmd" | "out" | "err" | "meta" | "divider";

interface ConsoleLine {
  id: number;
  kind: LineKind;
  text?: string;
  status?: RunStatus;
  durationMs?: number;
}

interface ToolWorkbenchProps {
  tool: Tool;
  available: boolean | null;
  connected: boolean;
  localCount: number;
  toolCount: number;
}

const STATUS_STYLES: Record<ToolStatus, string> = {
  online: "text-primary border-primary/50 bg-primary/10",
  module: "text-sky-400 border-sky-400/40 bg-sky-400/10",
  planned: "text-muted-foreground border-border bg-muted/40",
};

const STATUS_DOT: Record<ToolStatus, string> = {
  online: "bg-primary pulse-soft",
  module: "bg-sky-400 pulse-soft",
  planned: "bg-muted-foreground",
};

const RESULT_STATUS_STYLES: Record<RunStatus, string> = {
  ok: "text-primary border-primary/50 bg-primary/10",
  error: "text-accent border-accent/50 bg-accent/10",
  blocked: "text-[#fbbf24] border-[#fbbf24]/50 bg-[#fbbf24]/10",
};

const RESULT_LABEL: Record<RunStatus, string> = {
  ok: "ok",
  error: "error",
  blocked: "blocked",
};

function parseArgs(raw: string): string[] {
  const out = raw.trim().split(/\s+/).filter(Boolean);
  return out;
}

function findUnit(args: string[], unit: string[]): number {
  outer: for (let i = 0; i <= args.length - unit.length; i++) {
    for (let j = 0; j < unit.length; j++) {
      if (args[i + j] !== unit[j]) continue outer;
    }
    return i;
  }
  return -1;
}

export default function ToolWorkbench({
  tool,
  available,
  connected,
  localCount,
  toolCount,
}: ToolWorkbenchProps) {
  const { lang, dict } = useLanguage();
  const reducedMotion = usePrefersReducedMotion();
  const profile = useMemo(() => getWorkbench(tool), [tool]);
  const t = dict.workbench;

  const [target, setTarget] = useState(
    () => profile.presets[0]?.target ?? "",
  );
  const [argsStr, setArgsStr] = useState(
    () => profile.presets[0]?.args.join(" ") ?? "",
  );
  const [running, setRunning] = useState(false);
  const [typedCmd, setTypedCmd] = useState("");
  const [log, setLog] = useState<ConsoleLine[]>(() => [
    { id: -1, kind: "banner", text: `OSINT-PORTAL · ${tool.name} · ${t.segmentRunner}` },
    { id: -2, kind: "banner", text: t.awaitingInput },
  ]);
  const [result, setResult] = useState<RunResponse | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [copied, setCopied] = useState(false);

  const runIdRef = useRef(0);
  const idRef = useRef(0);
  const consoleRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const nextId = useCallback(() => ++idRef.current, []);

  const appendMeta = useCallback(
    (line: Omit<ConsoleLine, "id">) => {
      setLog((prev) => [...prev, { ...line, id: nextId() }]);
    },
    [nextId],
  );

  const fullCommand = useMemo(() => {
    const args = parseArgs(argsStr);
    return [profile.runner, ...args, target.trim()].filter(Boolean).join(" ");
  }, [profile.runner, argsStr, target]);

  const presetKey = `${target}\n${argsStr.trim()}`;

  // banner seeded in state initializer (avoids an effect); history hydration
  // below must happen in an effect so SSR HTML and the client never mismatch
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(HISTORY_KEY);
      if (raw) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- documented hydration pattern: must not differ between server and first client render
        setHistory(JSON.parse(raw) as HistoryItem[]);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // autoscroll console
  useEffect(() => {
    const el = consoleRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log, typedCmd, running]);

  // entrance animations
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (isReducedMotion()) {
      gsap.set(root.querySelectorAll("[data-wb-anim]"), { autoAlpha: 1, y: 0 });
      return;
    }
    const ctx = gsap.context(() => {
      gsap.from("[data-wb-anim]", {
        y: 30,
        autoAlpha: 0,
        duration: 0.7,
        stagger: 0.08,
        ease: "power3.out",
      });
    }, root);
    return () => ctx.revert();
  }, []);

  const run = useCallback(async () => {
    if (running) return;
    const args = parseArgs(argsStr);
    const tgt = target.trim();
    if (!tgt) {
      appendMeta({ kind: "err", text: t.targetRequired, status: "error" });
      return;
    }

    const command = [profile.runner, ...args, tgt].join(" ");
    const id = ++runIdRef.current;
    setResult(null);
    setRunning(true);
    setTypedCmd("");

    const doFetch = async () => {
      let res: Response;
      try {
        res = await fetch(`/api/tools/${tool.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target: tgt, args }),
        });
      } catch {
        if (runIdRef.current !== id) return;
        appendMeta({ kind: "err", text: t.networkError, status: "error" });
        setRunning(false);
        setTypedCmd("");
        return;
      }

      let json: RunResponse;
      try {
        json = (await res.json()) as RunResponse;
      } catch {
        json = {
          ok: false,
          connected: false,
          message: t.unparseable,
          durationMs: 0,
          startedAt: new Date().toISOString(),
          status: "error",
        };
      }

      if (runIdRef.current !== id) return;

      const status: RunStatus =
        json.status ?? (json.ok ? "ok" : json.blocked ? "blocked" : "error");

      const lines: ConsoleLine[] = [{ id: nextId(), kind: "cmd", text: command }];
      if (json.stdout) {
        for (const l of json.stdout.split("\n")) {
          if (l.trim()) lines.push({ id: nextId(), kind: "out", text: l.replace(/\r$/, "") });
        }
      }
      if (json.connected === false && !json.blocked)
        lines.push({ id: nextId(), kind: "meta", text: json.message, status });
      else if (json.blocked) lines.push({ id: nextId(), kind: "meta", text: json.message, status });
      else lines.push({ id: nextId(), kind: "meta", text: json.message, status, durationMs: json.durationMs });

      lines.push({ id: nextId(), kind: "divider" });
      setLog((prev) => [...prev, ...lines]);
      setResult(json);
      setHistory((prev) => {
        const next = [{ id, command, status: RESULT_LABEL[status], durationMs: json.durationMs, response: json }, ...prev].slice(0, 8);
        try {
          window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
      setRunning(false);
      setTypedCmd("");
    };

    if (reducedMotion) {
      setTypedCmd(command);
      await doFetch();
      return;
    }

    for (let i = 1; i <= command.length; i++) {
      if (runIdRef.current !== id) return;
      setTypedCmd(command.slice(0, i));
      await sleep(16);
    }
    await doFetch();
  }, [running, argsStr, target, profile.runner, tool.id, appendMeta, nextId, t, reducedMotion]);

  const toggleChip = useCallback(
    (unit: string[]) => {
      setArgsStr((prev) => {
        const cur = parseArgs(prev);
        const index = findUnit(cur, unit);
        if (index >= 0) {
          return cur.filter((_, i) => i < index || i >= index + unit.length).join(" ");
        }
        return [...cur, ...unit].join(" ");
      });
    },
    [],
  );

  const applyPreset = useCallback(
    (p: { target: string; args: string[] }) => {
      setTarget(p.target);
      setArgsStr(p.args.join(" "));
    },
    [],
  );

  const loadHistory = useCallback(
    (item: HistoryItem) => {
      const tokens = item.command.split(/\s+/);
      const runner = tokens[0];
      const rest = tokens.slice(1);
      const tgt = rest.at(-1);
      const args = rest.slice(0, -1);
      if (runner === profile.runner && tgt) {
        setTarget(tgt);
        setArgsStr(args.join(" "));
        return;
      }
      setResult(item.response);
    },
    [profile.runner],
  );

  const copyResult = useCallback(async () => {
    const text = result?.stdout || result?.message || "";
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  }, [result]);

  const clearConsole = useCallback(() => {
    setLog([
      { id: nextId(), kind: "banner", text: `OSINT-PORTAL · ${tool.name} · ${t.segmentRunner}` },
      { id: nextId(), kind: "banner", text: t.awaitingInput },
    ]);
  }, [nextId, t, tool.name]);

  const clearHistory = useCallback(() => {
    setHistory([]);
    try {
      window.localStorage.removeItem(HISTORY_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const related = useMemo(
    () => TOOLS.filter((x) => x.id !== tool.id && x.category === tool.category).slice(0, 3),
    [tool.id, tool.category],
  );

  const resultStatus: RunStatus =
    result?.status ?? (result ? (result.ok ? "ok" : result.blocked ? "blocked" : "error") : "ok");

  return (
    <div ref={rootRef} className="relative">
      <div className="mx-auto w-full max-w-6xl px-6 sm:px-10">
        {/* ---------- header ---------- */}
        <header data-wb-anim className="hud-corner relative mt-4 rounded-xl border border-border bg-card/40 p-6 backdrop-blur-sm sm:p-8">
          <Link
            href="/#tools"
            className="group inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-primary"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-x-0.5" aria-hidden="true" />
            {t.backToLibrary}
          </Link>

          <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="font-mono text-xs font-medium uppercase tracking-[0.45em] text-primary glow-soft">
                {TOOL_CATEGORIES[tool.category][lang]} / {t.kicker}
              </p>
              <h1 className="glitch mt-4 font-sans text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
                {tool.name}
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                {tool.desc[lang]}
              </p>

              {/* canonical command */}
              <div className="mt-6 flex items-center gap-2 overflow-x-auto rounded-md border border-border bg-black/70 px-3 py-2.5 font-mono text-xs text-primary/90">
                <TerminalSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="whitespace-nowrap">$ {tool.command}</span>
              </div>
            </div>

            {/* meta chips */}
            <div className="flex flex-col gap-2.5 lg:items-end">
              <span
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-xs uppercase tracking-wider",
                  STATUS_STYLES[tool.status],
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[tool.status])} />
                {tool.status === "online"
                  ? dict.tools.statusOnline
                  : tool.status === "module"
                    ? dict.tools.statusModule
                    : dict.tools.statusPlanned}
              </span>

              <span
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-xs uppercase tracking-wider",
                  connected
                    ? tool.local && !available
                      ? "border-[#fbbf24]/50 bg-[#fbbf24]/10 text-[#fbbf24]"
                      : "border-primary/50 bg-primary/10 text-primary"
                    : "border-border bg-muted/40 text-muted-foreground",
                )}
              >
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                {!connected
                  ? t.badgePending
                  : tool.local && !available
                    ? t.badgeNoBinary
                    : t.badgeWired}
              </span>

              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-muted-foreground">
                {t.availability}: {available ? t.badgePresent : t.badgeMissing}
              </span>

              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
                {localCount} / {toolCount} {t.localCountLabel}
              </span>
            </div>
          </div>

          {!connected && (
            <div className="mt-6 flex items-start gap-2.5 rounded-lg border border-[#fbbf24]/40 bg-[#fbbf24]/5 px-4 py-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#fbbf24]" aria-hidden="true" />
              <p className="font-mono text-xs leading-relaxed text-[#fbbf24]/90">{t.notConnected}</p>
            </div>
          )}

          {connected && tool.local && !available && (
            <div className="mt-6 flex items-start gap-2.5 rounded-lg border border-[#fbbf24]/40 bg-[#fbbf24]/5 px-4 py-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#fbbf24]" aria-hidden="true" />
              <p className="font-mono text-xs leading-relaxed text-[#fbbf24]/90">{t.binaryMissing}</p>
            </div>
          )}
        </header>

        {/* ---------- workbench grid ---------- */}
        <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(340px,400px)]">
          {/* console + results */}
          <div className="flex flex-col gap-6">
            {/* terminal console */}
            <section data-wb-anim className="overflow-hidden rounded-xl border border-border bg-black/70 backdrop-blur-sm">
              <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                <span className="h-3 w-3 rounded-full bg-accent/80" />
                <span className="h-3 w-3 rounded-full bg-[#fbbf24]/80" />
                <span className="h-3 w-3 rounded-full bg-primary/80" />
                <span className="ml-3 truncate font-mono text-xs text-muted-foreground">
                  {tool.name} — {t.segmentRunner}
                </span>
                <span className="ml-auto flex items-center gap-2">
                  {running && (
                    <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary pulse-soft" />
                      {t.running}
                    </span>
                  )}
                  <button
                    onClick={clearConsole}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-border px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary"
                    title={t.clear}
                  >
                    <Eraser className="h-3 w-3" aria-hidden="true" />
                    <span className="hidden sm:inline">{t.clear}</span>
                  </button>
                </span>
              </div>

              <div ref={consoleRef} className="scanlines relative h-[360px] overflow-y-auto px-5 py-4 font-mono text-[13px] leading-relaxed">
                {log.map((line) => {
                  if (line.kind === "divider") {
                    return (
                      <div key={line.id} className="my-2 h-px bg-border/60" aria-hidden="true" />
                    );
                  }
                  if (line.kind === "banner") {
                    return (
                      <p key={line.id} className="text-primary/70">
                        <span className="text-muted-foreground">{"// "}</span>
                        {line.text}
                      </p>
                    );
                  }
                  if (line.kind === "cmd") {
                    return (
                      <p key={line.id} className="mt-1 text-foreground/90">
                        <span className="text-primary">{dict.hero.terminalPrompt}</span>
                        <span className="text-muted-foreground"> $ </span>
                        {line.text}
                      </p>
                    );
                  }
                  if (line.kind === "out") {
                    return (
                      <p key={line.id} className="whitespace-pre-wrap break-words text-foreground/85">
                        {line.text}
                      </p>
                    );
                  }
                  if (line.kind === "err") {
                    return (
                      <p key={line.id} className="whitespace-pre-wrap break-words text-[#ff6b6b]">
                        {line.text}
                      </p>
                    );
                  }
                  // meta
                  const statusColor =
                    line.status === "ok"
                      ? "text-primary"
                      : line.status === "blocked"
                        ? "text-[#fbbf24]"
                        : "text-[#ff6b6b]";
                  return (
                    <p key={line.id} className={cn("mt-1", statusColor)}>
                      <span className="text-muted-foreground">▸ </span>
                      {line.text}
                      {line.durationMs != null && (
                        <span className="text-muted-foreground"> · {line.durationMs}ms</span>
                      )}
                    </p>
                  );
                })}

                {running && (
                  <p className="mt-1 text-foreground/90">
                    <span className="text-primary">{dict.hero.terminalPrompt}</span>
                    <span className="text-muted-foreground"> $ </span>
                    <span>{typedCmd}</span>
                    <span className="cursor-blink text-primary">▍</span>
                  </p>
                )}

                {!running && log.length === 0 && (
                  <p className="text-muted-foreground">…</p>
                )}
              </div>
            </section>

            {/* result panel */}
            <section data-wb-anim className="overflow-hidden rounded-xl border border-border bg-card/40 backdrop-blur-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
                <div className="flex items-center gap-2 font-mono text-sm text-foreground">
                  <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
                  {t.resultHeading}
                </div>
                {result && (
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider",
                        RESULT_STATUS_STYLES[resultStatus],
                      )}
                    >
                      <span
                        className={cn(
                          "mr-1.5 h-1.5 w-1.5 rounded-full",
                          resultStatus === "ok"
                            ? "bg-primary"
                            : resultStatus === "blocked"
                              ? "bg-[#fbbf24]"
                              : "bg-accent",
                        )}
                      />
                      {RESULT_LABEL[resultStatus]}
                    </span>
                    {result.durationMs != null && (
                      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        {result.durationMs}ms
                      </span>
                    )}
                    {result.exitCode != null && (
                      <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                        {t.exit} {result.exitCode}
                      </span>
                    )}
                    <button
                      onClick={copyResult}
                      className="cursor-pointer rounded border border-border px-2 py-1 font-mono text-[10px] text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary"
                    >
                      {copied ? <Check className="h-3 w-3" aria-hidden="true" /> : <Copy className="h-3 w-3" aria-hidden="true" />}
                    </button>
                  </div>
                )}
              </div>

              <div className="p-5">
                {!result ? (
                  <div className="flex flex-col items-center gap-3 py-10 text-center">
                    <TerminalSquare className="h-8 w-8 text-muted-foreground/40" aria-hidden="true" />
                    <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground/60">
                      {t.awaitingInput}
                    </p>
                  </div>
                ) : result.connected === false && !result.blocked ? (
                  <p className="font-mono text-sm leading-relaxed text-foreground/85">{result.message}</p>
                ) : result.blocked ? (
                  <p className="whitespace-pre-wrap break-words font-mono text-sm leading-relaxed text-[#fbbf24]">
                    {result.message}
                  </p>
                ) : profile.resultView !== "plain" && result.data !== undefined ? (
                  <ResultView view={profile.resultView} data={result.data} />
                ) : (
                  <pre className="scanlines relative max-h-80 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-foreground/85">
                    {result.stdout || result.message}
                  </pre>
                )}
              </div>
            </section>
          </div>

          {/* ---------- control deck ---------- */}
          <aside className="flex flex-col gap-6 lg:sticky lg:top-24">
            <section data-wb-anim className="overflow-hidden rounded-xl border border-border bg-card/40 backdrop-blur-sm">
              <div className="flex items-center gap-2 border-b border-border px-5 py-4 font-mono text-sm text-foreground">
                <SlidersHorizontal className="h-4 w-4 text-primary" aria-hidden="true" />
                {t.deckTitle}
              </div>

              <div className="flex flex-col gap-5 p-5">
                {/* target */}
                <label className="flex flex-col gap-1.5">
                  <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                    {t.target}
                  </span>
                  <input
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && run()}
                    placeholder={profile.targetPlaceholder[lang]}
                    spellCheck={false}
                    autoComplete="off"
                    className="h-11 w-full rounded-md border border-border bg-black/70 px-3 font-mono text-sm text-foreground placeholder:text-muted-foreground/50 transition-colors focus:border-primary/70 focus:outline-none"
                  />
                </label>

                {/* args */}
                <label className="flex flex-col gap-1.5">
                  <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                    {t.args}
                  </span>
                  <input
                    value={argsStr}
                    onChange={(e) => setArgsStr(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && run()}
                    placeholder={t.argsPlaceholder}
                    spellCheck={false}
                    autoComplete="off"
                    className="h-11 w-full rounded-md border border-border bg-black/70 px-3 font-mono text-sm text-foreground placeholder:text-muted-foreground/50 transition-colors focus:border-primary/70 focus:outline-none"
                  />
                </label>

                {/* command preview */}
                <div className="flex items-center gap-2 overflow-x-auto rounded-md border border-primary/25 bg-primary/5 px-3 py-2 font-mono text-xs text-primary">
                  <span className="text-muted-foreground">$</span>
                  <span className="whitespace-nowrap">{fullCommand || "…"}</span>
                </div>

                {/* presets */}
                {profile.presets.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                      {t.presets}
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      {profile.presets.map((p) => {
                        const active = presetKey === `${p.target}\n${p.args.join(" ")}`;
                        return (
                          <button
                            key={p.id}
                            onClick={() => applyPreset(p)}
                            className={cn(
                              "cursor-pointer rounded-md border px-3 py-2 text-left transition-colors",
                              active
                                ? "border-primary/70 bg-primary/10 text-primary"
                                : "border-border bg-black/40 text-muted-foreground hover:border-primary/50 hover:text-foreground",
                            )}
                          >
                            <span className="block font-mono text-xs leading-tight">{p.label[lang]}</span>
                            <span className="mt-1 block truncate font-mono text-[10px] text-muted-foreground/70">
                              {p.target}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* palette chips */}
                {profile.chips.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                      {t.palette}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {profile.chips.map((chip) => {
                        const cur = parseArgs(argsStr);
                        const active = findUnit(cur, chip.args) >= 0;
                        return (
                          <button
                            key={chip.id}
                            onClick={() => toggleChip(chip.args)}
                            className={cn(
                              "cursor-pointer rounded-md border px-2.5 py-1.5 font-mono text-xs transition-all",
                              active
                                ? "border-primary bg-primary/15 text-primary shadow-[0_0_12px_rgba(0,255,65,0.2)]"
                                : "border-border bg-black/40 text-muted-foreground hover:border-primary/50 hover:text-primary",
                            )}
                          >
                            {chip.label[lang]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* run */}
                <button
                  onClick={run}
                  disabled={running || !connected}
                  className={cn(
                    "group relative inline-flex h-12 items-center justify-center gap-2 overflow-hidden rounded-lg border border-primary/60 bg-primary/10 font-mono text-sm font-bold uppercase tracking-[0.2em] text-primary transition-all duration-200",
                    running
                      ? "cursor-wait"
                      : !connected
                        ? "cursor-not-allowed opacity-50"
                        : "cursor-pointer hover:bg-primary hover:text-black hover:shadow-[0_0_36px_rgba(0,255,65,0.45)]",
                  )}
                >
                  <Play
                    className={cn("h-4 w-4", running && "animate-pulse")}
                    aria-hidden="true"
                  />
                  {running ? t.running : t.run}
                </button>

                {connected && profile.wired && (
                  <p className="font-mono text-[10px] leading-relaxed text-muted-foreground/70">
                    {t.launchNote}
                  </p>
                )}
              </div>
            </section>

            {/* history */}
            <section data-wb-anim className="overflow-hidden rounded-xl border border-border bg-card/40 backdrop-blur-sm">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div className="flex items-center gap-2 font-mono text-sm text-foreground">
                  <History className="h-4 w-4 text-primary" aria-hidden="true" />
                  {t.history}
                </div>
                {history.length > 0 && (
                  <button
                    onClick={clearHistory}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-border px-2 py-1 font-mono text-[10px] text-muted-foreground transition-colors hover:border-accent/60 hover:text-accent"
                  >
                    <Eraser className="h-3 w-3" aria-hidden="true" />
                    {t.clear}
                  </button>
                )}
              </div>

              {history.length === 0 ? (
                <p className="px-5 py-6 font-mono text-xs text-muted-foreground/60">{t.historyEmpty}</p>
              ) : (
                <ul className="flex flex-col">
                  {history.map((item) => (
                    <li key={item.id} className="border-b border-border/60 last:border-b-0">
                      <button
                        onClick={() => loadHistory(item)}
                        title={t.reRunHint}
                        className="flex w-full cursor-pointer items-center justify-between gap-3 px-5 py-2.5 text-left transition-colors hover:bg-card/60"
                      >
                        <span className="truncate font-mono text-xs text-foreground/85">{item.command}</span>
                        <span className="flex shrink-0 items-center gap-2">
                          <span
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              item.status === "ok" ? "bg-primary" : item.status === "blocked" ? "bg-[#fbbf24]" : "bg-accent",
                            )}
                          />
                          <span className="font-mono text-[10px] text-muted-foreground">{item.durationMs}ms</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </aside>
        </div>

        {/* ---------- related tools ---------- */}
        {related.length > 0 && (
          <section className="mt-14">
            <p className="font-mono text-xs font-medium uppercase tracking-[0.45em] text-primary glow-soft">
              {t.related}
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {related.map((r) => (
                <Link
                  key={r.id}
                  href={`/tools/${r.id}`}
                  className="group rounded-xl border border-border bg-card/40 p-5 transition-all duration-200 hover:border-primary/60 hover:shadow-[0_0_30px_rgba(0,255,65,0.12)]"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-mono text-base font-semibold text-foreground">{r.name}</h4>
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider",
                        STATUS_STYLES[r.status],
                      )}
                    >
                      {r.status}
                    </span>
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                    {r.desc[lang]}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}