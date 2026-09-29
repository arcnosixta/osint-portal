/**
 * Entry point for starting the local tools.
 *
 * A web page cannot start a process, so the tools live behind a local helper
 * (see helper/agent.ts) that starts the runner only after a human confirms on
 * its own loopback page. This block does three things and no more:
 *
 *  - disappears when the runner is already up;
 *  - offers the control page when the helper answers;
 *  - explains what to do when it does not answer.
 *
 * The last case is why this is a link and not a click handler. Opening
 * http://127.0.0.1:8788 when nothing is listening yields a browser error tab
 * that looks like a dead button, and popup blockers make it worse. A failed
 * probe cannot tell "helper not installed" from "browser blocked the local
 * network" — both surface as a rejected fetch — so we state both fixes instead
 * of guessing which one applies.
 */
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { HELPER_URL, helperStatus, type HelperStatus } from "@/lib/helper-client";

type Phase = "checking" | "running" | "stopped" | "absent";

export function StartToolsButton({ compact }: { compact?: boolean }) {
  const { dict } = useLanguage();
  const [phase, setPhase] = useState<Phase>("checking");
  const [detail, setDetail] = useState<HelperStatus | null>(null);
  const t = dict.runner;

  useEffect(() => {
    let alive = true;

    const poll = async () => {
      const s = await helperStatus();
      if (!alive) return;
      setDetail(s);
      setPhase(!s ? "absent" : s.runner.up ? "running" : "stopped");
    };

    void poll();
    const timer = setInterval(poll, 2000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  if (phase === "running") return null;

  const absent = phase === "absent";

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-[#38d39f]/40 bg-[#0b1a16]/80 p-3",
        compact ? "text-[11px]" : "text-xs",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-[#7ef0c4]">{t.whyTitle}</span>

        {/*
          The primary control only exists when the helper answered. Without it
          the link is demoted to a diagnostic at the bottom, because pressing a
          prominent button that lands on a browser error page is exactly the
          "button does nothing" report.
        */}
        {!absent && (
          <a
            href={`${HELPER_URL}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-[#38d39f] bg-[#38d39f]/20 px-3 py-1.5 font-semibold text-[#eafff5] transition-colors hover:bg-[#38d39f]/35"
          >
            {t.openHelper}
          </a>
        )}

        {phase === "checking" && <span className="text-[#63788f]">{t.checking}</span>}
        {phase === "stopped" && <span className="text-[#9fb2c8]">{t.helperReady}</span>}
        {absent && <span className="text-[#9fb2c8]">{t.helperSilent}</span>}
      </div>

      {absent ? (
        <div className="flex flex-col gap-1.5 leading-relaxed text-[#9fb2c8]">
          <p>
            {t.absentFirst}{" "}
            <code className="rounded bg-black/40 px-1.5 py-0.5 text-[#7ef0c4]">
              npm run helper:install
            </code>
          </p>
          <p className="text-[#7f93ab]">{t.absentSecond}</p>
          <p className="text-[#7f93ab]">
            {t.manualLink}{" "}
            <a
              href={`${HELPER_URL}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#7ef0c4] underline decoration-dotted underline-offset-4"
            >
              http://127.0.0.1:8788/
            </a>
          </p>
        </div>
      ) : (
        <p className="leading-relaxed text-[#9fb2c8]">{t.whyBody}</p>
      )}

      {detail && !detail.runner.up && detail.runner.error && (
        <p className="text-[#7f93ab]">
          {t.runnerError}: <code className="text-[#ffb4a2]">{detail.runner.error}</code>
        </p>
      )}
    </div>
  );
}
