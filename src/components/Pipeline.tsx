"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { gsap, ScrollTrigger, isReducedMotion } from "@/lib/animations";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";
import { cn } from "@/lib/utils";

export default function Pipeline() {
  const { dict } = useLanguage();
  const reduced = usePrefersReducedMotion();
  const rootRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const steps = dict.pipeline.steps;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    if (reduced || isReducedMotion()) return;

    const ctx = gsap.context(() => {
      gsap.from("[data-pipeline-head]", {
        y: 32,
        autoAlpha: 0,
        duration: 0.8,
        ease: "power3.out",
        scrollTrigger: { trigger: root, start: "top 78%" },
      });

      ScrollTrigger.create({
        trigger: root,
        start: "top top",
        end: () => `+=${Math.min(root.scrollHeight, window.innerHeight * 1.6)}`,
        pin: true,
        scrub: 1,
        anticipatePin: 1,
        onUpdate: (self) => {
          const next = Math.min(
            steps.length - 1,
            Math.floor(self.progress * steps.length),
          );
          setActive((prev) => (prev === next ? prev : next));
        },
      });
    }, root);

    return () => ctx.revert();
  }, [steps.length, reduced]);

  const current = reduced ? steps[steps.length - 1] : steps[active];
  const stageLabel = reduced ? String(steps.length).padStart(2, "0") : String(active + 1).padStart(2, "0");

  return (
    <section id="pipeline" ref={rootRef} className="relative">
      <div className="mx-auto grid w-full max-w-6xl gap-14 px-6 pb-28 pt-24 sm:px-10 lg:grid-cols-[0.95fr_1.05fr] lg:gap-20">
        {/* left: sticky narrative */}
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div data-pipeline-head>
            <p className="font-mono text-xs font-medium uppercase tracking-[0.45em] text-primary glow-soft">
              {dict.pipeline.kicker}
            </p>
            <h2 className="mt-5 font-sans text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              {dict.pipeline.title}
            </h2>
            <p className="mt-5 max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg">
              {dict.pipeline.subtitle}
            </p>
          </div>

          {/* active step readout */}
          <div className="mt-10 min-h-[150px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={current.id}
                initial={{ opacity: 0, y: 18, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -14, filter: "blur(4px)" }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className="hud-corner border-l-2 border-primary/70 bg-card/60 p-5 backdrop-blur-sm"
              >
                <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-primary">
                  {dict.pipeline.stepsLabel} {stageLabel}
                </p>
                <h3 className="mt-2 font-sans text-2xl font-semibold text-foreground">
                  {current.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {current.desc}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
        </aside>

        {/* right: step rail */}
        <ol className="relative flex flex-col justify-center gap-2">
          <div
            className="absolute left-[27px] top-8 bottom-8 w-px bg-border"
            aria-hidden="true"
          />
          {steps.map((step, i) => {
            const done = i < active;
            const isActive = i === active;
            return (
              <li key={step.id} className="relative flex items-start gap-5 py-2">
                {/* node */}
                <div className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-border bg-black transition-all duration-300">
                  <span
                    className={cn(
                      "h-2.5 w-2.5 rounded-full transition-all duration-300",
                      isActive && "h-4 w-4 bg-primary shadow-[0_0_16px_rgba(0,255,65,0.9)]",
                      done && "bg-primary/50",
                      !isActive && !done && "bg-muted-foreground/40",
                    )}
                  />
                </div>

                {/* connector fill */}
                {i < steps.length - 1 && (
                  <span
                    className={cn(
                      "absolute left-[27px] top-[56px] h-[calc(100%-32px)] w-px bg-primary/60 transition-opacity duration-300",
                      done ? "opacity-100" : "opacity-0",
                    )}
                    aria-hidden="true"
                  />
                )}

                <div className="pt-2.5">
                  <p
                    className={cn(
                      "font-mono text-2xl font-bold transition-colors duration-300",
                      isActive ? "text-primary glow-soft" : done ? "text-primary/50" : "text-muted-foreground/50",
                    )}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </p>
                  <p
                    className={cn(
                      "font-sans text-lg font-semibold transition-colors duration-300",
                      isActive ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {step.title}
                  </p>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground/80">
                    {step.desc}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}