import type { AnyaEmotion } from "./types";

/**
 * Emotion/mode → photo mapping for Anya's avatar and the slow-changing
 * chat backdrop. Real photos live in `public/anya/` and are replaced by
 * pushing new files over these names (they never change at runtime):
 *
 *   /anya/anya.png           — neutral / default  (the alpha-coders portrait)
 *   /anya/thinking_anya.png  — thinking          (waiting for a reply)
 *   /anya/zlaia_anya.png     — angry             (user's message made her mad)
 *   /anya/happy_anya.png     — happy             (celebrates with the operator)
 *   /anya/hope_anya.png      — hoping            (optimistic / wishes luck)
 *   /anya/bye_anya.png       — goodbye           (saying farewell)
 */
export const ANYA_IMAGE_PATHS = {
  neutral: "/anya/anya.png",
  thinking: "/anya/thinking_anya.png",
  angry: "/anya/zlaia_anya.png",
  happy: "/anya/happy_anya.png",
  hope: "/anya/hope_anya.png",
  bye: "/anya/bye_anya.png",
} as const;

export type AnyaMark = keyof typeof ANYA_IMAGE_PATHS;

/** Which photo best matches the current mood + activity. */
export function anyaMark(emotion: AnyaEmotion, mode: AnyaMode): AnyaMark {
  if (mode === "thinking") return "thinking";
  switch (emotion) {
    case "bye":
      return "bye";
    case "angry":
      return "angry";
    case "happy":
    case "surprised":
      return "happy";
    case "hope":
      return "hope";
    default:
      return "neutral";
  }
}

export type AnyaMode = "idle" | "listening" | "thinking" | "speaking";