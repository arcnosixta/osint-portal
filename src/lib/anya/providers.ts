import type { AnyaLanguage, AnyaMessage } from "./types";

export interface ProviderReply {
  reply: string;
  provider: string;
  model: string;
}

export interface EnvLike {
  ANYA_OLLAMA_URL?: string;
  ANYA_MODEL?: string;
  ANYA_GROQ_API_KEY?: string;
  ANYA_OPENROUTER_API_KEY?: string;
  ANYA_API_KEY?: string;
  ANYA_BASE_URL?: string;
  ANYA_TIMEOUT_MS?: string;
  [key: string]: string | undefined;
}

const DEFAULT_TIMEOUT_MS = 30_000;

function timeoutMs(env: EnvLike): number {
  const n = Number(env.ANYA_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TIMEOUT_MS;
}

/** OpenAI-compatible POST /chat/completions helper. */
async function postChatCompletions(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: AnyaMessage[],
  timeoutMs: number,
): Promise<{ reply: string; provider: string; model: string }> {
  const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 500,
      stream: false,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 200);
    throw new Error(`${res.status} ${detail}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const reply = data.choices?.find((c) => c.message?.content)?.message?.content;
  if (!reply?.trim()) throw new Error("empty completion");
  return { reply: reply.trim(), provider: "http", model };
}

/** Ollama — fully local, no API key. Only used when the daemon answers. */
async function tryOllama(
  messages: AnyaMessage[],
  env: EnvLike,
): Promise<ProviderReply | null> {
  const url = (env.ANYA_OLLAMA_URL || "http://127.0.0.1:11434").replace(/\/+$/, "");
  let tags: { models?: unknown[] };
  try {
    const res = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(1500) });
    if (!res.ok) return null;
    tags = (await res.json()) as { models?: unknown[] };
  } catch {
    return null;
  }
  if (!Array.isArray(tags.models) || tags.models.length === 0) return null;

  const model = env.ANYA_MODEL || "qwen2.5:3b";
  try {
    const res = await fetch(`${url}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        options: { temperature: 0.7 },
      }),
      signal: AbortSignal.timeout(timeoutMs(env)),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { message?: { content?: string } };
    const reply = data.message?.content;
    if (!reply?.trim()) return null;
    return { reply: reply.trim(), provider: "ollama", model };
  } catch {
    return null;
  }
}

async function tryGroq(
  messages: AnyaMessage[],
  env: EnvLike,
): Promise<ProviderReply | null> {
  const key = env.ANYA_GROQ_API_KEY;
  if (!key) return null;
  const model = "llama-3.1-8b-instant";
  try {
    return {
      ...(await postChatCompletions(
        "https://api.groq.com/openai/v1",
        key,
        model,
        messages,
        timeoutMs(env),
      )),
      provider: "groq",
    };
  } catch {
    return null;
  }
}

async function tryOpenRouter(
  messages: AnyaMessage[],
  env: EnvLike,
): Promise<ProviderReply | null> {
  const key = env.ANYA_OPENROUTER_API_KEY;
  if (!key) return null;
  const model = "meta-llama/llama-3.3-70b-instruct:free";
  try {
    return {
      ...(await postChatCompletions(
        "https://openrouter.ai/api/v1",
        key,
        model,
        messages,
        timeoutMs(env),
      )),
      provider: "openrouter",
    };
  } catch {
    return null;
  }
}

async function tryGenericOpenAI(
  messages: AnyaMessage[],
  env: EnvLike,
): Promise<ProviderReply | null> {
  const key = env.ANYA_API_KEY;
  const base = env.ANYA_BASE_URL;
  const model = env.ANYA_MODEL || "gpt-4o-mini";
  if (!key || !base) return null;
  try {
    const provider = /generativelanguage/i.test(base) ? "gemini" : "openai";
    return {
      ...(await postChatCompletions(base, key, model, messages, timeoutMs(env))),
      provider,
    };
  } catch {
    return null;
  }
}

export async function tryProviders(
  messages: AnyaMessage[],
  _language: AnyaLanguage,
  env: EnvLike,
): Promise<ProviderReply | null> {
  return (
    (await tryOllama(messages, env)) ??
    (await tryGroq(messages, env)) ??
    (await tryOpenRouter(messages, env)) ??
    (await tryGenericOpenAI(messages, env))
  );
}

/** Human-readable config summary for the GET /api/anya introspection. */
export function summarizeProviders(env: EnvLike): Record<string, string | false> {
  return {
    ollama: env.ANYA_OLLAMA_URL || "http://127.0.0.1:11434 (auto)",
    groq: env.ANYA_GROQ_API_KEY ? "key set" : false,
    openrouter: env.ANYA_OPENROUTER_API_KEY ? "key set" : false,
    openaiCompatible: env.ANYA_API_KEY && env.ANYA_BASE_URL ? "key + base set" : false,
  };
}