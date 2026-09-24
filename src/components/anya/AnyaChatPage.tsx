"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { AnyaBackdrop } from "@/components/anya/AnyaBackdrop";
import { AnyaFace } from "@/components/anya/AnyaFace";
import { useAnyaChat } from "@/components/anya/useAnyaChat";
import { cn } from "@/lib/utils";

export function AnyaChatPage() {
  const { dict } = useLanguage();
  const chat = useAnyaChat();
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.msgs, chat.revealLen]);

  const statusLabel = chat.busy ? dict.anya.thinking : dict.anya.status;

  return (
    <section className="relative flex h-screen flex-col overflow-hidden bg-[#12030d] text-[#ffe3ef]">
      <AnyaBackdrop emotion={chat.emotion} mode={chat.mode} />
      <div className="anya-grid pointer-events-none absolute inset-0" aria-hidden="true" />

      {/* top bar */}
      <header className="relative z-10 flex shrink-0 items-center justify-between gap-4 border-b border-[#ff6fb5]/20 px-6 py-4 backdrop-blur-sm">
        <Link
          href="/"
          className="font-mono text-xs text-[#ff9bcf] underline-offset-4 transition-colors hover:text-[#ffd0ea] hover:underline"
        >
          ← {dict.anya.backToHome}
        </Link>
        <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-center">
          <h1
            className="font-mono text-xl font-bold tracking-[0.4em] text-[#ffd0ea]"
            style={{ textShadow: "0 0 18px rgba(255,45,149,.55)" }}
          >
            {dict.anya.name}
          </h1>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#ff9bcf]/80">
            {dict.anya.pageTitle}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-2 rounded-full border border-[#ff6fb5]/35 bg-[#2a0617]/70 px-3 py-1.5 font-mono text-[11px] text-[#ffb3db] sm:flex">
            <span className={cn("h-2 w-2 rounded-full", chat.busy ? "bg-yellow-400" : "bg-[#ff4d9d]")} />
            {statusLabel}
          </span>
          <button
            type="button"
            onClick={chat.clear}
            aria-label={dict.anya.clear}
            className="cursor-pointer rounded-md border border-[#ff6fb5]/40 bg-[#3a0a22]/60 px-3 py-1.5 font-mono text-[11px] text-[#ffb3db] transition-colors hover:border-[#ff9bcf] hover:text-[#ffe3ef]"
          >
            {dict.anya.clear}
          </button>
        </div>
      </header>

      {/* desktop split */}
      <div className="relative z-10 flex min-h-0 flex-1">
        {/* portrait */}
        <aside className="hidden w-[46%] shrink-0 flex-col items-center justify-center gap-8 border-r border-[#ff6fb5]/15 px-10 lg:flex">
          <div className="relative h-[56vh] w-full max-w-[560px] overflow-hidden rounded-3xl border border-[#ff6fb5]/45 shadow-[0_0_90px_rgba(255,45,149,0.5)]">
            <span
              className={cn(
                "absolute inset-0",
                chat.mode === "speaking"
                  ? "anya-speaking-face"
                  : chat.mode === "listening"
                    ? "anya-listen-photo"
                    : "anya-float-photo",
              )}
            >
              <AnyaFace emotion={chat.emotion} mode={chat.mode} className="h-full w-full" />
            </span>
            <div className="hud-corner absolute -inset-3 z-0" aria-hidden="true" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-5">
              <p
                className="font-mono text-sm uppercase tracking-[0.3em] text-[#ffd0ea]"
                style={{ textShadow: "0 0 2px rgba(255,111,181,.9), 0 0 12px rgba(255,45,149,.6)" }}
              >
                {statusLabel} {chat.busy && <span className="anya-mode-caret">▮</span>}
              </p>
            </div>
          </div>
        </aside>

        {/* chat column */}
        <main className="flex min-h-0 flex-1 flex-col">
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-6 py-6 lg:px-10">
            <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
              {chat.msgs.map((m) => {
                const revealing = m.id === chat.revealingId;
                const shown = revealing ? m.content.slice(0, chat.revealLen) : m.content;
                return (
                  <div
                    key={m.id}
                    className={cn("flex items-end gap-3", m.role === "user" ? "justify-end" : "justify-start")}
                  >
                    {m.role === "assistant" && (
                      <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-[#ff6fb5]/40 bg-[#2a0617]">
                        <AnyaFace emotion={m.emotion || chat.emotion} mode="idle" className="h-full w-full" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "max-w-[80%] whitespace-pre-wrap break-words rounded-2xl border px-4 py-2.5 font-mono text-sm leading-relaxed",
                        m.role === "user"
                          ? "border-[#ff6fb5]/40 bg-[#ff4d9d]/15 text-[#ffe3ef]"
                          : "border-[#ff6fb5]/30 bg-[#2a0617]/80 text-[#ffd9ea] shadow-[0_0_20px_rgba(255,45,149,0.18)]",
                      )}
                    >
                      {shown}
                      {revealing && <span className="type-caret-pink" />}
                    </div>
                  </div>
                );
              })}
              {chat.busy && (
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-[#ff6fb5]/40 bg-[#2a0617]">
                    <AnyaFace emotion="neutral" mode="thinking" className="h-full w-full" />
                  </div>
                  <svg
                    viewBox="0 0 140 140"
                    className="anya-dots h-7 w-12 text-[#ff9bcf]"
                    role="img"
                    aria-label={dict.anya.thinking}
                  >
                    <circle cx="50" cy="40" r="3.4" fill="currentColor" />
                    <circle cx="70" cy="40" r="3.4" fill="currentColor" />
                    <circle cx="90" cy="40" r="3.4" fill="currentColor" />
                  </svg>
                </div>
              )}
            </div>
          </div>

          {/* input */}
          <div className="shrink-0 border-t border-[#ff6fb5]/25 p-5 backdrop-blur-md">
            <form
              className="mx-auto flex w-full max-w-2xl items-center gap-2 rounded-2xl border border-[#ff6fb5]/40 bg-[#2a0617]/80 p-3 shadow-[0_0_34px_rgba(255,45,149,0.28)]"
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
                className="flex-1 rounded-xl border border-[#ff6fb5]/30 bg-[#17030f]/80 px-4 py-2.5 font-mono text-sm text-[#ffe3ef] placeholder:text-[#ff9bcf]/50 focus:border-[#ff9bcf]/70 focus:outline-none"
              />
              <button
                type="submit"
                disabled={chat.busy || !chat.input.trim()}
                className="cursor-pointer rounded-xl border border-[#ff6fb5]/60 bg-[#ff4d9d] px-5 py-2.5 font-mono text-sm font-semibold text-[#1d0410] shadow-[0_0_18px_rgba(255,77,157,0.6)] transition-all duration-200 hover:shadow-[0_0_30px_rgba(255,77,157,0.85)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {dict.anya.send}
              </button>
            </form>
          </div>
        </main>
      </div>
    </section>
  );
}