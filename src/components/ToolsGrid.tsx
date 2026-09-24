"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Database,
  Globe2,
  Layers,
  Network,
  Search,
  TerminalSquare,
  UserSearch,
  type LucideIcon,
} from "lucide-react";

declare global {
  interface HTMLElement {
    _cleanupTilt?: () => void;
  }
}
import { useLanguage } from "@/components/providers/LanguageProvider";
import { gsap, isReducedMotion } from "@/lib/animations";
import {
  TOOL_CATEGORIES,
  TOOLS,
  type Tool,
  type ToolCategory,
} from "@/lib/tools";
import { cn } from "@/lib/utils";

const CATEGORY_ICON: Record<ToolCategory, LucideIcon> = {
  network: Network,
  username: UserSearch,
  dns: Globe2,
  web: Search,
  data: Database,
  framework: Layers,
};

const STATUS_STYLES: Record<Tool["status"], string> = {
  online: "text-primary border-primary/50 bg-primary/10",
  module: "text-sky-400 border-sky-400/40 bg-sky-400/10",
  planned: "text-muted-foreground border-border bg-muted/40",
};

export default function ToolsGrid() {
  const { lang, dict } = useLanguage();
  const rootRef = useRef<HTMLElement>(null);

  // group tools by category preserving catalog order
  const groups = (Object.keys(TOOL_CATEGORIES) as ToolCategory[])
    .map((category) => ({
      category,
      tools: TOOLS.filter((t) => t.category === category),
    }))
    .filter((g) => g.tools.length > 0);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    if (isReducedMotion()) {
      gsap.set(root.querySelectorAll("[data-tool-card], [data-tools-head]"), {
        autoAlpha: 1,
        y: 0,
      });
      return;
    }

    const ctx = gsap.context(() => {
      gsap.from("[data-tools-head]", {
        y: 32,
        autoAlpha: 0,
        duration: 0.8,
        ease: "power3.out",
        scrollTrigger: { trigger: root, start: "top 80%" },
      });

      // batch-reveal cards per row as they enter
      gsap.utils.toArray<HTMLElement>("[data-group]").forEach((group, gi) => {
        gsap.from(group.querySelectorAll("[data-tool-card]"), {
          y: 36,
          autoAlpha: 0,
          stagger: 0.08,
          duration: 0.7,
          delay: gi * 0.05,
          ease: "power3.out",
          scrollTrigger: { trigger: group, start: "top 85%" },
        });
      });

      // subtle tilt on hover
      gsap.utils.toArray<HTMLElement>("[data-tool-card]").forEach((card) => {
        const rx = gsap.quickTo(card, "rotationX", { duration: 0.45, ease: "power3.out" });
        const ry = gsap.quickTo(card, "rotationY", { duration: 0.45, ease: "power3.out" });
        const move = (e: PointerEvent) => {
          const rect = card.getBoundingClientRect();
          const px = (e.clientX - rect.left) / rect.width - 0.5;
          const py = (e.clientY - rect.top) / rect.height - 0.5;
          ry(px * 7);
          rx(-py * 7);
        };
        const reset = () => {
          rx(0);
          ry(0);
        };
        card.addEventListener("pointermove", move);
        card.addEventListener("pointerleave", reset);
        card.addEventListener("mouseenter", () => gsap.to(card, { scale: 1.012, duration: 0.3, ease: "power2.out" }));
        card.addEventListener("mouseleave", () => gsap.to(card, { scale: 1, duration: 0.3, ease: "power2.out" }));
        card._cleanupTilt = () => {
          card.removeEventListener("pointermove", move);
          card.removeEventListener("pointerleave", reset);
        };
      });
    }, root);

    return () => {
      root.querySelectorAll<HTMLElement>("[data-tool-card]").forEach((card) => {
        card._cleanupTilt?.();
      });
      ctx.revert();
    };
  }, []);

  // quick nav chips — all categories are always listed in the same order,
  // so chips stay stable across language switches
  const chips = groups.map((g) => ({
    id: g.category,
    label: TOOL_CATEGORIES[g.category][lang],
  }));

  return (
    <section id="tools" ref={rootRef} className="relative py-24 sm:py-32">
      <div className="mx-auto w-full max-w-6xl px-6 sm:px-10">
        {/* heading */}
        <div data-tools-head className="max-w-2xl">
          <p className="font-mono text-xs font-medium uppercase tracking-[0.45em] text-primary glow-soft">
            {dict.tools.kicker}
          </p>
          <h2 className="mt-5 font-sans text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            {dict.tools.title}
          </h2>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
            {dict.tools.subtitle}
          </p>
        </div>

        {/* category chips */}
        <div className="mt-10 flex flex-wrap gap-2">
          {chips.map((chip) => {
            const Icon = CATEGORY_ICON[chip.id];
            return (
              <a
                key={chip.id}
                href={`#group-${chip.id}`}
                className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 font-mono text-xs uppercase tracking-wider text-muted-foreground transition-all duration-200 hover:border-primary/60 hover:text-primary"
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {chip.label}
              </a>
            );
          })}
        </div>

        {/* grouped catalog */}
        <div className="mt-16 flex flex-col gap-16">
          {groups.map((group) => {
            const Icon = CATEGORY_ICON[group.category];
            return (
              <div key={group.category} data-group id={`group-${group.category}`} className="scroll-mt-24">
                <div className="mb-6 flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/30 bg-primary/5 text-primary">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <h3 className="font-mono text-sm font-semibold uppercase tracking-[0.25em] text-foreground">
                    {TOOL_CATEGORIES[group.category][lang]}
                  </h3>
                  <span className="font-mono text-xs text-muted-foreground">
                    / {group.tools.length.toString().padStart(2, "0")}
                  </span>
                  <span className="ml-2 h-px flex-1 bg-border" />
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {group.tools.map((tool) => (
                    <ToolCard key={tool.id} tool={tool} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ToolCard({ tool }: { tool: Tool }) {
  const { lang, dict } = useLanguage();
  const categoryLabel = TOOL_CATEGORIES[tool.category][lang];
  const Icon = CATEGORY_ICON[tool.category];

  return (
    <Link
      href={`/tools/${tool.id}`}
      data-tool-card
      aria-label={`${tool.name} — open workbench`}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card p-5 transition-[border-color,box-shadow] duration-200 will-change-transform",
        "hover:border-primary/60 hover:shadow-[0_0_30px_rgba(0,255,65,0.12)]",
        tool.status !== "module" && "card-glow",
      )}
      style={{ transformStyle: "preserve-3d" }}
    >
      {/* top-right category hint */}
      <span className="pointer-events-none absolute right-4 top-4 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">
        {categoryLabel}
      </span>

      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/25 bg-primary/5 text-primary transition-all duration-200 group-hover:shadow-[0_0_16px_rgba(0,255,65,0.3)]">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <h4 className="font-mono text-lg font-semibold text-foreground">{tool.name}</h4>
      </div>

      <p className="mt-4 flex-1 text-sm leading-relaxed text-muted-foreground">
        {tool.desc[lang]}
      </p>

      {/* command line */}
      <div className="mt-5 flex items-center gap-2 rounded-md border border-border bg-black/60 px-3 py-2 font-mono text-xs text-primary/90">
        <TerminalSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="truncate">$ {tool.command}</span>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex flex-wrap gap-1.5">
          {tool.tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>

        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider",
            STATUS_STYLES[tool.status],
          )}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              tool.status === "online" && "bg-primary pulse-soft",
              tool.status === "module" && "bg-sky-400 pulse-soft",
              tool.status === "planned" && "bg-muted-foreground",
            )}
          />
          {tool.status === "online"
            ? dict.tools.statusOnline
            : tool.status === "module"
              ? dict.tools.statusModule
              : dict.tools.statusPlanned}
        </span>
      </div>

      {/* corner arrow */}
      <ArrowUpRight
        className="absolute bottom-4 right-4 h-4 w-4 text-primary opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        aria-hidden="true"
      />
    </Link>
  );
}