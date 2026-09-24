"use client";

import { useState } from "react";
import { AnyaAvatar, type AnyaMode } from "@/components/anya/AnyaAvatar";
import { anyaMark, ANYA_IMAGE_PATHS } from "@/lib/anya/face";
import type { AnyaEmotion } from "@/lib/anya/types";
import { cn } from "@/lib/utils";

interface AnyaFaceProps {
  emotion: AnyaEmotion;
  mode: AnyaMode;
  className?: string;
}

/**
 * Photo-based Anya portrait. Plain <img> — no image optimization, wallpapers
 * stay at full resolution (desktop project). Falls back to the procedural SVG
 * avatar when a photo is not pushed to `public/anya/` yet.
 */
export function AnyaFace({ emotion, mode, className }: AnyaFaceProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const mark = anyaMark(emotion, mode);
  const src = ANYA_IMAGE_PATHS[mark];
  const broken = failedSrc === src;

  if (broken) {
    return (
      <AnyaAvatar emotion={emotion} mode={mode === "thinking" ? "thinking" : "idle"} className={className} />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- no compression by design (user requirement)
    <img
      src={src}
      alt=""
      onError={() => setFailedSrc(src)}
      className={cn("h-full w-full object-cover", className)}
      draggable={false}
    />
  );
}