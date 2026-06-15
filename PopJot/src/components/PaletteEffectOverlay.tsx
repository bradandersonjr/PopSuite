import { useMemo } from "react";
import type { ColorPalette } from "@/store/useStore";

/**
 * Palette-driven visual effect overlay for UI elements.
 *
 * "glitter"  → rapid shimmering dots (whites/silvers/color tints)
 * "magical"  → slow-spinning 4-point stars with soft glow (whites → deep tints)
 *
 * When `tintColor` is provided, sparkle colors are derived from that hex
 * (matching the Canvas stroke effects). Otherwise uses generic palettes.
 *
 * Parent must have `position: relative` and `overflow: hidden`.
 */

type PaletteEffectOverlayProps = {
  palette: ColorPalette;
  /** Reference size — controls particle count & radii */
  size: number;
  /** Unique key to seed deterministic random positions */
  seed?: string;
  /** Base hex color to tint sparkles (e.g. chip color) */
  tintColor?: string;
};

// ─── Seeded PRNG ────────────────────────────────────────────────────

function seededRand(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    h = Math.imul(h ^ (h >>> 13), 0x45d9f3b);
    h ^= h >>> 16;
    return (h >>> 0) / 0xffffffff;
  };
}

// ─── Color derivation (matches Canvas.tsx approach) ─────────────────

function hexTint(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const toHex = (n: number) => Math.round(Math.min(255, n)).toString(16).padStart(2, "0");
  return `#${toHex(r + (255 - r) * factor)}${toHex(g + (255 - g) * factor)}${toHex(b + (255 - b) * factor)}`;
}

/** Whites + silvers + progressive tints of the base color */
function buildGlitterColors(baseHex: string): string[] {
  return [
    "#FFFFFF",
    "#E8E8F0",
    "#D0D0E8",
    hexTint(baseHex, 0.85),
    hexTint(baseHex, 0.65),
    hexTint(baseHex, 0.45),
    baseHex,
  ];
}

/** Whites (dominant) + progressive tints toward the base color */
function buildMagicalColors(baseHex: string): string[] {
  return [
    "#FFFFFF", "#FFFFFF",
    hexTint(baseHex, 0.9),
    hexTint(baseHex, 0.7),
    hexTint(baseHex, 0.45),
    hexTint(baseHex, 0.2),
    baseHex,
  ];
}

// ─── Fallback palettes (when no tintColor) ──────────────────────────

const GLITTER_FALLBACK = [
  "#FFFFFF", "#F0F0FF", "#FFD700", "#C0C0FF",
  "#FF69B4", "#7FFFD4", "#E6CAFF", "#F4A0C0",
];

const MAGICAL_FALLBACK = [
  "#FFD700", "#FFB830", "#FFFFFF", "#E8D5FF",
  "#7B2FBE", "#00C9A7", "#FF6B9D", "#FFF8E1",
];

// ─── Particle types ─────────────────────────────────────────────────

type Particle = {
  cx: number;
  cy: number;
  r: number;
  color: string;
  opacity: number;
  delay: number;
  duration: number;
  rotation: number;
  isStar: boolean;   // magical: 30% are sharp 4-point stars
  armLen: number;     // cross arm length for stars
};

function generateParticles(
  size: number,
  seed: string,
  colors: string[],
  count: number,
  minR: number,
  maxR: number,
  magical: boolean,
): Particle[] {
  const rand = seededRand(seed);
  const particles: Particle[] = [];
  const center = size / 2;
  const maxDist = size * 0.42;

  for (let i = 0; i < count; i++) {
    const angle = rand() * Math.PI * 2;
    const dist = Math.sqrt(rand()) * maxDist;
    const cx = center + Math.cos(angle) * dist;
    const cy = center + Math.sin(angle) * dist;
    const isStar = magical && rand() < 0.3;
    const r = isStar
      ? (minR * 0.8 + rand() * maxR * 0.6)
      : (minR + rand() * (maxR - minR));

    particles.push({
      cx,
      cy,
      r,
      color: colors[Math.floor(rand() * colors.length)],
      opacity: magical ? 0.5 + rand() * 0.5 : 0.6 + rand() * 0.4,
      delay: rand() * (magical ? 3 : 2),
      duration: magical ? 2 + rand() * 3 : 0.8 + rand() * 1.5,
      rotation: rand() * 360,
      isStar,
      armLen: r * (0.8 + rand() * 0.8),
    });
  }
  return particles;
}

/** SVG path for a 4-point star centered at origin */
const star4 = (r: number): string => {
  const inner = r * 0.3;
  const pts: string[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 - Math.PI / 2;
    const rad = i % 2 === 0 ? r : inner;
    pts.push(`${Math.cos(a) * rad},${Math.sin(a) * rad}`);
  }
  return `M${pts.join("L")}Z`;
};

// ─── Component ──────────────────────────────────────────────────────

const PaletteEffectOverlay = ({ palette, size, seed = "btn", tintColor }: PaletteEffectOverlayProps) => {
  const isGlitter = palette === "glitter";
  const isMagical = palette === "magical";

  const particles = useMemo(() => {
    if (!isGlitter && !isMagical) return [];

    const colors = tintColor
      ? (isGlitter ? buildGlitterColors(tintColor) : buildMagicalColors(tintColor))
      : (isGlitter ? GLITTER_FALLBACK : MAGICAL_FALLBACK);

    const count = isMagical
      ? Math.max(4, Math.round(size / 8))
      : Math.max(6, Math.round(size / 4));
    const minR = isMagical
      ? Math.max(1.5, size * 0.04)
      : Math.max(1, size * 0.025);
    const maxR = isMagical
      ? Math.max(4, size * 0.12)
      : Math.max(2.5, size * 0.07);

    return generateParticles(size, `${seed}-${palette}`, colors, count, minR, maxR, isMagical);
  }, [isGlitter, isMagical, size, seed, palette, tintColor]);

  if (particles.length === 0) return null;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "visible",
      }}
      aria-hidden="true"
    >
      <defs>
        {isMagical && (
          <filter id={`magical-glow-${seed}`} x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        )}
      </defs>

      {particles.map((p, i) =>
        isMagical ? (
          p.isStar ? (
            /* ── Magical star: sharp 4-pointed cross (matches Canvas) ── */
            <g key={i} opacity={0}>
              <line
                x1={p.cx - p.armLen} y1={p.cy}
                x2={p.cx + p.armLen} y2={p.cy}
                stroke={p.color} strokeWidth={p.r * 0.35} strokeLinecap="round"
              />
              <line
                x1={p.cx} y1={p.cy - p.armLen}
                x2={p.cx} y2={p.cy + p.armLen}
                stroke={p.color} strokeWidth={p.r * 0.35} strokeLinecap="round"
              />
              <animate
                attributeName="opacity"
                values={`0;${p.opacity};${p.opacity * 0.5};${p.opacity};0`}
                dur={`${p.duration}s`}
                begin={`${p.delay}s`}
                repeatCount="indefinite"
              />
            </g>
          ) : (
            /* ── Magical dust: spinning star shape with glow ── */
            <g key={i} filter={`url(#magical-glow-${seed})`} opacity={0}>
              <path
                d={star4(p.r)}
                fill={p.color}
                transform={`translate(${p.cx},${p.cy}) rotate(${p.rotation})`}
              >
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from={`${p.rotation} 0 0`}
                  to={`${p.rotation + 360} 0 0`}
                  dur={`${p.duration * 2}s`}
                  begin={`${p.delay}s`}
                  repeatCount="indefinite"
                  additive="sum"
                />
              </path>
              <animate
                attributeName="opacity"
                values={`0;${p.opacity};${p.opacity * 0.6};${p.opacity};0`}
                dur={`${p.duration}s`}
                begin={`${p.delay}s`}
                repeatCount="indefinite"
              />
            </g>
          )
        ) : (
          /* ── Glitter: shimmering circles ── */
          <circle
            key={i}
            cx={p.cx}
            cy={p.cy}
            r={p.r}
            fill={p.color}
            opacity={0}
          >
            <animate
              attributeName="opacity"
              values={`0;${p.opacity};0`}
              dur={`${p.duration}s`}
              begin={`${p.delay}s`}
              repeatCount="indefinite"
            />
            <animate
              attributeName="r"
              values={`${p.r * 0.5};${p.r};${p.r * 0.5}`}
              dur={`${p.duration}s`}
              begin={`${p.delay}s`}
              repeatCount="indefinite"
            />
          </circle>
        )
      )}
    </svg>
  );
};

export default PaletteEffectOverlay;
