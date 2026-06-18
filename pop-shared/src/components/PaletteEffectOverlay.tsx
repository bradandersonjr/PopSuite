import { useMemo } from "react";

/**
 * Palette-driven visual effect overlay for UI elements. Shared by PopJot's
 * radial menu buttons and PopKey's key badges so the glitter effect looks
 * identical across the suite.
 *
 * "glitter" → rapid shimmering dots (whites/silvers/color tints)
 *
 * When `tintColor` is provided, sparkle colors are derived from that hex.
 * Otherwise uses a generic fallback palette.
 *
 * By default the overlay is a square (`size`) with particles in a centered
 * disc — ideal for circular buttons. Pass `width`/`height` to fill a
 * rectangle (e.g. a pill-shaped badge); particles then spread edge to edge.
 *
 * Parent must have `position: relative` and `overflow: hidden`.
 */

type PaletteEffectOverlayProps = {
  palette: string;
  /** Reference size — controls particle radii (and count via `width`). */
  size: number;
  /** Render-box width (defaults to `size`). */
  width?: number;
  /** Render-box height (defaults to `size`). */
  height?: number;
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

const GLITTER_FALLBACK = [
  "#FFFFFF", "#F0F0FF", "#FFD700", "#C0C0FF",
  "#FF69B4", "#7FFFD4", "#E6CAFF", "#F4A0C0",
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
};

function generateParticles(
  boxW: number,
  boxH: number,
  rect: boolean,
  refSize: number,
  seed: string,
  colors: string[],
  count: number,
  minR: number,
  maxR: number,
): Particle[] {
  const rand = seededRand(seed);
  const particles: Particle[] = [];
  const center = boxW / 2;
  const maxDist = refSize * 0.42;

  for (let i = 0; i < count; i++) {
    let cx: number;
    let cy: number;
    if (rect) {
      // Spread edge to edge across the rectangle (pill-shaped badges).
      cx = rand() * boxW;
      cy = rand() * boxH;
    } else {
      // Centered disc — ideal for circular buttons.
      const angle = rand() * Math.PI * 2;
      const dist = Math.sqrt(rand()) * maxDist;
      cx = center + Math.cos(angle) * dist;
      cy = boxH / 2 + Math.sin(angle) * dist;
    }
    const r = minR + rand() * (maxR - minR);

    particles.push({
      cx,
      cy,
      r,
      color: colors[Math.floor(rand() * colors.length)],
      opacity: 0.6 + rand() * 0.4,
      delay: rand() * 2,
      duration: 0.8 + rand() * 1.5,
    });
  }
  return particles;
}

// ─── Component ──────────────────────────────────────────────────────

const PaletteEffectOverlay = ({ palette, size, width, height, seed = "btn", tintColor }: PaletteEffectOverlayProps) => {
  const isGlitter = palette === "glitter";

  const boxW = width ?? size;
  const boxH = height ?? size;
  const refSize = height ?? size;
  const rect = width !== undefined && height !== undefined;

  const particles = useMemo(() => {
    if (!isGlitter) return [];

    const colors = tintColor ? buildGlitterColors(tintColor) : GLITTER_FALLBACK;

    // Count scales with width (density), radii scale with the reference size.
    const count = Math.max(6, Math.round(boxW / 4));
    const minR = Math.max(1, refSize * 0.025);
    const maxR = Math.max(2.5, refSize * 0.07);

    return generateParticles(boxW, boxH, rect, refSize, `${seed}-${palette}`, colors, count, minR, maxR);
  }, [isGlitter, boxW, boxH, rect, refSize, seed, palette, tintColor]);

  if (particles.length === 0) return null;

  return (
    <svg
      width={boxW}
      height={boxH}
      viewBox={`0 0 ${boxW} ${boxH}`}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "visible",
      }}
      aria-hidden="true"
    >
      {particles.map((p, i) => (
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
      ))}
    </svg>
  );
};

export default PaletteEffectOverlay;
