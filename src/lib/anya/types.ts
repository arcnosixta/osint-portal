export type AnyaRole = "user" | "assistant" | "system";

export interface AnyaMessage {
  role: AnyaRole;
  content: string;
}

export type AnyaEmotion =
  | "neutral"
  | "happy"
  | "sad"
  | "surprised"
  | "angry"
  | "think";

export type AnyaLanguage = "en" | "ru";

export interface AnyaRequest {
  messages: AnyaMessage[];
  language: AnyaLanguage;
}

export interface AnyaResponse {
  reply: string;
  emotion: AnyaEmotion;
  provider: string;
  model: string;
  /** Optional explanation — e.g. local offline fallback warning. */
  note?: string;
}