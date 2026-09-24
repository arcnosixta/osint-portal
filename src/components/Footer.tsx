"use client";

import { useEffect, useRef } from "react";
import { Star } from "lucide-react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { gsap, isReducedMotion } from "@/lib/animations";

const REPO_URL = "https://github.com/arcnosixta/osint-portal";

export default function Footer() {
  const { dict } = useLanguage();
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (isReducedMotion()) {
      gsap.set(root.querySelectorAll("[data-footer-anim]"), { autoAlpha: 1, y: 0 });
      return;
    }
    const ctx = gsap.context(() => {
      gsap.from("[data-footer-anim]", {
        y: 28,
        autoAlpha: 0,
        stagger: 0.1,
        duration: 0.7,
        ease: "power3.out",
        scrollTrigger: { trigger: root, start: "top 88%" },
      });
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <footer ref={rootRef} className="relative overflow-hidden border-t border-border">
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[220px] opacity-40"
        style={{
          background: "radial-gradient(ellipse 70% 100% at 50% 110%, rgba(0,255,65,0.18), transparent)",
        }}
        aria-hidden="true"
      />

      <div className="relative mx-auto w-full max-w-6xl px-6 py-16 sm:px-10 sm:py-20">
        <div className="flex flex-col items-start justify-between gap-10 lg:flex-row lg:items-end">
          <div data-footer-anim className="max-w-xl">
            <p className="font-mono text-sm text-primary glow-soft">&gt;_ {dict.footer.tagline}</p>
            <h2 className="mt-4 font-sans text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              OSINT<span className="text-primary">_portal</span>
            </h2>
            <p className="mt-5 font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
              {dict.footer.made}
            </p>
          </div>

          <a
            data-footer-anim
            href={REPO_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="group inline-flex cursor-pointer items-center gap-3 rounded-lg border border-primary/50 bg-primary/5 px-6 py-4 font-mono text-sm font-semibold text-primary transition-all duration-200 hover:bg-primary hover:text-black hover:shadow-[0_0_36px_rgba(0,255,65,0.45)]"
          >
            <Star className="h-4 w-4 transition-transform duration-200 group-hover:scale-125" aria-hidden="true" />
            github.com/arcnosixta/osint-portal
          </a>
        </div>

        <div
          data-footer-anim
          className="mt-14 flex flex-col items-start justify-between gap-4 border-t border-border pt-8 sm:flex-row sm:items-center"
        >
          <p className="font-mono text-xs text-muted-foreground">
            © {new Date().getFullYear()} osint-portal · {dict.footer.rights}
          </p>
          <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
            {dict.footer.built}
            <span className="flex items-center gap-1.5">
              <span className="rounded border border-border px-1.5 py-0.5">Next.js 16</span>
              <span className="rounded border border-border px-1.5 py-0.5">Tailwind v4</span>
              <span className="rounded border border-border px-1.5 py-0.5">GSAP</span>
              <span className="rounded border border-border px-1.5 py-0.5">Three.js</span>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}