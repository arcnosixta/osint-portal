"use client";

import { useState } from "react";
import {
  ANYA_PROVIDER_LABELS,
  DEFAULT_ANYA_SETTINGS,
  clearAnyaSettings,
  hasVisitorKey,
  loadAnyaSettings,
  saveAnyaSettings,
  type AnyaProvider,
  type AnyaSettings,
} from "@/lib/anya/visitor";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { cn } from "@/lib/utils";

const PROVIDERS: AnyaProvider[] = ["groq", "openrouter", "openai", "ollama"];

const HINTS: Record<AnyaProvider, string> = {
  groq: "Free tier at console.groq.com — the fastest option here.",
  openrouter: "Free models are marked :free on openrouter.ai.",
  openai: "Any OpenAI-compatible endpoint: base URL + key + model.",
  ollama: "Runs on your own machine. Start it with `ollama serve`.",
};

const FIELD =
  "w-full rounded-lg border border-[#ff6fb5]/30 bg-black/40 px-3 py-2 font-mono text-[12px] text-[#ffe3ef] placeholder:text-[#ff9bcf]/40 focus:border-[#ff6fb5]/70 focus:outline-none";

/**
 * Bring-your-own-key panel.
 *
 * The deployed site is public but the operator's provider keys are private, so
 * a visitor who wants live answers configures their own provider here. The key
 * is kept in this browser's localStorage and sent straight to the provider —
 * it never touches the site.
 */
export function AnyaKeySettings({ onClose }: { onClose: () => void }) {
  const { dict } = useLanguage();
  const [settings, setSettings] = useState<AnyaSettings>(() => loadAnyaSettings());

  const t = dict.anya.settings;
  const patch = (next: Partial<AnyaSettings>) => setSettings((prev) => ({ ...prev, ...next }));

  const save = () => {
    saveAnyaSettings(settings);
    onClose();
  };

  const forget = () => {
    clearAnyaSettings();
    setSettings(DEFAULT_ANYA_SETTINGS);
    onClose();
  };

  return (
    <div className="absolute inset-0 z-20 flex items-start justify-center overflow-y-auto bg-black/75 px-4 py-10 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-[#ff6fb5]/40 bg-[#1a0512]/95 p-6 shadow-[0_0_60px_rgba(255,45,149,.35)]">
        <h2 className="font-mono text-sm uppercase tracking-[0.3em] text-[#ffd0ea]">
          {t.title}
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-[#ffb3db]/85">{t.blurb}</p>

        <div className="mt-5 flex flex-wrap gap-2">
          {PROVIDERS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => patch({ provider: p })}
              aria-pressed={settings.provider === p}
              className={cn(
                "cursor-pointer rounded-full border px-3 py-1.5 font-mono text-[11px] transition-colors",
                settings.provider === p
                  ? "border-[#ff6fb5] bg-[#ff6fb5]/20 text-[#ffe3ef]"
                  : "border-[#ff6fb5]/30 text-[#ffb3db]/80 hover:border-[#ff6fb5]/60",
              )}
            >
              {ANYA_PROVIDER_LABELS[p]}
            </button>
          ))}
        </div>

        <p className="mt-2 font-mono text-[11px] text-[#ff9bcf]/70">{HINTS[settings.provider]}</p>

        <div className="mt-5 flex flex-col gap-3">
          {settings.provider === "ollama" ? (
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[11px] text-[#ff9bcf]">{t.ollamaUrl}</span>
              <input
                className={FIELD}
                value={settings.ollamaUrl}
                onChange={(e) => patch({ ollamaUrl: e.target.value })}
                placeholder="http://127.0.0.1:11434"
              />
            </label>
          ) : (
            <>
              <label className="flex flex-col gap-1">
                <span className="font-mono text-[11px] text-[#ff9bcf]">{t.apiKey}</span>
                <input
                  className={FIELD}
                  type="password"
                  autoComplete="off"
                  value={settings.key}
                  onChange={(e) => patch({ key: e.target.value })}
                  placeholder={settings.provider === "groq" ? "gsk_…" : "sk-or-v1-…"}
                />
              </label>

              {settings.provider === "openai" && (
                <>
                  <label className="flex flex-col gap-1">
                    <span className="font-mono text-[11px] text-[#ff9bcf]">{t.baseUrl}</span>
                    <input
                      className={FIELD}
                      value={settings.baseUrl}
                      onChange={(e) => patch({ baseUrl: e.target.value })}
                      placeholder="https://api.example.com/v1"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="font-mono text-[11px] text-[#ff9bcf]">{t.model}</span>
                    <input
                      className={FIELD}
                      value={settings.model}
                      onChange={(e) => patch({ model: e.target.value })}
                      placeholder="gpt-4o-mini"
                    />
                  </label>
                </>
              )}
            </>
          )}
        </div>

        <p className="mt-4 text-[12px] leading-relaxed text-[#ff9bcf]/75">{t.localOnly}</p>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={save}
            className="cursor-pointer rounded-lg border border-[#ff6fb5] bg-[#ff4d9d]/25 px-4 py-2 font-mono text-[12px] text-[#ffe3ef] transition-colors hover:bg-[#ff4d9d]/40"
          >
            {t.save}
          </button>
          <button
            type="button"
            onClick={forget}
            className="cursor-pointer rounded-lg border border-[#ff6fb5]/30 px-4 py-2 font-mono text-[12px] text-[#ffb3db]/80 transition-colors hover:border-[#ff6fb5]/60"
          >
            {t.forget}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer font-mono text-[12px] text-[#ff9bcf]/80 underline-offset-4 hover:underline"
          >
            {t.cancel}
          </button>
          {!hasVisitorKey(settings) && (
            <span className="font-mono text-[11px] text-[#ffb3db]/70">{t.optional}</span>
          )}
        </div>
      </div>
    </div>
  );
}
