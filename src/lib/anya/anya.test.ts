import { test } from "node:test";
import assert from "node:assert/strict";
import { detectEmotion } from "./emotion";
import { buildSystemPrompt, capHistory } from "./prompt";
import { matchTool, fallbackReply } from "./fallback";
import { runAnya, type AnyaDeps } from "./index";
import type { AnyaRequest } from "./types";

const fakeProvider = (reply: string, provider = "fake") => async () =>
  provider === "local"
    ? null
    : { reply, provider, model: "fake-model" };

function req(text: string, language: "en" | "ru" = "ru"): AnyaRequest {
  return { messages: [{ role: "user", content: text }], language };
}

function depsFor(p: AnyaDeps["providers"]): AnyaDeps {
  return { providers: p as NonNullable<AnyaDeps["providers"]>, env: {} };
}

test("detectEmotion: happy/sad/angry/surprised", () => {
  assert.equal(detectEmotion("круто, отлично сработало"), "happy");
  assert.equal(detectEmotion("это грустно"), "sad");
  assert.equal(detectEmotion("меня это бесит"), "angry");
  assert.equal(detectEmotion("вау, не может быть"), "surprised");
  assert.equal(detectEmotion("thanks a lot!"), "happy");
});

test("detectEmotion: questions map to think", () => {
  assert.equal(detectEmotion("как использовать nmap?"), "think");
  assert.equal(detectEmotion("why is this failing?"), "think");
  assert.equal(detectEmotion("просто текст без эмоций"), "neutral");
});

test("buildSystemPrompt: persona knows her name and speaks the language", () => {
  assert.match(buildSystemPrompt("ru"), /Аня/);
  assert.match(buildSystemPrompt("en"), /Anya/);
  assert.match(buildSystemPrompt("ru"), /русском/);
  assert.match(buildSystemPrompt("en"), /ethical/);
});

test("capHistory: drops system roles and caps length", () => {
  const capped = capHistory([
    { role: "system", content: "secret system" },
    { role: "user", content: "a".repeat(3000) },
    { role: "assistant", content: "b".repeat(2000) },
    { role: "user", content: "hello" },
  ]);
  assert.equal(capped.length, 3);
  assert.ok(capped.every((m) => m.role === "user" || m.role === "assistant"));
  assert.ok(capped.every((m) => m.content.length <= 2000));
  assert.equal(capped[capped.length - 1].content, "hello");

  const big = capHistory(
    Array.from({ length: 10 }, (_, i) => ({
      role: (i % 2 ? "assistant" : "user") as "user" | "assistant",
      content: "x".repeat(1500),
    })),
  );
  const total = big.reduce((s, m) => s + m.content.length, 0);
  assert.ok(total <= 6000);
  assert.equal(big[big.length - 1].role, "user");
});

test("capHistory: never ends on an assistant message", () => {
  const capped = capHistory([
    { role: "user", content: "hi" },
    { role: "assistant", content: "hello!" },
  ]);
  assert.equal(capped.length, 1);
  assert.equal(capped[0].role, "user");
});

test("fallbackReply: recognizes tools and greetings", () => {
  assert.match(fallbackReply("как использовать nmap?", "ru", "think"), /nmap/);
  assert.equal(matchTool("dig for dns"), "dig");
  assert.equal(matchTool("nothing here"), null);
  assert.match(fallbackReply("hi", "en", "neutral"), /Anya/);
  assert.match(fallbackReply("привет", "ru", "neutral"), /Аня/);
});

test("runAnya: returns provider reply and detected emotion", async () => {
  const deps = depsFor(fakeProvider("Привет! Чем помочь?") as NonNullable<AnyaDeps["providers"]>);
  const res = await runAnya(req("что умеешь?"), deps);
  assert.equal(res.provider, "fake");
  assert.equal(res.reply, "Привет! Чем помочь?");
  assert.equal(res.emotion, "think");
});

test("runAnya: falls back to local brain when no provider answers", async () => {
  const deps = depsFor(fakeProvider("", "local") as NonNullable<AnyaDeps["providers"]>);
  const res = await runAnya(req("как работает dig?"), deps);
  assert.equal(res.provider, "local");
  assert.ok(res.reply.length > 0);
  assert.match(res.reply, /dig/);
});

test("runAnya: defaults empty message list to a system-only prompt", async () => {
  const seen: unknown[] = [];
  const deps: AnyaDeps = {
    env: {},
    providers: async (messages) => {
      seen.push(messages);
      return null;
    },
  };
  const res = await runAnya({ messages: [], language: "en" }, deps);
  assert.equal(res.provider, "local");
  assert.equal(seen.length, 1);
  const first = (seen[0] as { role: string }[])[0];
  assert.equal(first.role, "system");
});