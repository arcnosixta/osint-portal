import type { AnyaEmotion } from "@/lib/anya/types";
import type { AnyaMode } from "@/lib/anya/face";

export type { AnyaMode };

interface AnyaAvatarProps {
  emotion?: AnyaEmotion;
  mode?: AnyaMode;
  /** typing-driven eye focus, -1…1 … 1 */
  gaze?: { x: number; y: number };
  className?: string;
}

const HAIR = "#0e150f";
const SKIN = "#f4e6d2";
const PRIMARY = "#00ff41";
const MOUTH = "#3a1d1d";
const BROW = "#242c26";

function Iris({ x, y, r, gaze }: { x: number; y: number; r: number; gaze: { x: number; y: number } }) {
  return (
    <g transform={`translate(${gaze.x * 1.6} ${gaze.y * 2})`}>
      <circle cx={x} cy={y} r={r} fill={PRIMARY} />
      <circle cx={x + r * 0.35} cy={y - r * 0.35} r={r * 0.32} fill="#ffffff" />
    </g>
  );
}

function Eye({
  x,
  y,
  emotion,
  gaze,
  surprisedScale = 1,
}: {
  x: number;
  y: number;
  emotion: AnyaEmotion;
  gaze: { x: number; y: number };
  surprisedScale?: number;
}) {
  if (emotion === "happy") {
    return <path d={`M${x - 7} ${y + 1} Q${x} ${y - 8} ${x + 7} ${y + 1}`} fill="none" stroke={BROW} strokeWidth={2.4} strokeLinecap="round" />;
  }
  const ry = (emotion === "surprised" ? 8.4 : 6.2) * surprisedScale;
  const rx = (emotion === "surprised" ? 6.8 : 5.2) * surprisedScale;
  const gazeY = emotion === "think" ? -1.6 : emotion === "sad" ? 1.4 : 0;
  const irisR = (emotion === "surprised" ? 4.2 : 2.7) * surprisedScale;
  return (
    <g>
      <ellipse cx={x} cy={y} rx={rx} ry={ry} fill="#eafff0" />
      <Iris x={x - 1.1} y={y + gazeY} r={irisR} gaze={gaze} />
    </g>
  );
}

function Eyebrow({ x, y, tilt, length = 10 }: { x: number; y: number; tilt: number; length?: number }) {
  return (
    <path
      d={`M${x - length} ${y + tilt} L${x + length} ${y - tilt}`}
      fill="none"
      stroke={BROW}
      strokeWidth={3}
      strokeLinecap="round"
    />
  );
}

function Mouth({ emotion, mode }: { emotion: AnyaEmotion; mode: AnyaMode }) {
  const speaking = mode === "speaking";
  let shape: React.ReactNode;
  switch (emotion) {
    case "happy":
      shape = <path d="M58 88 Q70 100 82 88 Q70 93.5 58 88 Z" fill={MOUTH} />;
      break;
    case "sad":
      shape = <path d="M63 92 Q70 87.5 77 92" fill="none" stroke={MOUTH} strokeWidth={2.4} strokeLinecap="round" />;
      break;
    case "surprised":
      shape = <ellipse cx={70} cy={91} rx={3.2} ry={4} fill={MOUTH} />;
      break;
    case "angry":
      shape = <path d="M63 92 H77" stroke={MOUTH} strokeWidth={2.6} strokeLinecap="round" />;
      break;
    case "think":
      shape = <path d="M64 92 q6 -4.5 12 0" fill="none" stroke={MOUTH} strokeWidth={2.2} strokeLinecap="round" />;
      break;
    default:
      shape = <path d="M62 91 Q70 93.5 78 91" fill="none" stroke={MOUTH} strokeWidth={2.2} strokeLinecap="round" />;
  }
  return (
    <g className={speaking ? "anya-mouth anya-voice" : "anya-mouth"}>{shape}</g>
  );
}

export function AnyaAvatar({
  emotion = "neutral",
  mode = "idle",
  gaze = { x: 0, y: 0 },
  className,
}: AnyaAvatarProps) {
  const surprised = emotion === "surprised";
  const headClass =
    mode === "listening" || mode === "thinking" ? "anya-listen" : "anya-float";

  return (
    <svg viewBox="0 0 140 140" role="img" className={className} aria-hidden="true">
      <defs>
        <radialGradient id="anya-aura" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(0,255,65,0.28)" />
          <stop offset="100%" stopColor="rgba(0,255,65,0)" />
        </radialGradient>
        <radialGradient id="anya-skin" cx="50%" cy="38%" r="75%">
          <stop offset="0%" stopColor="#fdf2e1" />
          <stop offset="100%" stopColor="#eccdae" />
        </radialGradient>
      </defs>

      {/* aura */}
      <ellipse cx="70" cy="78" rx="52" ry="48" fill="url(#anya-aura)" />

      <g className={headClass}>
        {/* hair silhouette */}
        <ellipse cx="70" cy="74" rx="33" ry="31" fill={HAIR} stroke="rgba(0,255,65,0.35)" strokeWidth="1.5" />

        {/* neck + jacket */}
        <rect x="61" y="98" width="18" height="16" rx="3" fill={SKIN} />
        <path d="M30 140 q0 -24 22 -24 h36 q22 0 22 24 Z" fill="#0a120b" stroke="#13261a" strokeWidth="2" />
        <path d="M46 118 h48" stroke="rgba(0,255,65,0.55)" strokeWidth="1.6" />
        <path d="M52 140 q2 -20 18 -22 M88 140 q-2 -20 -18 -22" fill="none" stroke={PRIMARY} strokeWidth="3.5" strokeLinecap="round" opacity="0.85" />

        {/* face */}
        <ellipse cx="70" cy="78" rx="26" ry="24" fill="url(#anya-skin)" />

        {/* eyes */}
        <Eye x={57} y={78} emotion={emotion} gaze={mode === "listening" ? gaze : { x: 0, y: gaze.y }} surprisedScale={surprised ? 1.15 : 1} />
        <Eye x={83} y={78} emotion={emotion} gaze={mode === "listening" ? gaze : { x: 0, y: gaze.y }} surprisedScale={surprised ? 1.15 : 1} />

        {/* eyebrows */}
        {emotion === "angry" ? (
          <>
            <Eyebrow x={57} y={66} tilt={-1.4} />
            <Eyebrow x={83} y={66} tilt={1.4} />
          </>
        ) : emotion === "sad" ? (
          <>
            <Eyebrow x={57} y={66} tilt={1.4} />
            <Eyebrow x={83} y={66} tilt={-1.4} />
          </>
        ) : (
          <>
            <Eyebrow x={57} y={66} tilt={0.4} />
            <Eyebrow x={83} y={66} tilt={0.4} />
            {emotion === "think" && <Eyebrow x={57} y={64} tilt={2} length={11} />}
          </>
        )}

        {/* blush */}
        <ellipse cx="48" cy="86" rx="4" ry="2.4" fill="#ff8a8a" opacity="0.4" />
        <ellipse cx="92" cy="86" rx="4" ry="2.4" fill="#ff8a8a" opacity="0.4" />

        {/* mouth */}
        <Mouth emotion={emotion} mode={mode} />

        {/* thinking dots */}
        {mode === "thinking" && (
          <g className="anya-dots">
            <circle cx="62" cy="40" r="2.4" fill={PRIMARY} />
            <circle cx="70" cy="40" r="2.4" fill={PRIMARY} />
            <circle cx="78" cy="40" r="2.4" fill={PRIMARY} />
          </g>
        )}
      </g>
    </svg>
  );
}