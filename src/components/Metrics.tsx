"use client";

import { useEffect, useRef } from "react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { gsap, isReducedMotion } from "@/lib/animations";
import { TOOLS } from "@/lib/tools";
import { CountUp } from "@/components/ui/CountUp";

export default function Metrics() {
  const { dict } = useLanguage();
  const rootRef = useRef<HTMLElement>(null);

  const totalTools = TOOLS.length;
  const localTools = TOOLS.filter((t) => t.local).length;
  const categories = new Set(TOOLS.map((t) => t.category)).size;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (isReducedMotion()) {
      gsap.set(root.querySelectorAll("[data-metric-item]"), { autoAlpha: 1, y: 0 });
      return;
    }
    const ctx = gsap.context(() => {
      gsap.from("[data-metric-item]", {
        y: 28,
        autoAlpha: 0,
        stagger: 0.1,
        duration: 0.7,
        ease: "power3.out",
        scrollTrigger: { trigger: root, start: "top 82%" },
      });
    }, root);
    return () => ctx.revert();
  }, []);

  const items = [
    { value: totalTools, suffix: "+", label: dict.metrics.tools },
    { value: localTools, suffix: "", label: dict.metrics.local },
    { value: categories, suffix: "", label: dict.metrics.categories },
    { value: 1, suffix: "", label: dict.metrics.footprint },
  ];

  return (
    <section
      id="metrics"
      ref={rootRef}
      className="relative border-y border-border bg-surface/60 py-16 sm:py-20"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 sm:px-10">
        <p
          data-metric-item
          className="font-mono text-[11px] uppercase tracking-[0.35em] text-muted-foreground"
        >
          {dict.metrics.label}
        </p>

        <div className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-4">
          {items.map((item) => (
            <div key={item.label} data-metric-item className="flex flex-col gap-2">
              <span className="font-mono text-5xl font-bold text-primary glow-soft sm:text-6xl">
                <CountUp end={item.value} />
                <span>{item.suffix}</span>
              </span>
              <span className="max-w-[16ch] font-mono text-xs uppercase leading-relaxed tracking-[0.15em] text-muted-foreground">
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}