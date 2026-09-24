"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { AnyaBackdrop } from "@/components/anya/AnyaBackdrop";
import { AnyaFace } from "@/components/anya/AnyaFace";
import { useAnyaChat } from "@/components/anya/useAnyaChat";
import { cn } from "@/lib/utils";

const PINk_GLOZ = "0 0 2px rgba(255,111,181,.9), 0 0 12px rgba(255,45,149,.6), 0 0 32px rgba(255,45,149,.35)";

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
    <section className="relative min-h-screen overflow-hidden bg-[#12030d] text-[#ffe3ef]">
      <AnyaBackdrop emotion={chat.emotion} mode={chat.mode} />

      {/* pink grid overlay */}
      <div className="anya-grid pointer-events-none absolute inset-0" aria-hidden="true" />

      {/* top bar */}
      <header className="relative z-10 flex items-center justify-between border-b border-[#ff6fb5]/25 px-5 py-4 backdrop-blur-sm">
        <Link
          href="/"
          className="font-mono text-xs text-[#ff9bcf] underline-offset-4 transition-colors hover:text-[#ffd0ea] hover:underline"
        >
          ← {dict.anya.backToHome}
        </Link>
        <div className="absolute left-1/2 -translate-x-1/2 text-center">
          <h1 className="font-mono text-lg font-bold tracking-[0.35em] text-[#ffd0ea]" style={{ textShadow: "0 0 18px rgba(255,45,149,.55)" }}>
            {dict.anya.name}
          </h1>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#ff9bcf]/80">
            {dict.anya.pageTitle}
          </p>
        </div>
        <button
          type="button"
          onClick={chat.clear}
          aria-label={dict.anya.clear}
          className="cursor-pointer rounded-md border border-[#ff6fb5]/40 bg-[#3a0a22]/60 px-3 py-1.5 font-mono text-[11px] text-[#ffb3db] transition-colors hover:border-[#ff9bcf] hover:text-[#ffe3ef]"
        >
          {dict.anya.clear}
        </button>
      </header>

      {/* hero avatar */}
      <div className="relative z-10 mx-auto mt-6 w-fit">
        <div className="relative h-44 w-44 overflow-hidden rounded-2xl border border-[#ff6fb5]/45 shadow-[0_0_60px_rgba(255,45,149,0.5)] sm:h-56 sm:w-56">
          <span
            className={cn(
              "absolute inset-0",
              chat.mode === "speaking" ? "anya-speaking-face" : chat.mode === "listening" ? "anya-listen-photo" : "anya-float-photo",
            )}
          >
            <AnyaFace emotion={chat.emotion} mode={chat.mode} priority className="h-full w-full rounded-2xl" />
          </span>
        </div>
        <div className="mt-3 text-center">
          <span className="font-mono text-xs uppercase tracking-[0.3em] text-[#ff9bcf]" style={{ textShadow: PINk_GLOZ }}>
            {statusLabel} {chat.busy && <span className="anya-mode-caret">▮</span>}
          </span>
        </div>
      </div>

      {/* transcript */}
      <main ref={scrollRef} className="relative z-10 mx-auto mt-8 max-h-[38vh] overflow-y-auto px-4 pb-2 sm:px-6">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
          {chat.msgs.map((m) => {
            const revealing = m.id === chat.revealingId;
            const shown = revealing ? m.content.slice(0, chat.revealLen) : m.content;
            return (
              <div key={m.id} className={cn("flex items-end gap-3", m.role === "user" ? "justify-end" : "justify-start")}>
                {m.role === "assistant" && (
                  <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-[#ff6fb5]/40 bg-[#2a0617]">
                    <AnyaFace emotion={m.emotion || chat.emotion} mode="idle" className="h-full w-full" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[80%] whitespace-pre-wrap break-words rounded-2xl border px-4 py-2.5 font-mono text-sm leading-relaxed",
                    m.role === "user"
                      ? "rounded-br-sm border-[#ff6fb5]/40 bg-[#ff4d9d]/15 text-[#ffe3ef]"
                      : "rounded-bl-sm border-[#ff6fb5]/30 bg-[#2a0617]/80 text-[#ffd9ea] shadow-[0_0_20px_rgba(255,45,149,0.18)]",
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
              <svg viewBox="0 0 140 140" className="anya-dots h-7 w-12 text-[#ff9bcf]" role="img" aria-label={dict.anya.thinking}>
                <circle cx="50" cy="40" r="3.4" fill="currentColor" />
                <circle cx="70" cy="40" r="3.4" fill="currentColor" />
                <circle cx="90" cy="40" r="3.4" fill="currentColor" />
              </svg>
            </div>
          )}
        </div>
      </main>

      {/* input */}
      <div className="relative z-10 mx-auto mt-4 w-full max-w-2xl px-4 pb-8 sm:px-0">
        <form
          className="flex items-center gap-2 rounded-2xl border border-[#ff6fb5]/40 bg-[#2a0617]/80 p-3 shadow-[0_0_34px_rgba(255,45,149,0.28)] backdrop-blur-md"
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
    </section>
  );
}