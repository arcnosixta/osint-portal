import type { AnyaEmotion, AnyaLanguage } from "./types";

const TOOL_MAP: Record<string, string> = {
  nmap: "nmap",
  netcat: "netcat",
  nc: "netcat",
  dig: "dig",
  host: "host",
  whois: "whois",
  sherlock: "sherlock",
  openssl: "openssl",
  traceroute: "traceroute",
  jq: "jq",
  curl: "curl",
};

/** Which portal tool (if any) the operator's text mentions. */
export function matchTool(text: string): string | null {
  const t = text.toLowerCase();
  for (const key of Object.keys(TOOL_MAP)) {
    if (t.includes(key)) return TOOL_MAP[key];
  }
  return null;
}

/**
 * Offline "brain": keeps Anya alive when no model backend is reachable.
 * Simple keyword routing + a warm personality, fully localized.
 */
export function fallbackReply(
  userText: string,
  language: AnyaLanguage,
  emotion: AnyaEmotion,
): string {
  const tool = matchTool(userText);
  const t = userText.toLowerCase();

  if (emotion === "bye") {
    return language === "ru"
      ? "До встречи! Возвращайся — я всегда тут, в углу экрана. 🖐"
      : "See you soon! I'll be right here in the corner of your screen. 🖐";
  }

  if (tool) {
    return language === "ru"
      ? `Отличный выбор — модуль \`${tool}\` живой и привязан к локальному бинарнику. Открой его воркбенч через карточку инструмента (раздел Tools), укажи цель и нажми Run. Я подскажу, какие флаги безопасно использовать.`
      : `Good pick — \`${tool}\` is wired to a real local binary. Open its workbench from the Tools section, set a target and press Run. Ask me about safe flags anytime.`;
  }

  if (/^[а-яёa-z0-9\s,.!]+$/i.test(userText) && /(hi|hello|hey|привет|здравствуй|здравствуйте|салют)/i.test(t)) {
    return language === "ru"
      ? "Привет! Я Аня — ИИ-ассистент OSINT Portal. Могу объяснить любой инструмент из каталога, помочь прочитать результат скана или подсказать следующий шаг в расследовании."
      : "Hey! I'm Anya, the OSINT Portal AI assistant. I can explain any catalog module, help you read scan results, or suggest the next investigation step.";
  }

  if (/(help|помощь|что ты умеешь|что умеешь|как ты работаешь|who are you|кто ты|расскажи о себе)/i.test(t)) {
    return language === "ru"
      ? "Я живу прямо в портале: объясняю инструменты, читаю результаты воркбенчей и советую безопасные флаги. Всё выполняется локально — я не запускаю команды, только помогаю. Спроси, например, «как снять порты с nmap» или «что показал whois»."
      : "I live inside the portal: I explain tools, read workbench results and recommend safe flags. Everything runs locally — I never execute commands, I only advise. Try asking “how do I scan ports with nmap” or “what did whois show”.";
  }

  if (/(tool|catalog|list|инструмент|что есть|каталог|модули|модул)/i.test(t)) {
    return language === "ru"
      ? "В каталоге 18 модулей: nmap, netcat, dig, host, whois, sherlock, curl, openssl, traceroute, jq и другие. Прямо сейчас живы 10 — те, чьи бинарники стоят на этой машине. Зелёная точка на карточке = готов к запуску."
      : "There are 18 modules in the catalog: nmap, netcat, dig, host, whois, sherlock, curl, openssl, traceroute, jq and more. Ten are live right now — the ones whose binaries exist on this host. A green dot on the card means it's ready.";
  }

  const feel =
    emotion === "happy"
      ? language === "ru"
        ? "Рада, что ты доволен! "
        : "Glad that makes you happy! "
      : emotion === "sad"
        ? language === "ru"
          ? "Понимаю, это неприятно. "
          : "I get it, that stinks. "
        : emotion === "surprised"
          ? language === "ru"
            ? "Ого, любопытно! "
            : "Oh wow, interesting! "
          : "";

  return language === "ru"
    ? `${feel}Я в офлайн-режиме — к порталу пока не подключена нейросеть, но я всё равно постараюсь помочь. Опиши задачу: цель (домен, IP, ник) и что хочешь узнать, и я подскажу, какой инструмент запустить.`
    : `${feel}I'm in offline mode — no neural backend is hooked up yet, but I'll still try to help. Describe the task: a target (domain, IP, handle) and what you want to learn, and I'll point you to the right tool.`;
}