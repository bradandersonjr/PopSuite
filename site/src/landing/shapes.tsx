import type { LucideIcon } from "lucide-react";

/**
 * Decorative floating-shape primitives for the landing sections. Migrated out
 * of the per-app WebRoots (which are being retired) so both apps' content files
 * can share one renderer. Per-app flavor (which colors, which icons) lives in
 * each app's content file; this module only knows how to draw a shape.
 */

export type BoxShape = {
  type: "box";
  className: string;
  color: string;
  gradientStops?: readonly string[];
};

export type IconShape = {
  type: "icon";
  icon: LucideIcon;
  className: string;
  color: string;
  size: number;
  gradientId?: string;
};

export type Shape = BoxShape | IconShape;

export const gradientCss = (stops: readonly string[]) =>
  `linear-gradient(135deg, ${stops.join(", ")})`;

export const renderShapes = (shapes: readonly Shape[], opacityClass = "opacity-30") =>
  shapes.map((shape, i) =>
    shape.type === "box" ? (
      <div
        key={`shape-${i}-${shape.className}`}
        className={`absolute z-0 neo-box hidden md:block ${opacityClass} ${shape.className}`}
        style={
          shape.gradientStops
            ? { backgroundImage: gradientCss(shape.gradientStops) }
            : { backgroundColor: shape.color }
        }
      />
    ) : (
      <shape.icon
        key={`shape-${i}-${shape.className}`}
        className={`absolute z-0 hidden md:block ${opacityClass} ${shape.className}`}
        size={shape.size}
        strokeWidth={2.5}
        color={shape.gradientId ? `url(#${shape.gradientId})` : shape.color}
      />
    )
  );

