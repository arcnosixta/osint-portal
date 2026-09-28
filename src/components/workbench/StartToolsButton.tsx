"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { HELPER_URL, helperStatus, type HelperStatus } from "@/lib/helper-client";
import { cn } from "@/lib/utils";

type Phase = "checking" | "running" | "stopped" | "absent";

/**
 * "Start the tools" button.
 *
 * A website cannot start a local process, so this button does not try. It opens
 * the local helper's control page in a new tab, where a human confirms the
 * start. The helper itself refuses control actions from any foreign origin, so
 * no page on the internet — including this one — can launch binaries behind the
 * user's back. That is the whole point of routing through a local page.
 */
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

  // A failed probe means one of two very different things, and the fix differs.
  // From a public https origin Chrome blocks the local network outright (the
  // Local Network Access permission), so the helper may well be installed and
  // running — telling the user to install it would be wrong.
  const publicOrigin =
    typeof window !== "undefined" &&
    window.location.protocol === "https:" &&
    !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);

  const openHelper = () => {
    window.open(`${HELPER_URL}/`, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-[#38d39f]/40 bg-[#0b1a16]/80 p-3",
        compact ? "text-[11px]" : "text-xs",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-[#7ef0c4]">{t.whyTitle}</span>
        <button
          type="button"
          onClick={openHelper}
          className="cursor-pointer rounded-md border border-[#38d39f] bg-[#38d39f]/20 px-3 py-1.5 font-semibold text-[#eafff5] transition-colors hover:bg-[#38d39f]/35"
        >
          {t.openHelper}
        </button>
        {phase === "checking" && <span className="text-[#63788f]">{t.checking}</span>}
        {phase === "absent" && (
          <span className="text-[#9fb2c8]">
            {publicOrigin ? t.helperBlocked : t.helperMissing}
          </span>
        )}
      </div>

      <p className="leading-relaxed text-[#9fb2c8]">
        {t.whyBody}
        {phase === "absent" && !publicOrigin && (
          <>
            {" "}
            <code className="rounded bg-black/40 px-1.5 py-0.5 text-[#7ef0c4]">
              npm run helper:install
            </code>
          </>
        )}
      </p>

      {detail && !detail.runner.up && detail.runner.error && (
        <p className="text-[#7f93ab]">
          {t.runnerError}: <code className="text-[#ffb4a2]">{detail.runner.error}</code>
        </p>
      )}
    </div>
  );
}
