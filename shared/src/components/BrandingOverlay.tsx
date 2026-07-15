/**
 * Pro branding overlay — a small logo/image pinned to a screen corner for
 * screencasts. Presentational and app-agnostic; each app supplies its store
 * values via a thin wrapper.
 *
 * If `blockedCorner` matches the chosen corner (e.g. the corner where PopKey's
 * keystroke badges live), the logo is flipped to the opposite horizontal side
 * so the two never overlap.
 */

export type BrandingCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export function BrandingOverlay({
  image,
  corner,
  size,
  opacity,
  radius = 0,
  scaleFactor,
  blockedCorner,
  grayscale = false,
  offsetX = 0,
  offsetY = 0,
}: {
  image: string;
  corner: BrandingCorner;
  size: number;
  opacity: number;
  /** Corner rounding, 0–50% of the image (50 = circle for a square image). */
  radius?: number;
  scaleFactor: number;
  blockedCorner?: BrandingCorner | null;
  /** Render the logo black & white. */
  grayscale?: boolean;
  /** Fine-tune away from the corner anchor, in px: +X right, +Y down — same
   *  convention as the badges' positionOffsetX/Y, regardless of which corner. */
  offsetX?: number;
  offsetY?: number;
}) {
  if (!image) return null;

  let c = corner;
  if (blockedCorner && blockedCorner === c) {
    c = (c.endsWith("left") ? c.replace("left", "right") : c.replace("right", "left")) as BrandingCorner;
  }

  const inset = Math.round(24 * scaleFactor);
  const max = Math.round(size * scaleFactor);
  const isTop = c.startsWith("top");
  const isLeft = c.endsWith("left");

  return (
    <img
      src={image}
      alt=""
      draggable={false}
      style={{
        position: "fixed",
        zIndex: 99998,
        pointerEvents: "none",
        userSelect: "none",
        ...(isTop ? { top: inset + offsetY } : { bottom: inset - offsetY }),
        ...(isLeft ? { left: inset + offsetX } : { right: inset - offsetX }),
        maxWidth: max,
        maxHeight: max,
        width: "auto",
        height: "auto",
        opacity: opacity / 100,
        objectFit: "contain",
        borderRadius: `${radius}%`,
        filter: grayscale ? "grayscale(1)" : undefined,
      }}
    />
  );
}
