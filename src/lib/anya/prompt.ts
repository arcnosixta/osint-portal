import type { AnyaLanguage, AnyaMessage } from "./types";

const MAX_HISTORY_MESSAGES = 14;
const MAX_HISTORY_CHARS = 6000;
const MAX_MESSAGE_CHARS = 2000;

export function buildSystemPrompt(language: AnyaLanguage): string {
  const persona =
    language === "ru"
      ? `Ты — Аня, живой ИИ-ассистент OSINT Portal. Говоришь кратко, тепло и с лёгким характером.
Твоя работа — помогать оператору портала: объяснять OSINT-инструменты, помогать читать результаты воркбенчей (nmap, dig, whois, sherlock, openssl, traceroute, jq, curl, netcat, host), подсказывать следующий шаг в расследовании и напоминать о правилах этичного использования.
Пиши на понятном русском, максимум 120 слов. Не выполняй команды — только советуй. Никогда не поощряй атаки на системы, к которым у пользователя нет явного разрешения.`
      : `You are Anya, the OSINT Portal's living AI assistant. Speak briefly, warmly, with a light personality.
Your job is to help the operator: explain OSINT tooling, help read workbench results (nmap, dig, whois, sherlock, openssl, traceroute, jq, curl, netcat, host), suggest the next investigation step and remind about ethical-use rules.
Reply in clear English, at most 120 words. Never execute commands — only advise. Never encourage attacks against systems the user has no explicit permission to test.`;
  return persona;
}

/** Normalise + cap the conversation history before it talks to a provider. */
export function capHistory(messages: AnyaMessage[]): AnyaMessage[] {
  const clean: AnyaMessage[] = [];
  for (const m of messages) {
    if (m.role !== "user" && m.role !== "assistant") continue;
    const content = typeof m.content === "string" ? m.content.slice(0, MAX_MESSAGE_CHARS) : "";
    if (!content.trim()) continue;
    clean.push({ role: m.role, content });
    if (clean.length >= MAX_HISTORY_MESSAGES) break;
  }
  // Keep the tail (most recent) of the conversation.
  let out = clean.slice(-MAX_HISTORY_MESSAGES);
  const budget = MAX_HISTORY_CHARS;
  let used = 0;
  for (let i = out.length - 1; i >= 0; i--) {
    const size = out[i].content.length;
    if (used + size > budget) {
      out = out.slice(i + 1);
      break;
    }
    used += size;
  }
  // Never send an empty prompt to a model behind a trailing assistant role.
  while (out.length && out[out.length - 1].role === "assistant") out.pop();
  return out;
}