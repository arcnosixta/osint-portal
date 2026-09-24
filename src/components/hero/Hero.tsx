"use client";

import { useEffect, useRef } from "react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { gsap, isReducedMotion } from "@/lib/animations";
import WebGLBackground from "./WebGLBackground";
import Terminal from "./Terminal";

export default function Hero() {
  const { dict } = useLanguage();
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    if (isReducedMotion()) {
      gsap.set(root.querySelectorAll("[data-hero-anim]"), { autoAlpha: 1, y: 0 });
      return;
    }

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power4.out" } });
      tl.from("[data-hero-kicker]", { y: 24, autoAlpha: 0, duration: 0.6 })
        .from("[data-hero-line]", { scaleY: 0, transformOrigin: "left center", duration: 0.5, ease: "power2.out" }, "-=0.35")
        .from("[data-hero-subtitle]", { y: 28, autoAlpha: 0, duration: 0.8 }, "-=0.4")
        .from("[data-hero-cta]", { y: 22, autoAlpha: 0, stagger: 0.08, duration: 0.5 }, "-=0.5")
        .from("[data-hero-terminal]", { y: 48, autoAlpha: 0, duration: 0.9, ease: "power3.out" }, "-=0.4")
        .from("[data-hero-meta]", { y: 12, autoAlpha: 0, stagger: 0.06, duration: 0.4 }, "-=0.2");

      // character-level title reveal
      const title = root.querySelector("[data-hero-title]");
      if (title) {
        const splitChars = (el: Element) => {
          const text = el.textContent ?? "";
          el.textContent = "";
          const frag = document.createDocumentFragment();
          [...text].forEach((ch) => {
            const span = document.createElement("span");
            span.textContent = ch;
            span.style.display = "inline-block";
            frag.appendChild(span);
          });
          el.appendChild(frag);
          return el.querySelectorAll("span");
        };

        const spans = splitChars(title);
        tl.fromTo(
          spans,
          { yPercent: 110, opacity: 0, rotateX: -60 },
          {
            yPercent: 0,
            opacity: 1,
            rotateX: 0,
            stagger: 0.035,
            duration: 0.9,
            ease: "power4.out",
          },
          0.1,
        );
      }
    }, root);

    return () => ctx.revert();
  }, []);

  return (
    <section
      id="hero"
      ref={rootRef}
      className="relative flex min-h-[100svh] flex-col overflow-hidden pt-28 pb-16"
    >
      <WebGLBackground className="absolute inset-0 z-0" />
      <div className="grid-floor z-0" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_20%,rgba(0,255,65,0.06),transparent_70%)]" />

      {/* vignette */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-40 bg-gradient-to-t from-background to-transparent" />

      {/* HUD meta top row */}
      <div className="relative z-20 mx-auto flex w-full max-w-6xl items-center justify-between px-6 sm:px-10">
        <p
          data-hero-meta
          className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground"
        >
          {dict.hero.coordinates}
        </p>
        <p data-hero-meta className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-primary pulse-soft" />
          {dict.hero.status}
        </p>
      </div>

      <div className="relative z-20 mx-auto grid w-full max-w-6xl flex-1 items-center gap-14 px-6 sm:px-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
        {/* Copy */}
        <div>
          <p
            data-hero-kicker
            className="font-mono text-xs font-medium uppercase tracking-[0.45em] text-primary glow-soft"
          >
            {dict.hero.kicker}
          </p>

          <h1 className="mt-6 font-sans text-[clamp(3.2rem,11vw,7.5rem)] font-bold leading-[0.92] tracking-tight">
            {/* Title block split & revealed per character; glitch lives on the wrapper */}
            <span data-hero-title className="glitch block overflow-hidden text-primary">
              OSINT
            </span>
            <span className="block text-foreground glow-strong">{dict.hero.title[1]}</span>
          </h1>

          <div data-hero-line className="mt-8 h-px w-24 bg-primary shadow-[0_0_12px_rgba(0,255,65,0.8)]" />

          <p
            data-hero-subtitle
            className="mt-8 max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg"
          >
            {dict.hero.subtitle}
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <a
              href="#tools"
              data-hero-cta
              className="group inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-6 py-3.5 font-mono text-sm font-semibold text-black transition-all duration-200 hover:bg-primary-dim hover:shadow-[0_0_28px_rgba(0,255,65,0.4)]"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M6 6h15M6 12h9M6 18h7" strokeLinecap="round" />
              </svg>
              {dict.hero.ctaPrimary}
            </a>
            <a
              href="#pipeline"
              data-hero-cta
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-primary/60 px-6 py-3.5 font-mono text-sm font-semibold text-primary transition-all duration-200 hover:bg-primary/10 hover:shadow-[0_0_24px_rgba(0,255,65,0.25)]"
            >
              {dict.hero.ctaSecondary}
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M19 12H5m7 0-4-4m4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          </div>
        </div>

        {/* Terminal */}
        <div data-hero-terminal className="relative">
          <div className="hud-corner absolute -inset-3 z-0" aria-hidden="true" />
          <Terminal prompt={dict.hero.terminalPrompt} lines={dict.hero.terminalLines} />
        </div>
      </div>

      {/* scroll hint */}
      <div className="relative z-20 mt-10 flex justify-center">
        <a
          href="#metrics"
          data-hero-anim
          className="flex cursor-pointer flex-col items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground transition-colors hover:text-primary"
          aria-label="Scroll"
        >
          <span>▼</span>
          <span className="h-10 w-px bg-gradient-to-b from-primary to-transparent" />
        </a>
      </div>
    </section>
  );
}