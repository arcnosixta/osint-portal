import { capHistory, buildSystemPrompt } from "./prompt";
import { detectEmotion } from "./emotion";
import { fallbackReply } from "./fallback";
import { tryProviders, type EnvLike, type ProviderReply } from "./providers";
import type { AnyaRequest, AnyaResponse } from "./types";

export interface AnyaDeps {
  providers?: (
    messages: Parameters<typeof tryProviders>[0],
    language: Parameters<typeof tryProviders>[1],
    env: EnvLike,
  ) => Promise<ProviderReply | null>;
  env?: EnvLike;
}

const MAX_BODY_MESSAGES = 20;

export async function runAnya(req: AnyaRequest, deps: AnyaDeps = {}): Promise<AnyaResponse> {
  const language = req.language === "ru" ? "ru" : "en";
  const raw = Array.isArray(req.messages) ? req.messages.slice(-MAX_BODY_MESSAGES) : [];
  const history = capHistory(raw);
  const apiMessages = history.length
    ? [{ role: "system" as const, content: buildSystemPrompt(language) }, ...history]
    : [{ role: "system" as const, content: buildSystemPrompt(language) }];

  const env = deps.env ?? (process.env as EnvLike);
  const chat = deps.providers ?? tryProviders;

  const lastUser = [...history].reverse().find((m) => m.role === "user");
  const userText = lastUser?.content ?? "";
  const emotion = detectEmotion(userText);

  const provider = await chat(apiMessages, language, env);

  if (provider) {
    return {
      reply: provider.reply,
      emotion,
      provider: provider.provider,
      model: provider.model,
    };
  }

  return {
    reply: fallbackReply(userText, language, emotion),
    emotion,
    provider: "local",
    model: "offline-fallback",
  };
}