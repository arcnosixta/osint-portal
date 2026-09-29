/**
 * Starting the local tools, with no terminal and no local page to visit.
 *
 * Three situations, in the order the user meets them:
 *
 *  1. The extension is installed. The page asks the extension, the browser
 *     launches the native host, the host starts the helper, and the helper
 *     starts the runner. This component only reports progress and then
 *     disappears — there is nothing left for the user to click, which is the
 *     whole point of the extension.
 *  2. No extension, helper already running. Same automatic path over a direct
 *     loopback call, if the browser allows it.
 *  3. Neither. A dead button is worse than an honest instruction, so the
 *     primary control is only rendered when something is actually listening.
 */

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { helperStatus, startTools, type HelperStatus } from "@/lib/helper-client";
import { bridgeAvailable } from "@/lib/bridge";

type Phase = "starting" | "running" | "absent";

export function StartToolsButton({ compact }: { compact?: boolean }) {
  const { dict } = useLanguage();
  const [phase, setPhase] = useState<Phase>("starting");
  const [detail, setDetail] = useState<HelperStatus | null>(null);
  const started = useRef(false);
  const t = dict.runner;

  useEffect(() => {
    let alive = true;

    const poll = async () => {
      const status = await helperStatus();
      if (!alive) return;
      setDetail(status);
      if (status?.runner.up) {
        setPhase("running");
        return;
      }
      if (status) {
        // The helper is up but the runner is not. Ask once, then wait.
        if (!started.current) {
          started.current = true;
          await startTools();
        }
        return;
      }
      // Nothing is listening: either the extension can still bring it up, or
      // this machine has no helper at all.
      if (await bridgeAvailable()) {
        if (!started.current) {
          started.current = true;
          await startTools();
        }
        return;
      }
      setPhase("absent");
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
        {phase === "starting" && <span className="text-[#63788f]">{t.checking}</span>}
        {absent && <span className="text-[#9fb2c8]">{t.helperSilent}</span>}
      </div>

      {absent ? (
        <div className="flex flex-col gap-1.5 leading-relaxed text-[#9fb2c8]">
          <p>{t.absentFirst}</p>
          <p className="text-[#7f93ab]">{t.absentSecond}</p>
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
