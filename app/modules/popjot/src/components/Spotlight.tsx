import { useEffect, useRef } from "react";
import { useStore } from "@/store/useStore";
import { onSpotlightCursor } from "@/lib/platform";
import { spotlightGradient } from "@/lib/spotlight";

/**
 * Spotlight presenter overlay — a full-screen dim layer with a soft transparent
 * circle that follows the cursor. Rendered only while spotlight mode is active
 * (EngineShell gates on store.spotlightActive).
 *
 * The overlay stays click-through: main streams the OS cursor over IPC
 * ("spotlight-cursor") because the window ignores mouse events and never sees a
 * DOM mousemove. We paint by writing the layer's `background` directly inside a
 * rAF loop — no setState per frame, so React never re-renders on cursor motion.
 * Only the dim opacity / radius / feather settings (which change rarely) flow
 * through the store and trigger a re-render.
 */
const Spotlight = () => {
  const dimOpacity = useStore((s) => s.spotlightDimOpacity);
  const radius = useStore((s) => s.spotlightRadius);
  const feather = useStore((s) => s.spotlightFeather);

  const layerRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef({ x: 0, y: 0 });
  // Latest visual settings, read inside the rAF loop so it never restarts on a
  // slider change (the loop always paints with the newest values).
  const settingsRef = useRef({ dimOpacity, radius, feather });
  settingsRef.current = { dimOpacity, radius, feather };

  // Paint loop: one rAF, updating the gradient from the cursor ref each frame.
  useEffect(() => {
    let raf = 0;
    const paint = () => {
      const layer = layerRef.current;
      if (layer) {
        const { x, y } = cursorRef.current;
        const s = settingsRef.current;
        layer.style.background = spotlightGradient(
          x,
          y,
          s.radius,
          s.dimOpacity,
          s.feather,
          window.innerHeight,
        );
      }
      raf = requestAnimationFrame(paint);
    };
    raf = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Cursor stream from main (window is click-through, so no DOM mousemove).
  // Escape-to-exit is handled in main via a temporary global shortcut (the
  // click-through overlay is never focused, so the renderer can't see keys).
  useEffect(() => {
    return onSpotlightCursor((pos) => {
      cursorRef.current = pos;
    });
  }, []);

  return (
    <div
      ref={layerRef}
      className="fixed inset-0 z-[99997] pointer-events-none select-none"
      style={{
        background: spotlightGradient(
          cursorRef.current.x,
          cursorRef.current.y,
          radius,
          dimOpacity,
          feather,
          window.innerHeight,
        ),
      }}
    />
  );
};

export default Spotlight;
