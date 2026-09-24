"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { anyaMark, ANYA_IMAGE_PATHS } from "@/lib/anya/face";
import type { AnyaMode } from "@/lib/anya/face";
import type { AnyaEmotion } from "@/lib/anya/types";
import { cn } from "@/lib/utils";

interface BackdropLayer {
  id: number;
  src: string;
}

const FADE_MS = 2400;
let keySeq = 0;

interface AnyaBackdropProps {
  emotion: AnyaEmotion;
  mode: AnyaMode;
  className?: string;
}

/**
 * Full-screen Anya backdrop. Each time her mood changes the new photo is
 * stacked on top and slowly cross-fades in (2s+), so the portal reacts to
 * chat events without abrupt jumps.
 */
export function AnyaBackdrop({ emotion, mode, className }: AnyaBackdropProps) {
  const src = ANYA_IMAGE_PATHS[anyaMark(emotion, mode)];
  const [layers, setLayers] = useState<BackdropLayer[]>(() => [{ id: keySeq++, src }]);

  useEffect(() => {
    setLayers((prev) => { // eslint-disable-line react-hooks/set-state-in-effect -- crossfade stack: one render per mood change buys a 2s blend instead of an abrupt swap
      if (prev[prev.length - 1].src === src) return prev;
      return [...prev.slice(-1), { id: keySeq++, src }];
    });
  }, [src]);

  const fadingStart = layers.length > 1 ? layers[0].id : null;
  useEffect(() => {
    if (fadingStart == null) return;
    const timer = window.setTimeout(() => {
      setLayers((prev) => prev.filter((l) => l.id !== fadingStart));
    }, FADE_MS);
    return () => window.clearTimeout(timer);
  }, [fadingStart]);

  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} aria-hidden="true">
      {layers.map((layer, i) => {
        const isTop = i === layers.length - 1;
        const isFading = layers.length > 1 && !isTop;
        return (
          <Image
            key={layer.id}
            src={layer.src}
            alt=""
            fill
            sizes="100vw"
            className={cn("object-cover", isTop && isFading && "anya-bg-pop", isFading && "opacity-0")}
            draggable={false}
            priority={false}
          />
        );
      })}
      <div className="absolute inset-0 bg-black/20" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#06010a] via-black/70 to-black/45" />
    </div>
  );
}