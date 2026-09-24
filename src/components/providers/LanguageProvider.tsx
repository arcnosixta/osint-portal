"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getDictionary, locales, type Dictionary, type Locale } from "@/i18n/dictionaries";

const STORAGE_KEY = "osint-portal-lang";

interface LanguageContextValue {
  lang: Locale;
  setLang: (lang: Locale) => void;
  dict: Dictionary;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function detectInitialLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored && (locales as string[]).includes(stored)) return stored as Locale;
  const nav = window.navigator.language?.toLowerCase() ?? "";
  if (nav.startsWith("ru")) return "ru";
  return "en";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Locale>("en");

  // Hydrate from storage / browser after mount to avoid mismatch flash.
  useEffect(() => {
    const initial = detectInitialLocale();
    setLangState(initial); // eslint-disable-line react-hooks/set-state-in-effect -- documented hydration pattern: must not differ between server and first client render
    document.documentElement.lang = initial;
  }, []);

  const setLang = (next: Locale) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage unavailable */
    }
    document.documentElement.lang = next;
  };

  const dict = useMemo(() => getDictionary(lang), [lang]);

  const value = useMemo(() => ({ lang, setLang, dict }), [lang, dict]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}