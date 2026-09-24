"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { AnyaAvatar, type AnyaMode } from "@/components/anya/AnyaAvatar";
import { cn } from "@/lib/utils";
import type { AnyaEmotion } from "@/lib/anya/types";

interface ChatMsg {
  id: number;
  role: "user" | "assistant";
  content: string;
  emotion?: AnyaEmotion;
}

interface ProviderMeta {
  provider: string;
  model: string;
}

const HISTORY_KEY = "osint-portal-anya-history";
const MAX_HISTORY = 40;

function loadHistory(): ChatMsg[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatMsg[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-MAX_HISTORY);
  } catch {
    return [];
  }
}

function saveHistory(msgs: ChatMsg[]) {
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(msgs.slice(-MAX_HISTORY)));
  } catch {
    /* storage unavailable */
  }
}

let nextId = 1;

export function AnyaPortal() {
  const { dict, lang } = useLanguage();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [revealingId, setRevealingId] = useState<number | null>(null);
  const [revealLen, setRevealLen] = useState(0);
  const [emotion, setEmotion] = useState<AnyaEmotion>("neutral");
  const [provider, setProvider] = useState<ProviderMeta | null>(null);
  const fullRef = useRef<Record<number, string>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bootedRef = useRef(false);

  const boot = () => {
    if (bootedRef.current) return;
    bootedRef.current = true;
    const stored = loadHistory();
    if (stored.length) {
      setMsgs(stored);
      const last = [...stored].reverse().find((m) => m.role === "assistant");
      if (last?.emotion) setEmotion(last.emotion);
    } else {
      const greeting = { id: nextId++, role: "assistant" as const, content: dict.anya.greeting };
      setMsgs([greeting]);
    }
  };

  useEffect(() => {
    boot(); // eslint-disable-line react-hooks/set-state-in-effect -- documented hydration pattern: localStorage transcript must not differ between server and first client render
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 60);
  }, [open]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, revealLen, open]);

  useEffect(() => {
    if (revealingId == null) return;
    const timer = window.setInterval(() => {
      setRevealLen((prev) => {
        const full = fullRef.current[revealingId];
        if (!full) return prev;
        if (prev >= full.length) {
          window.clearInterval(timer);
          setRevealingId(null);
          return prev;
        }
        return prev + 3;
      });
    }, 16);
    return () => window.clearInterval(timer);
  }, [revealingId]);

  // persist full transcripts
  useEffect(() => {
    if (bootedRef.current && msgs.length) saveHistory(msgs);
  }, [msgs]);

  const gaze = useMemo(() => {
    if (!input.length) return { x: 0, y: 0 };
    return { x: Math.max(-1, Math.min(1, ((input.length % 11) - 5) / 5)), y: 0 };
  }, [input]);

  const mode: AnyaMode = busy
    ? "thinking"
    : revealingId != null
      ? "speaking"
      : input.trim().length > 0
        ? "listening"
        : "idle";

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    const userMsg: ChatMsg = { id: nextId++, role: "user", content: text };
    setMsgs((prev) => [...prev, userMsg]);
    setInput("");
    setBusy(true);
    setEmotion("neutral");
    try {
      const apiMessages = [...msgs, userMsg]
        .slice(-12)
        .map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch("/api/anya", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages, language: lang }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        reply?: string;
        emotion?: AnyaEmotion;
        provider?: string;
        model?: string;
        message?: string;
      };
      if (!res.ok || !data.ok || typeof data.reply !== "string") {
        throw new Error(data.message || "bad response");
      }
      const id = nextId++;
      fullRef.current[id] = data.reply;
      setMsgs((prev) => [
        ...prev,
        { id, role: "assistant", content: data.reply!, emotion: data.emotion || "neutral" },
      ]);
      setProvider({ provider: data.provider || "local", model: data.model || "" });
      setEmotion(data.emotion || "neutral");
      setRevealLen(0);
      setRevealingId(id);
    } catch {
      const id = nextId++;
      setMsgs((prev) => [
        ...prev,
        { id, role: "assistant", content: dict.anya.networkError, emotion: "sad" },
      ]);
      setEmotion("sad");
    } finally {
      setBusy(false);
    }
  };

  const clear = () => {
    setMsgs([{ id: nextId++, role: "assistant", content: dict.anya.greeting }]);
    setProvider(null);
    setEmotion("neutral");
    try {
      window.localStorage.removeItem(HISTORY_KEY);
    } catch {
      /* noop */
    }
  };

  // ---------- floating button ----------
  if (!open) {
    return (
      <div className="fixed bottom-5 right-5 z-[70] flex items-center gap-3">
        <span
          className={cn(
            "hidden rounded-full border border-primary/40 bg-black/80 px-3 py-1.5 font-mono text-xs text-primary sm:inline-block",
            "pulse-soft",
          )}
        >
          {dict.anya.name} <span className="text-primary-dim">● {dict.anya.status}</span>
        </span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={dict.anya.open}
          className="group relative h-16 w-16 cursor-pointer rounded-full border border-primary/50 bg-black/85 p-1 backdrop-blur-xl transition-all duration-300 hover:scale-105 hover:shadow-[0_0_28px_rgba(0,255,65,0.45)]"
        >
          <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-primary/20" />
          <AnyaAvatar emotion={emotion} mode="idle" className="h-full w-full transition-transform duration-300 group-hover:scale-105" />
        </button>
      </div>
    );
  }

  // ---------- chat panel ----------
  return (
    <div className="fixed bottom-5 right-5 z-[70] flex w-[min(92vw,380px)] max-h-[min(72vh,600px)] flex-col overflow-hidden rounded-2xl border border-primary/30 bg-[#040805]/95 shadow-[0_0_40px_rgba(0,255,65,0.22)] backdrop-blur-xl">
      {/* header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <div className="relative h-12 w-12 shrink-0">
          <AnyaAvatar emotion={emotion} mode={mode} gaze={gaze} className="h-full w-full" />
          <span
            className={cn(
              "absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border border-black",
              busy ? "bg-yellow-400" : "bg-primary",
            )}
          />
        </div>
        <div className="flex-1 leading-tight">
          <div className="font-mono text-sm font-semibold text-foreground">
            {dict.anya.name}
            <span className="ml-2 text-[10px] font-normal text-primary">
              {busy ? dict.anya.thinking : `● ${dict.anya.status}`}
            </span>
          </div>
          {provider && (
            <div className="truncate font-mono text-[10px] text-muted-foreground">
              {dict.anya.provider}: {provider.provider}
              {provider.model ? ` / ${provider.model}` : ""}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={clear}
          aria-label={dict.anya.clear}
          className="cursor-pointer rounded-md border border-border px-2 py-1 font-mono text-[10px] text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
        >
          {dict.anya.clear}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label={dict.anya.close}
          className="cursor-pointer rounded-md border border-border px-2 py-1 font-mono text-[10px] text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
        >
          ✕
        </button>
      </div>

      {/* messages */}
      <div ref={scrollRef} className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
        {msgs.map((m) => {
          const revealing = m.id === revealingId;
          const shown = revealing ? m.content.slice(0, revealLen) : m.content;
          return (
            <div
              key={m.id}
              className={cn(
                "flex items-end gap-2",
                m.role === "user" ? "justify-end" : "justify-start",
              )}
            >
              {m.role === "assistant" && (
                <div className="h-7 w-7 shrink-0 rounded-full border border-primary/30 bg-black/60 p-0.5">
                  <AnyaAvatar emotion={m.emotion || emotion} mode="idle" className="h-full w-full" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[80%] whitespace-pre-wrap break-words rounded-xl px-3 py-2 font-mono text-[13px] leading-relaxed",
                  m.role === "user"
                    ? "rounded-br-sm border border-primary/30 bg-primary/10 text-foreground"
                    : "rounded-bl-sm border border-border bg-card text-foreground",
                )}
              >
                {shown}
                {revealing && <span className="type-caret" />}
              </div>
            </div>
          );
        })}
      </div>

      {/* note for offline mode */}
      {provider?.provider === "local" && (
        <p className="border-t border-border/60 px-4 pb-2 pt-2 text-[11px] leading-snug text-muted-foreground">
          {dict.anya.localNote}
        </p>
      )}

      {/* input */}
      <form
        className="flex items-center gap-2 border-t border-border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={dict.anya.placeholder}
          aria-label={dict.anya.placeholder}
          autoComplete="off"
          spellCheck={false}
          className="flex-1 rounded-lg border border-border bg-black/60 px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary/60 focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="cursor-pointer rounded-lg border border-primary/50 bg-primary px-4 py-2 font-mono text-sm font-semibold text-black transition-all duration-200 hover:shadow-[0_0_16px_rgba(0,255,65,0.5)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {dict.anya.send}
        </button>
      </form>
    </div>
  );
}