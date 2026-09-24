"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import type { AnyaMode } from "@/lib/anya/face";
import type { AnyaEmotion } from "@/lib/anya/types";

export interface AnyaChatMsg {
  id: number;
  role: "user" | "assistant";
  content: string;
  emotion?: AnyaEmotion;
}

const HISTORY_KEY = "osint-portal-anya-history";
const MAX_HISTORY = 40;
let nextId = 1;

function loadHistory(): AnyaChatMsg[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AnyaChatMsg[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (m) =>
          m &&
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string",
      )
      .slice(-MAX_HISTORY);
  } catch {
    return [];
  }
}

function saveHistory(msgs: AnyaChatMsg[]) {
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(msgs.slice(-MAX_HISTORY)));
  } catch {
    /* storage unavailable */
  }
}

export function useAnyaChat() {
  const { dict, lang } = useLanguage();
  const [msgs, setMsgs] = useState<AnyaChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [revealingId, setRevealingId] = useState<number | null>(null);
  const [revealLen, setRevealLen] = useState(0);
  const [emotion, setEmotion] = useState<AnyaEmotion>("neutral");
  const fullRef = useRef<Record<number, string>>({});
  const bootedRef = useRef(false);

  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;
    const stored = loadHistory();
    if (stored.length) {
      setMsgs(stored); // eslint-disable-line react-hooks/set-state-in-effect -- documented hydration pattern: transcript must not differ between server and first client render
      const last = [...stored].reverse().find((m) => m.role === "assistant");
      if (last?.emotion) setEmotion(last.emotion);
    } else {
      setMsgs([{ id: nextId++, role: "assistant", content: dict.anya.greeting }]);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- documented hydration pattern: transcript must not differ between server and first client render

  useEffect(() => {
    if (bootedRef.current && msgs.length) saveHistory(msgs);
  }, [msgs]);

  useEffect(() => {
    if (revealingId == null) return;
    const timer = window.setInterval(() => {
      setRevealLen((prev) => {
        const full = fullRef.current[revealingId];
        if (!full) return prev;
        if (prev >= full.length) {
          window.clearInterval(timer);
          setRevealingId(null);
          return prev;
        }
        return prev + 3;
      });
    }, 16);
    return () => window.clearInterval(timer);
  }, [revealingId]);

  const gaze = useMemo(() => {
    if (!input.length) return { x: 0, y: 0 };
    return { x: Math.max(-1, Math.min(1, ((input.length % 11) - 5) / 5)), y: 0 };
  }, [input]);

  const mode: AnyaMode = busy
    ? "thinking"
    : revealingId != null
      ? "speaking"
      : input.trim().length > 0
        ? "listening"
        : "idle";

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    const userMsg: AnyaChatMsg = { id: nextId++, role: "user", content: text };
    setMsgs((prev) => [...prev, userMsg]);
    setInput("");
    setBusy(true);
    setEmotion("neutral");
    try {
      const apiMessages = [...msgs, userMsg]
        .slice(-12)
        .map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch("/api/anya", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages, language: lang }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        reply?: string;
        emotion?: AnyaEmotion;
        message?: string;
      };
      if (!res.ok || !data.ok || typeof data.reply !== "string") {
        throw new Error(data.message || "bad response");
      }
      const id = nextId++;
      fullRef.current[id] = data.reply;
      const emotion = data.emotion || "neutral";
      setMsgs((prev) => [...prev, { id, role: "assistant", content: data.reply!, emotion }]);
      setEmotion(emotion);
      setRevealLen(0);
      setRevealingId(id);
    } catch {
      const id = nextId++;
      setMsgs((prev) => [
        ...prev,
        { id, role: "assistant", content: dict.anya.networkError, emotion: "sad" },
      ]);
      setEmotion("sad");
    } finally {
      setBusy(false);
    }
  };

  const clear = () => {
    setMsgs([{ id: nextId++, role: "assistant", content: dict.anya.greeting }]);
    setEmotion("neutral");
    try {
      window.localStorage.removeItem(HISTORY_KEY);
    } catch {
      /* noop */
    }
  };

  return {
    msgs,
    input,
    setInput,
    busy,
    emotion,
    mode,
    gaze,
    send,
    clear,
    revealingId,
    revealLen,
  };
}