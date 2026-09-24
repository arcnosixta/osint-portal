"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { cn } from "@/lib/utils";

export default function Navbar() {
  const { dict, lang, setLang } = useLanguage();
  const [scrolled, setScrolled] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 24);
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(1, y / max) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled
          ? "border-b border-border bg-black/70 backdrop-blur-xl"
          : "border-b border-transparent bg-transparent",
      )}
    >
      {/* scroll progress */}
      <div
        className="absolute left-0 top-0 h-px bg-primary shadow-[0_0_10px_rgba(0,255,65,0.8)] transition-[width] duration-150"
        style={{ width: `${progress * 100}%` }}
        aria-hidden="true"
      />

      <nav className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6 sm:px-10">
        <a href="#top" className="group flex cursor-pointer items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-md border border-primary/60 bg-primary/10 font-mono text-sm font-bold text-primary transition-all duration-200 group-hover:shadow-[0_0_18px_rgba(0,255,65,0.5)]">
            &gt;_
          </span>
          <span className="font-mono text-sm font-semibold tracking-tight text-foreground">
            osint<span className="text-primary">-portal</span>
          </span>
          <span className="mt-0.5 hidden rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-block">
            {dict.nav.version}
          </span>
        </a>

        <div className="hidden items-center gap-1 md:flex">
          {(
            [
              ["#tools", dict.nav.tools],
              ["#pipeline", dict.nav.pipeline],
              ["#ethics", dict.nav.ethics],
            ] as const
          ).map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="cursor-pointer rounded px-3 py-2 font-mono text-[13px] text-muted-foreground transition-colors duration-200 hover:bg-primary/10 hover:text-primary"
            >
              {label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* language toggle */}
          <div
            role="group"
            aria-label="Language"
            className="flex items-center rounded-lg border border-border bg-black/50 p-0.5 font-mono text-xs"
          >
            {(["en", "ru"] as const).map((locale) => (
              <button
                key={locale}
                onClick={() => setLang(locale)}
                aria-pressed={lang === locale}
                className={cn(
                  "cursor-pointer rounded-md px-2.5 py-1.5 transition-all duration-200",
                  lang === locale
                    ? "bg-primary font-semibold text-black shadow-[0_0_12px_rgba(0,255,65,0.4)]"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {locale.toUpperCase()}
              </button>
            ))}
          </div>

          <a
            href="https://github.com/arcnosixta/osint-portal"
            target="_blank"
            rel="noreferrer noopener"
            className="ml-1 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3.5 py-2 font-mono text-[13px] text-foreground transition-all duration-200 hover:border-primary/70 hover:bg-primary/10 hover:text-primary"
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
            </svg>
            <span className="hidden sm:inline">{dict.nav.github}</span>
          </a>
        </div>
      </nav>
    </header>
  );
}