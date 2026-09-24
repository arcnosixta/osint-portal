"use client";

import { useEffect, useRef } from "react";
import { Scale, ShieldAlert } from "lucide-react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { gsap, isReducedMotion } from "@/lib/animations";

export default function Ethics() {
  const { dict } = useLanguage();
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (isReducedMotion()) {
      gsap.set(root.querySelectorAll("[data-ethics-anim]"), { autoAlpha: 1, y: 0 });
      return;
    }
    const ctx = gsap.context(() => {
      gsap.from("[data-ethics-anim]", {
        y: 30,
        autoAlpha: 0,
        stagger: 0.12,
        duration: 0.8,
        ease: "power3.out",
        scrollTrigger: { trigger: root, start: "top 80%" },
      });
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <section
      id="ethics"
      ref={rootRef}
      className="relative border-t border-border py-24 sm:py-28"
    >
      <div className="mx-auto w-full max-w-5xl px-6 sm:px-10">
        <div
          data-ethics-anim
          className="relative overflow-hidden rounded-2xl border border-accent/30 bg-gradient-to-br from-card via-black to-card p-8 sm:p-12"
        >
          <div className="scanlines noise pointer-events-none absolute inset-0" aria-hidden="true" />

          <div className="relative">
            <div className="flex items-center gap-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-lg border border-accent/40 bg-accent/10 text-accent">
                <ShieldAlert className="h-6 w-6" aria-hidden="true" />
              </span>
              <div>
                <p
                  data-ethics-anim
                  className="font-mono text-[11px] uppercase tracking-[0.4em] text-accent"
                >
                  {dict.ethics.kicker}
                </p>
                <h2
                  data-ethics-anim
                  className="mt-1 font-sans text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
                >
                  {dict.ethics.title}
                </h2>
              </div>
            </div>

            <p
              data-ethics-anim
              className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg"
            >
              {dict.ethics.subtitle}
            </p>

            <ul data-ethics-anim className="mt-8 flex flex-col gap-4">
              {dict.ethics.points.map((point) => (
                <li key={point} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-accent/50 text-accent">
                    <Scale className="h-3 w-3" aria-hidden="true" />
                  </span>
                  <span className="text-sm leading-relaxed text-foreground/85">{point}</span>
                </li>
              ))}
            </ul>

            <p
              data-ethics-anim
              className="mt-8 border-t border-border pt-6 font-mono text-xs text-muted-foreground"
            >
              {dict.ethics.license}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}