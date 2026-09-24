"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { AnyaFace } from "@/components/anya/AnyaFace";
import { useAnyaChat } from "@/components/anya/useAnyaChat";
import { cn } from "@/lib/utils";

export function AnyaPortal() {
  const { dict } = useLanguage();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const chat = useAnyaChat();
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 60);
  }, [open]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.msgs, chat.revealLen, open]);

  if (pathname === "/anya") return null;

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
          <span className="block h-full w-full overflow-hidden rounded-full">
            <AnyaFace emotion={chat.emotion} mode="idle" className="h-full w-full transition-transform duration-300 group-hover:scale-105" />
          </span>
        </button>
      </div>
    );
  }

  // ---------- chat panel ----------
  return (
    <div className="fixed bottom-5 right-5 z-[70] flex w-[min(92vw,380px)] max-h-[min(72vh,600px)] flex-col overflow-hidden rounded-2xl border border-primary/30 bg-[#040805]/95 shadow-[0_0_40px_rgba(0,255,65,0.22)] backdrop-blur-xl">
      {/* header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-primary/30">
          <AnyaFace emotion={chat.emotion} mode={chat.mode} className="h-full w-full" />
          <span
            className={cn(
              "absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border border-black",
              chat.busy ? "bg-yellow-400" : "bg-primary",
            )}
          />
        </div>
        <div className="flex-1 leading-tight">
          <div className="font-mono text-sm font-semibold text-foreground">
            {dict.anya.name}
            <span className="ml-2 text-[10px] font-normal text-primary">
              {chat.busy ? dict.anya.thinking : `● ${dict.anya.status}`}
            </span>
          </div>
          <Link
            href="/anya"
            className="font-mono text-[10px] text-muted-foreground underline-offset-2 transition-colors hover:text-primary hover:underline"
          >
            {dict.anya.expand}
          </Link>
        </div>
        <button
          type="button"
          onClick={chat.clear}
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
        {chat.msgs.map((m) => {
          const revealing = m.id === chat.revealingId;
          const shown = revealing ? m.content.slice(0, chat.revealLen) : m.content;
          return (
            <div
              key={m.id}
              className={cn(
                "flex items-end gap-2",
                m.role === "user" ? "justify-end" : "justify-start",
              )}
            >
              {m.role === "assistant" && (
                <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full border border-primary/30 bg-black/60">
                  <AnyaFace emotion={m.emotion || chat.emotion} mode="idle" className="h-full w-full" />
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
        {chat.busy && (
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full border border-primary/30 bg-black/60">
              <AnyaFace emotion="neutral" mode="thinking" className="h-full w-full" />
            </div>
            <svg viewBox="0 0 140 140" className="anya-dots h-7 w-10" aria-label={dict.anya.thinking} role="img">
              <circle cx="50" cy="40" r="3.4" fill="currentColor" />
              <circle cx="70" cy="40" r="3.4" fill="currentColor" />
              <circle cx="90" cy="40" r="3.4" fill="currentColor" />
            </svg>
          </div>
        )}
      </div>

      {/* input */}
      <form
        className="flex items-center gap-2 border-t border-border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void chat.send();
        }}
      >
        <input
          ref={inputRef}
          value={chat.input}
          onChange={(e) => chat.setInput(e.target.value)}
          placeholder={dict.anya.placeholder}
          aria-label={dict.anya.placeholder}
          autoComplete="off"
          spellCheck={false}
          className="flex-1 rounded-lg border border-border bg-black/60 px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary/60 focus:outline-none"
        />
        <button
          type="submit"
          disabled={chat.busy || !chat.input.trim()}
          className="cursor-pointer rounded-lg border border-primary/50 bg-primary px-4 py-2 font-mono text-sm font-semibold text-black transition-all duration-200 hover:shadow-[0_0_16px_rgba(0,255,65,0.5)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {dict.anya.send}
        </button>
      </form>
    </div>
  );
}