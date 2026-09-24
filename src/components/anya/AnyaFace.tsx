"use client";

import Image from "next/image";
import { useState } from "react";
import { AnyaAvatar, type AnyaMode } from "@/components/anya/AnyaAvatar";
import { anyaMark, ANYA_IMAGE_PATHS } from "@/lib/anya/face";
import type { AnyaEmotion } from "@/lib/anya/types";
import { cn } from "@/lib/utils";

interface AnyaFaceProps {
  emotion: AnyaEmotion;
  mode: AnyaMode;
  className?: string;
  priority?: boolean;
}

/**
 * Photo-based Anya portrait. Falls back to the procedural SVG avatar when a
 * photo is not pushed to `public/anya/` yet.
 */
export function AnyaFace({ emotion, mode, className, priority }: AnyaFaceProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const mark = anyaMark(emotion, mode);
  const src = ANYA_IMAGE_PATHS[mark];
  const broken = failedSrc === src;

  if (broken) {
    return <AnyaAvatar emotion={emotion} mode={mode === "thinking" ? "thinking" : "idle"} className={className} />;
  }

  return (
    <Image
      src={src}
      alt=""
      fill
      priority={priority}
      sizes="(max-width: 640px) 96px, 160px"
      onError={() => setFailedSrc(src)}
      className={cn("object-cover", className)}
      draggable={false}
    />
  );
}