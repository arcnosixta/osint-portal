"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";

interface TerminalLine {
  cmd: string;
  out: string;
}

interface TerminalProps {
  prompt: string;
  lines: TerminalLine[];
  title: string;
  done: string;
}

const TYPE_SPEED = 34;
const PAUSE_AFTER_CMD = 320;
const PAUSE_AFTER_OUT = 1100;

export default function Terminal({ prompt, lines, title, done }: TerminalProps) {
  const prefersReduced = usePrefersReducedMotion();
  const [rendered, setRendered] = useState<TerminalLine[]>([]);
  const [currentCmd, setCurrentCmd] = useState("");
  const [finished, setFinished] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefersReduced) return;

    let cancelled = false;
    const timeouts: number[] = [];
    const charIndex = { current: 0 };
    let lineIndex = 0;

    const schedule = (fn: () => void, ms: number) => {
      if (cancelled) return;
      timeouts.push(window.setTimeout(fn, ms));
    };

    const typeCmd = (line: TerminalLine, startDelay = 200) => {
      const chars = [...line.cmd];
      charIndex.current = 0;
      setCurrentCmd("");
      const step = () => {
        if (cancelled) return;
        charIndex.current += 1;
        setCurrentCmd(chars.slice(0, charIndex.current).join(""));
        if (charIndex.current < chars.length) {
          schedule(step, TYPE_SPEED);
        } else {
          schedule(() => {
            setRendered((prev) => [...prev, line]);
            setCurrentCmd("");
            charIndex.current = 0;
            lineIndex += 1;
            if (lineIndex >= lines.length) {
              setFinished(true);
              setRendered([]);
              schedule(() => typeCmd(lines[0], 300), PAUSE_AFTER_OUT);
            } else {
              schedule(() => typeCmd(lines[lineIndex], 200), PAUSE_AFTER_OUT);
            }
          }, PAUSE_AFTER_CMD);
        }
      };
      schedule(step, startDelay);
    };

    schedule(() => typeCmd(lines[0], 700), 600);

    const scroll = () => {
      const el = bodyRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    };
    scroll();
    const scrollTimer = window.setInterval(scroll, 120);

    return () => {
      cancelled = true;
      timeouts.forEach((t) => window.clearTimeout(t));
      window.clearInterval(scrollTimer);
    };
  }, [lines, prefersReduced]);

  // Reduced motion: render the completed transcript statically (no timing loop).
  const staticLines = useMemo(() => (prefersReduced ? lines : []), [prefersReduced, lines]);

  const visibleLines = prefersReduced ? staticLines : rendered;
  const showPromptLine = prefersReduced ? false : currentCmd.length > 0 || !finished;
  const showFinished = prefersReduced ? true : finished;

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-black/70 shadow-2xl backdrop-blur-sm">
      {/* title bar */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-accent/80" />
        <span className="h-3 w-3 rounded-full bg-[#fbbf24]/80" />
        <span className="h-3 w-3 rounded-full bg-primary/80" />
        <span className="ml-3 font-mono text-xs text-muted-foreground">
          {title}
        </span>
      </div>

      {/* body */}
      <div
        ref={bodyRef}
        className="scanlines relative h-[320px] overflow-y-auto px-5 py-4 font-mono text-[13px] leading-relaxed"
      >
        {visibleLines.map((line, i) => (
          <div key={i}>
            <p className="text-foreground/90">
              <span className="text-primary">{prompt}</span>
              <span className="text-muted-foreground"> $ </span>
              {line.cmd}
            </p>
            <p className="mb-1 text-muted-foreground">{line.out}</p>
          </div>
        ))}

        {showPromptLine && (
          <p>
            <span className="text-primary">{prompt}</span>
            <span className="text-muted-foreground"> $ </span>
            <span className="text-foreground/90">{currentCmd}</span>
            <span className="cursor-blink text-primary">▍</span>
          </p>
        )}

        {showFinished && (
          <p className="mb-1 text-primary/80">
            {done} <span className="cursor-blink">▍</span>
          </p>
        )}
      </div>
    </div>
  );
}