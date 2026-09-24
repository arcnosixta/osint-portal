import type { AnyaEmotion } from "./types";

const JOY =
  /(?:\u{1F600}|\u{1F601}|\u{1F604}|\u{1F973}|\u{1F389}|\u{1F44D}|класс|круто|отличн|супер|здорово|кайф|ура|love|awesome|great|excellent|cool|nice|amazing|thanks|thank)/iu;

const SAD =
  /(?:\u{1F622}|\u{1F62D}|\u{1F625}|груст|печаль|жалк|плохо|увы|хренов|sad|unfortunate|worried)/iu;

const ANGRY =
  /(?:\u{1F621}|\u{1F620}|злость|злюс|бесит|раздража|ненавиж|глуп|тупой|angry|hate|stupid)/iu;

const SURPRISE =
  /(?:\u{1F632}|\u{1F62E}|\u{1F62F}|вау|ого|офиг|ух ты|whoa|wow|не может быть|серьёзно|seriously|really\?|как так)/iu;

export function detectEmotion(text: string): AnyaEmotion {
  const t = text.trim();
  const last = t.endsWith("?") ? t.slice(0, -1) : t;
  if (/[а-яёa-z]+\?\s*$|#|как|почему|что|где|кто|какой|зачем|how|why|what|where|which|help/iu.test(last)) {
    return "think";
  }
  if (ANGRY.test(t)) return "angry";
  if (SAD.test(t)) return "sad";
  if (SURPRISE.test(t)) return "surprised";
  if (JOY.test(t)) return "happy";
  return "neutral";
}