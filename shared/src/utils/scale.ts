/**
 * Dynamic scaling utility for multi-resolution support.
 * Base reference: 1920x1080.
 */

const BASE_WIDTH = 1920;
const BASE_HEIGHT = 1080;

/**
 * Calculate scale factor based on screen resolution.
 * Uses geometric mean to account for both width and height changes.
 */
export function calculateScaleFactor(width: number, height: number): number {
  const widthRatio = width / BASE_WIDTH;
  const heightRatio = height / BASE_HEIGHT;

  // Geometric mean provides balanced scaling.
  const scale = Math.sqrt(widthRatio * heightRatio);

  // Clamp between 0.5x and 4x to prevent extreme scaling.
  return Math.max(0.5, Math.min(4, scale));
}

function sanitizeZoomFactor(zoomFactor: number | undefined): number {
  return Number.isFinite(zoomFactor) && (zoomFactor ?? 0) > 0 ? (zoomFactor as number) : 1;
}

/**
 * Get scale factor based on the full monitor resolution, not the page viewport.
 * Browsers expose screen size in CSS pixels. In extension content scripts,
 * devicePixelRatio also includes tab zoom, so divide that back out to keep the
 * result tied to monitor size rather than per-tab zoom.
 */
export function getMonitorScale(browserZoomFactor: number = 1): number {
  const screenWidth = window.screen?.width || window.innerWidth;
  const screenHeight = window.screen?.height || window.innerHeight;
  const rawDevicePixelRatio =
    Number.isFinite(window.devicePixelRatio) && window.devicePixelRatio > 0
      ? window.devicePixelRatio
      : 1;
  const zoomFactor = sanitizeZoomFactor(browserZoomFactor);
  const devicePixelRatio = rawDevicePixelRatio / zoomFactor;

  const width = Math.round(screenWidth * devicePixelRatio);
  const height = Math.round(screenHeight * devicePixelRatio);

  return calculateScaleFactor(width, height);
}

