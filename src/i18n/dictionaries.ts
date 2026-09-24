import { en, type Dictionary } from "./en";
import { ru } from "./ru";

export type { Dictionary };

export type Locale = "en" | "ru";

const dictionaries: Record<Locale, Dictionary> = {
  en,
  ru,
};

export const locales: Locale[] = ["en", "ru"];

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}