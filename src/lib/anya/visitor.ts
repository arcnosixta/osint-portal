"use client";

import type { EnvLike } from "./providers";
import type { AnyaRequest, AnyaResponse } from "./types";
import { runAnya } from "./index";

/**
 * Bring-your-own-key Anya.
 *
 * The deployment is public and the operator's provider keys are private, so a
 * visitor who wants live answers supplies their own key. The key never leaves
 * the browser: it is kept in localStorage and the provider is called directly
 * from the page, so the site owner pays nothing for someone else's chat.
 *
 * `runAnya` is environment-agnostic, so this is the exact same prompt, provider
 * chain and offline fallback the server uses — only the `env` differs.
 */

export type AnyaProvider = "groq" | "openrouter" | "openai" | "ollama";

export interface AnyaSettings {
  provider: AnyaProvider;
  key: string;
  baseUrl: string;
  model: string;
  ollamaUrl: string;
}

const STORAGE_KEY = "osint-portal.anya.settings";

export const DEFAULT_ANYA_SETTINGS: AnyaSettings = {
  provider: "groq",
  key: "",
  baseUrl: "",
  model: "",
  ollamaUrl: "http://127.0.0.1:11434",
};

const isBrowser = typeof window !== "undefined";

export function loadAnyaSettings(): AnyaSettings {
  if (!isBrowser) return DEFAULT_ANYA_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ANYA_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AnyaSettings>;
    return {
      provider: parsed.provider ?? DEFAULT_ANYA_SETTINGS.provider,
      key: parsed.key ?? "",
      baseUrl: parsed.baseUrl ?? "",
      model: parsed.model ?? "",
      ollamaUrl: parsed.ollamaUrl ?? DEFAULT_ANYA_SETTINGS.ollamaUrl,
    };
  } catch {
    return DEFAULT_ANYA_SETTINGS;
  }
}

export function saveAnyaSettings(settings: AnyaSettings): void {
  if (!isBrowser) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* private mode / quota — the session still works, it just will not persist */
  }
}

export function clearAnyaSettings(): void {
  if (!isBrowser) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** A visitor has a usable configuration only once they supply a key or a base URL. */
export function hasVisitorKey(settings: AnyaSettings): boolean {
  if (settings.provider === "ollama") return Boolean(settings.ollamaUrl.trim());
  if (settings.provider === "openai") return Boolean(settings.key.trim() && settings.baseUrl.trim());
  return Boolean(settings.key.trim());
}

function envFromSettings(settings: AnyaSettings): EnvLike {
  switch (settings.provider) {
    case "groq":
      return { ANYA_GROQ_API_KEY: settings.key.trim() };
    case "openrouter":
      return { ANYA_OPENROUTER_API_KEY: settings.key.trim() };
    case "ollama":
      return { ANYA_OLLAMA_URL: settings.ollamaUrl.trim() || DEFAULT_ANYA_SETTINGS.ollamaUrl };
    case "openai":
      return {
        ANYA_API_KEY: settings.key.trim(),
        ANYA_BASE_URL: settings.baseUrl.trim(),
        ...(settings.model.trim() ? { ANYA_MODEL: settings.model.trim() } : {}),
      };
  }
}

/** Ask Anya using the visitor's own key, straight from the browser. */
export async function askAnyaWithVisitorKey(
  req: AnyaRequest,
  settings: AnyaSettings,
): Promise<AnyaResponse> {
  return runAnya(req, { env: envFromSettings(settings) });
}

export const ANYA_PROVIDER_LABELS: Record<AnyaProvider, string> = {
  groq: "Groq",
  openrouter: "OpenRouter",
  openai: "OpenAI-compatible",
  ollama: "Ollama (local)",
};
