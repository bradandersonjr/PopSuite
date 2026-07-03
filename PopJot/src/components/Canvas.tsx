import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { getStroke } from "perfect-freehand";
import { useStore } from "@/store/useStore";
import {
    ALL_DRAW_PALETTES,
    ALL_HL_PALETTES,
    DRAW_COLORS_GRADIENT,
    getGradientVariantStops,
    getHighlighterGradientStops,
} from "@/config/themes";
import { getEffectiveColors, getProPalette, getProEffect } from "@/pro";
import { CANVAS_BG } from "@shared/config/desktopTheme";

// ─── Types ───────────────────────────────────────────────────────────

export type { StrokeType } from "@/store/useStore";
import type { StrokeType } from "@/store/useStore";

export type Stroke = {
    id: string;
    points: { x: number; y: number; pressure?: number }[];
    color: string;
    size: number;
    type: StrokeType;
    straight?: boolean;
    pointerType?: string;
};

type Point = { x: number; y: number; pressure?: number };
type DrawingState = "idle" | "freehand" | "straight-preview";

// ─── Constants ───────────────────────────────────────────────────────

const BASE_TOOL_SIZES: Record<StrokeType, number> = {
    marker: 12,
    pen: 2,
    highlighter: 32,
    eraser: 40,
};

const getToolSize = (tool: StrokeType, scale: number = 1, sizeMultiplier: number = 1) =>
    BASE_TOOL_SIZES[tool] * scale * sizeMultiplier;

// ─── SVG Helpers ─────────────────────────────────────────────────────

function getSvgPathFromStroke(points: number[][]) {
    if (!points.length) return "";

    const d = points.reduce(
        (acc, [x0, y0], i, arr) => {
            const [x1, y1] = arr[(i + 1) % arr.length];
            acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
            return acc;
        },
        ["M", ...points[0], "Q"] as (string | number)[]
    );

    d.push("Z");
    return d.join(" ");
}

function getStrokeOpacity(type: StrokeType, isMask: boolean, glitter: boolean = false) {
    if (isMask) return 1;
    if (type === "highlighter") return 0.4;
    return glitter ? 0.8 : 1;
}

// ─── Shared Helpers ─────────────────────────────────────────────────

/** Simple seeded PRNG for deterministic sparkle placement */
function seededRandom(seed: number) {
    let s = seed;
    return () => {
        s = (s * 16807 + 0) % 2147483647;
        return (s - 1) / 2147483646;
    };
}

/** Hash a string to a seed number */
function hashSeed(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    return Math.abs(hash) || 1;
}

/** Lighten a hex color toward white by a factor (0–1) */
// ─── Glitter Effect ─────────────────────────────────────────────────
// Glitter = semi-transparent stroke + glow aura + sparkle specs inside stroke body

type GlitterSpec = { x: number; y: number; r: number; color: string; opacity: number };

/** Build a glitter palette from a base hex color: whites, silvers, and tinted variants */
function buildGlitterColors(baseHex: string): string[] {
    // Parse base hex to RGB
    const r = parseInt(baseHex.slice(1, 3), 16);
    const g = parseInt(baseHex.slice(3, 5), 16);
    const b = parseInt(baseHex.slice(5, 7), 16);
    const toHex = (n: number) => Math.round(Math.min(255, n)).toString(16).padStart(2, "0");
    // Blend toward white at different amounts
    const tint = (factor: number) =>
        `#${toHex(r + (255 - r) * factor)}${toHex(g + (255 - g) * factor)}${toHex(b + (255 - b) * factor)}`;
    return [
        "#FFFFFF",           // pure white sparkle
        "#E8E8F0",           // cool silver
        "#D0D0E8",           // blue-silver
        tint(0.85),          // very light tint of color
        tint(0.65),          // light tint
        tint(0.45),          // medium tint
        baseHex,             // the color itself
    ];
}

function generateGlitterSpecs(strokeId: string, points: { x: number; y: number }[], strokeSize: number, baseColor: string): GlitterSpec[] {
    if (points.length < 2) return [];
    const rand = seededRandom(hashSeed(strokeId));
    const specs: GlitterSpec[] = [];
    const halfSize = strokeSize / 2;
    const glitterColors = buildGlitterColors(baseColor);

    for (let i = 1; i < points.length; i++) {
        const dx = points[i].x - points[i - 1].x;
        const dy = points[i].y - points[i - 1].y;
        const segLen = Math.sqrt(dx * dx + dy * dy);
        const nx = segLen > 0 ? -dy / segLen : 0;
        const ny = segLen > 0 ? dx / segLen : 0;
        // Density: 1 spec per ~3px, capped so fast long segments don't over-populate
        const count = Math.min(Math.ceil(segLen / 3), 4);
        // Scatter: tighter for fast strokes, never more than 45% of half-stroke-width
        const scatter = halfSize * 0.45 * Math.min(1, 6 / Math.max(segLen, 1));

        for (let j = 0; j < count; j++) {
            const t = rand();
            const px = points[i - 1].x + dx * t;
            const py = points[i - 1].y + dy * t;
            const offset = (rand() - 0.5) * 2 * scatter;
            specs.push({
                x: px + nx * offset,
                y: py + ny * offset,
                r: 0.4 + rand() * 1.2,
                color: glitterColors[Math.floor(rand() * glitterColors.length)],
                opacity: 0.3 + rand() * 0.55,
            });
        }
    }
    return specs;
}

function renderGlitterSpecs(specs: GlitterSpec[], strokeId: string) {
    return specs.map((s, i) => (
        <circle
            key={`gp-${strokeId}-${i}`}
            cx={s.x} cy={s.y} r={s.r}
            fill={s.color}
            opacity={s.opacity}
        />
    ));
}

function getStraightLineWidth(stroke: Stroke) {
    return stroke.size;
}

function getStrokeGradientId(stroke: Stroke) {
    return `stroke-gradient-${stroke.id}`;
}

function getGradientVariantIndexForColor(color: string) {
    const idx = DRAW_COLORS_GRADIENT.indexOf(color as typeof DRAW_COLORS_GRADIENT[number]);
    return idx >= 0 ? idx : 0;
}

/** Compute the gradient line spanning the stroke's bounding box along its longest axis.
 *  The gradient direction matches the drawing direction: color stop 0% starts
 *  at the end of the bounding box closest to the first point drawn. */
function getStrokeGradientLine(stroke: Stroke) {
    if (stroke.points.length === 0) return null;

    const first = stroke.points[0];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of stroke.points) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
    }

    const dx = maxX - minX;
    const dy = maxY - minY;

    if (dx < 0.01 && dy < 0.01) {
        return { x1: minX, y1: minY, x2: minX + Math.max(stroke.size, 1), y2: minY };
    }

    if (dx >= dy) {
        const midY = (minY + maxY) / 2;
        // Flip so gradient starts near the first point
        const startLeft = first.x - minX <= maxX - first.x;
        return startLeft
            ? { x1: minX, y1: midY, x2: maxX, y2: midY }
            : { x1: maxX, y1: midY, x2: minX, y2: midY };
    } else {
        const midX = (minX + maxX) / 2;
        const startTop = first.y - minY <= maxY - first.y;
        return startTop
            ? { x1: midX, y1: minY, x2: midX, y2: maxY }
            : { x1: midX, y1: maxY, x2: midX, y2: minY };
    }
}

function renderStrokeGradientDef(stroke: Stroke, remappedColor?: string) {
    const line = getStrokeGradientLine(stroke);
    if (!line) return null;
    const resolvedColor = remappedColor ?? stroke.color;
    const stops = stroke.type === "highlighter"
        ? getHighlighterGradientStops(resolvedColor)
        : getGradientVariantStops(getGradientVariantIndexForColor(resolvedColor));

    return (
        <linearGradient
            key={`gradient-def-${stroke.id}`}
            id={getStrokeGradientId(stroke)}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            gradientUnits="userSpaceOnUse"
        >
            {stops.map((stopColor, index) => (
                <stop
                    key={`gradient-stop-${stroke.id}-${index}`}
                    offset={`${(index / Math.max(1, stops.length - 1)) * 100}%`}
                    stopColor={stopColor}
                />
            ))}
        </linearGradient>
    );
}

function renderGridPattern(isDark: boolean, size: "small" | "large", scale: number) {
    const baseSize = size === "small" ? 20 : 40;
    const gridSize = baseSize * scale;
    const strokeWidth = Math.max(1, scale);
    const lineColor = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)";
    return (
        <defs>
            <pattern id="grid" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
                <path d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`} fill="none" stroke={lineColor} strokeWidth={strokeWidth} />
            </pattern>
        </defs>
    );
}

function renderDotsPattern(isDark: boolean, size: "small" | "large", scale: number) {
    const baseSize = size === "small" ? 20 : 40;
    const dotSize = baseSize * scale;
    const dotColor = isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.08)";
    const baseRadius = size === "small" ? 1 : 1.5;
    const radius = baseRadius * scale;
    return (
        <defs>
            <pattern id="dots" width={dotSize} height={dotSize} patternUnits="userSpaceOnUse">
                <circle cx={dotSize / 2} cy={dotSize / 2} r={radius} fill={dotColor} />
            </pattern>
        </defs>
    );
}

// ─── Stroke Rendering ───────────────────────────────────────────────

type PaletteEffect = "none" | "glitter";

/** Shared effect state derived from palette effect + stroke type */
function getEffectState(effect: PaletteEffect, stroke: Stroke) {
    const hasEffect = effect !== "none" && stroke.type !== "eraser";
    const hasGlow = hasEffect && effect === "glitter";
    const glitterParticles = hasEffect && effect === "glitter"
        ? generateGlitterSpecs(stroke.id, stroke.points, stroke.size, stroke.color) : null;
    return { hasEffect, hasGlow, glitterParticles };
}

/** Build getStroke options for a stroke. */
function buildStrokeOptions(stroke: Stroke, sizeOverride?: number) {
    const isFlat = stroke.type === "pen" || stroke.type === "eraser";
    const isStylus = stroke.pointerType === "pen" || stroke.pointerType === "touch";
    const streamline = stroke.type === "pen" ? 0.85 : 0.5;
    const smoothing = stroke.type === "pen" ? 0.3 : 0.5;
    return {
        size: sizeOverride ?? stroke.size,
        thinning: isFlat ? 0 : 0.6,
        smoothing,
        streamline,
        simulatePressure: isFlat ? false : !isStylus,
        easing: (t: number) => t,
        start: { taper: 0, cap: isFlat || stroke.type === "marker" },
        end: { taper: stroke.type === "marker" ? 10 : 0, cap: isFlat || stroke.type === "marker" },
    };
}

function renderStraightStroke(stroke: Stroke, fillColor: string, opacity: number, effect: PaletteEffect = "none") {
    const [p1, p2] = stroke.points;
    const { hasGlow, glitterParticles } = getEffectState(effect, stroke);
    const lineWidth = getStraightLineWidth(stroke);
    const lineCap = stroke.type === "highlighter" ? "butt" as const : "round" as const;

    return (
        <g key={`stroke-${stroke.id}`}>
            {hasGlow && (
                <line key={`aura-${stroke.id}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                    stroke={fillColor} strokeWidth={lineWidth * 4} strokeLinecap={lineCap}
                    opacity={opacity * 0.3} filter="url(#palette-glow)" />
            )}
            <line key={`line-${stroke.id}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                stroke={fillColor} strokeWidth={lineWidth} strokeLinecap={lineCap}
                opacity={opacity} />
            {glitterParticles && renderGlitterSpecs(glitterParticles, stroke.id)}
        </g>
    );
}

function renderFreehandStroke(stroke: Stroke, fillColor: string, opacity: number, effect: PaletteEffect = "none") {
    const pts = stroke.points.map((p) => [p.x, p.y, p.pressure || 0.5]);

    // For marker single-clicks, render as a simple circle
    if (stroke.type === "marker" && pts.length === 1) {
        const [x, y] = pts[0];
        return (
            <circle
                key={`dot-${stroke.id}`}
                cx={x}
                cy={y}
                r={stroke.size / 2}
                fill={fillColor}
                opacity={opacity}
            />
        );
    }

    const outlinePoints = getStroke(pts, buildStrokeOptions(stroke));
    const { hasGlow, glitterParticles } = getEffectState(effect, stroke);
    const pathD = getSvgPathFromStroke(outlinePoints);

    return (
        <g key={`stroke-${stroke.id}`}>
            {hasGlow && (
                <path
                    key={`aura-${stroke.id}`}
                    d={pathD}
                    fill={fillColor}
                    opacity={opacity * 0.3}
                    filter="url(#palette-glow)"
                />
            )}
            <path
                key={`path-${stroke.id}`}
                d={pathD}
                fill={fillColor}
                opacity={opacity}
            />
            {glitterParticles && renderGlitterSpecs(glitterParticles, stroke.id)}
        </g>
    );
}

function renderStroke(stroke: Stroke, overrideColor?: string, colorRemap?: Map<string, string>, gradientPaletteActive: boolean = false, paletteEffect: PaletteEffect = "none") {
    const isMask = overrideColor === "black" || overrideColor === "#000";
    const remapped = colorRemap?.get(stroke.color) ?? stroke.color;
    const usesGradientInk = gradientPaletteActive && !isMask && (stroke.type === "marker" || stroke.type === "pen" || stroke.type === "highlighter");
    const fillColor = usesGradientInk ? `url(#${getStrokeGradientId(stroke)})` : (overrideColor || remapped);
    const effect = isMask ? "none" as const : paletteEffect;
    const opacity = getStrokeOpacity(stroke.type, isMask, effect === "glitter");

    return stroke.straight
        ? renderStraightStroke(stroke, fillColor, opacity, effect)
        : renderFreehandStroke(stroke, fillColor, opacity, effect);
}

// ─── State Machine ──────────────────────────────────────────────────

interface DrawingMachine {
    state: DrawingState;
    startPoint: Point | null;
    straightStroke: Stroke | null;
    prevButtons: number;
    pointerId: number | null;
    totalDistance: number;
    pointerType: string;
}

const IDLE_MACHINE: DrawingMachine = {
    state: "idle",
    startPoint: null,
    straightStroke: null,
    prevButtons: 0,
    pointerId: null,
    totalDistance: 0,
    pointerType: "mouse",
};

// ─── Component ──────────────────────────────────────────────────────

interface CanvasProps {
    tool: StrokeType | null;
    color: string;
}

const Canvas = ({ tool, color }: CanvasProps) => {
    const [strokes, setStrokes] = useState<Stroke[]>([]);
    const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
    const [previewStroke, setPreviewStroke] = useState<Stroke | null>(null);
    const [cursorPos, setCursorPos] = useState<Point | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const machineRef = useRef<DrawingMachine>({ ...IDLE_MACHINE });
    // Mirror of currentStroke readable by event handlers without nesting setState calls
    const currentStrokeRef = useRef<Stroke | null>(null);

    const svgRef = useRef<SVGSVGElement>(null);
    // Raster cache: completed strokes are baked into a bitmap to keep SVG DOM small
    const rasterCanvasRef = useRef<HTMLCanvasElement>(null);
    const pendingRasterRef = useRef(false);
    // Counter to trigger React re-renders when the raster canvas changes
    const [rasterVersion, setRasterVersion] = useState(0);
    type UndoSnapshot =
        | { kind: "bitmap"; value: ImageBitmap }
        | { kind: "imageData"; value: ImageData };
    // Undo history: snapshots of the raster canvas before each mutating action
    const undoStackRef = useRef<UndoSnapshot[]>([]);
    const MAX_UNDO = 50;

    // Stable refs for values used in event handlers — avoids listener re-attachment
    const toolRef = useRef(tool);
    const colorRef = useRef(color);
    toolRef.current = tool;
    colorRef.current = color;

    const clearCanvas = useStore((state) => state.clearCanvas);
    const background = useStore((state) => state.background);
    const setIsDrawing = useStore((state) => state.setIsDrawing);
    const colorPalette = useStore((state) => state.colorPalette);
    const gridMode = useStore((state) => state.gridMode);
    const gridSize = useStore((state) => state.gridSize);
    const scaleFactor = useStore((state) => state.scaleFactor);
    const pageZoomFactor = useStore((state) => state.pageZoomFactor);
    const toolSizeMultiplier = useStore((state) => state.toolSizeMultiplier);
    const adjustToolSize = useStore((state) => state.adjustToolSize);
    const paletteVersion = useStore((state) => state.paletteVersion);

    const scaleRef = useRef(scaleFactor);
    const sizeMultRef = useRef(toolSizeMultiplier);
    scaleRef.current = scaleFactor;
    sizeMultRef.current = toolSizeMultiplier;

    /** Map colors from all palettes → current palette */
    const colorRemap = useMemo(() => {
        const map = new Map<string, string>();
        const { draw: targetDraw, highlighter: targetHL } = getEffectiveColors(colorPalette);

        ALL_DRAW_PALETTES.forEach(palette => {
            for (let i = 0; i < palette.length; i++) {
                if (palette[i] !== targetDraw[i]) {
                    map.set(palette[i], targetDraw[i]);
                }
            }
        });

        ALL_HL_PALETTES.forEach(palette => {
            for (let i = 0; i < palette.length; i++) {
                if (palette[i] !== targetHL[i]) {
                    map.set(palette[i], targetHL[i]);
                }
            }
        });

        return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [colorPalette, paletteVersion]); // paletteVersion invalidates when Pro palette changes

    // When Pro palette is active, use the Pro-chosen effect instead of the built-in palette's effect
    const proOverrideActive = getProPalette(colorPalette) !== null;
    const proEffect = proOverrideActive ? getProEffect() : null;
    const useGradient = proOverrideActive ? proEffect === "gradient" : colorPalette === "gradient";
    const paletteEffect: PaletteEffect = proOverrideActive
        ? (proEffect === "glitter" ? "glitter" : "none")
        : (colorPalette === "glitter" ? "glitter" : "none");

    const resetToIdle = useCallback(() => {
        machineRef.current = { ...IDLE_MACHINE };
        setIsDrawing(false);
    }, [setIsDrawing]);

    // Ensure raster canvas is sized correctly
    const ensureRasterCanvas = useCallback(() => {
        const rc = rasterCanvasRef.current;
        if (!rc) return;
        const dpr = window.devicePixelRatio || 1;
        const w = Math.floor(window.innerWidth * dpr);
        const h = Math.floor(window.innerHeight * dpr);
        if (rc.width !== w || rc.height !== h) {
            rc.width = w;
            rc.height = h;
        }
    }, []);

    const pushUndoSnapshot = useCallback(async () => {
        const rc = rasterCanvasRef.current;
        if (!rc) return;
        const ctx = rc.getContext("2d");
        if (!ctx) return;

        try {
            // Prefer bitmap snapshots to avoid large synchronous ImageData allocations.
            const bmp = await createImageBitmap(rc);
            undoStackRef.current.push({ kind: "bitmap", value: bmp });
        } catch {
            try {
                const snapshot = ctx.getImageData(0, 0, rc.width, rc.height);
                undoStackRef.current.push({ kind: "imageData", value: snapshot });
            } catch {
                return;
            }
        }

        while (undoStackRef.current.length > MAX_UNDO) {
            const removed = undoStackRef.current.shift();
            if (removed?.kind === "bitmap") removed.value.close();
        }
    }, []);

    const restoreUndoSnapshot = useCallback(() => {
        const rc = rasterCanvasRef.current;
        if (!rc) return false;
        const snapshot = undoStackRef.current.pop();
        if (!snapshot) return false;

        const ctx = rc.getContext("2d");
        if (!ctx) return false;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, rc.width, rc.height);

        if (snapshot.kind === "imageData") {
            ctx.putImageData(snapshot.value, 0, 0);
        } else {
            ctx.drawImage(snapshot.value, 0, 0, rc.width, rc.height);
            snapshot.value.close();
        }
        return true;
    }, []);

    // Size raster canvas on mount
    useEffect(() => { ensureRasterCanvas(); }, [ensureRasterCanvas]);

    // Undo via middle-click — must listen on document in capture phase
    // because the browser consumes middle-click for auto-scroll before
    // it reaches element-level pointerdown/mousedown listeners.
    useEffect(() => {
        const onMiddleClick = (e: MouseEvent) => {
            if (e.button !== 1) return;
            e.preventDefault();
            e.stopPropagation();
            if (restoreUndoSnapshot()) {
                setRasterVersion(v => v + 1);
            }
            setStrokes([]);
            currentStrokeRef.current = null;
            setCurrentStroke(null);
            setPreviewStroke(null);
            machineRef.current.straightStroke = null;
            resetToIdle();
        };
        document.addEventListener("mousedown", onMiddleClick, true);
        return () => document.removeEventListener("mousedown", onMiddleClick, true);
    }, [resetToIdle, restoreUndoSnapshot]);

    // Clear canvas when trigger is activated
    useEffect(() => {
        setStrokes([]);
        currentStrokeRef.current = null;
        setCurrentStroke(null);
        setPreviewStroke(null);
        resetToIdle();
        // Clear raster cache
        pendingRasterRef.current = false;
        const rc = rasterCanvasRef.current;
        if (rc) {
            const ctx = rc.getContext("2d");
            if (ctx) ctx.clearRect(0, 0, rc.width, rc.height);
            setRasterVersion(v => v + 1);
        }
        for (const entry of undoStackRef.current) {
            if (entry.kind === "bitmap") entry.value.close();
        }
        undoStackRef.current = [];
    }, [clearCanvas, resetToIdle]);

    // ─── Rasterize completed strokes ────────────────────────────────
    // After pointer-up, the stroke is committed to `strokes` and `currentStroke`
    // becomes null. We wait one frame so React renders the full-effects SVG,
    // then snapshot it onto the raster canvas and clear `strokes`.
    // Erasers bypass this entirely — they draw directly on the raster canvas
    // in the pointer event handlers using destination-out compositing.
    useEffect(() => {
        if (strokes.length === 0 || currentStroke !== null || pendingRasterRef.current) return;
        // Skip if only eraser strokes (they're already handled in real-time)
        if (strokes.every(s => s.type === "eraser")) {
            setStrokes([]);
            return;
        }
        pendingRasterRef.current = true;
        const strokeIdsToRasterize = new Set(strokes.map(s => s.id));

        // Wait for the browser to paint the SVG with full effects
        requestAnimationFrame(() => {
            const svgEl = svgRef.current;
            const rc = rasterCanvasRef.current;
            if (!svgEl || !rc) { pendingRasterRef.current = false; return; }

            ensureRasterCanvas();
            const dpr = window.devicePixelRatio || 1;
            const canvasW = rc.width;
            const canvasH = rc.height;

            // Clone the live SVG, strip non-stroke content
            const clone = svgEl.cloneNode(true) as SVGSVGElement;
            clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
            // Render SVG at full device-pixel resolution so blur/glow filters
            // are computed at native DPI — prevents dimming on HiDPI screens.
            clone.setAttribute("width", String(canvasW));
            clone.setAttribute("height", String(canvasH));
            clone.setAttribute("viewBox", `0 0 ${canvasW} ${canvasH}`);
            // Remove any stray rects or foreignObjects that aren't stroke content
            clone.querySelectorAll(":scope > rect, :scope > foreignObject").forEach(r => r.remove());

            // Create a wrapper group to scale all logical coordinates to physical pixels
            const gWrapper = clone.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "g");
            gWrapper.setAttribute("transform", `scale(${dpr})`);

            // Move all non-defs children into the wrapper group
            const children = Array.from(clone.childNodes);
            children.forEach(child => {
                if (child.nodeName.toLowerCase() !== "defs") {
                    gWrapper.appendChild(child);
                }
            });
            clone.appendChild(gWrapper);

            const svgStr = new XMLSerializer().serializeToString(clone);
            const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const img = new Image();
            img.onload = () => {
                const ctx = rc.getContext("2d");
                if (!ctx) {
                    URL.revokeObjectURL(url);
                    pendingRasterRef.current = false;
                    return;
                }

                void pushUndoSnapshot().finally(() => {
                    // SVG was rendered at dpr-scaled size, draw 1:1 onto the
                    // dpr-scaled canvas — no additional transform needed.
                    ctx.setTransform(1, 0, 0, 1, 0, 0);
                    ctx.globalCompositeOperation = "source-over";
                    ctx.imageSmoothingEnabled = true;
                    ctx.drawImage(img, 0, 0, canvasW, canvasH);
                    URL.revokeObjectURL(url);
                    setStrokes(prev => prev.filter(s => !strokeIdsToRasterize.has(s.id)));
                    setRasterVersion(v => v + 1);
                    pendingRasterRef.current = false;
                });
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                pendingRasterRef.current = false;
            };
            img.src = url;
        });
    }, [strokes, currentStroke, ensureRasterCanvas, pushUndoSnapshot]);

    /** Build a straight-line stroke from start to end — reads refs for latest values */
    const makeStraightStroke = useCallback((start: Point, end: Point, id?: string): Stroke | null => {
        const t = toolRef.current;
        if (!t) return null;
        return {
            id: id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            points: [start, end],
            color: t === "eraser" ? "#000" : colorRef.current,
            size: getToolSize(t, scaleRef.current, sizeMultRef.current[t]),
            type: t,
            straight: true,
            pointerType: machineRef.current.pointerType,
        };
    }, []);

    // ─── Event Handling ─────────────────────────────────────────────

    // ─── Direct eraser on raster canvas ────────────────────────────
    // Draws a circle at the given point with destination-out to erase pixels.
    const eraseAtPoint = useCallback((point: Point, size: number) => {
        const rc = rasterCanvasRef.current;
        if (!rc) return;
        ensureRasterCanvas();
        const ctx = rc.getContext("2d");
        if (!ctx) return;
        const dpr = window.devicePixelRatio || 1;
        ctx.save();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.globalCompositeOperation = "destination-out";
        ctx.beginPath();
        ctx.arc(point.x, point.y, size / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }, [ensureRasterCanvas]);

    // Batch eraser — draw line between two points to avoid gaps during fast movement
    const eraseBetweenPoints = useCallback((from: Point, to: Point, size: number) => {
        const rc = rasterCanvasRef.current;
        if (!rc) return;
        ensureRasterCanvas();
        const ctx = rc.getContext("2d");
        if (!ctx) return;
        const dpr = window.devicePixelRatio || 1;
        ctx.save();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.globalCompositeOperation = "destination-out";
        ctx.lineWidth = size;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
        ctx.restore();
    }, [ensureRasterCanvas]);

    // Track last eraser position for line interpolation
    const lastEraserPointRef = useRef<Point | null>(null);

    // Helper that mirrors every setCurrentStroke write into currentStrokeRef,
    // so event handlers can read the latest stroke without nesting setState calls.
    const setCurrentStrokeTracked = useCallback((value: Stroke | null | ((prev: Stroke | null) => Stroke | null)) => {
        if (typeof value === "function") {
            setCurrentStroke((prev) => {
                const next = value(prev);
                currentStrokeRef.current = next;
                return next;
            });
        } else {
            currentStrokeRef.current = value;
            setCurrentStroke(value);
        }
    }, []);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const getPoint = (e: PointerEvent | MouseEvent): Point => {
            const rect = el.getBoundingClientRect();
            return {
                x: (e.clientX - rect.left) * pageZoomFactor,
                y: (e.clientY - rect.top) * pageZoomFactor,
                pressure: "pressure" in e ? (e as PointerEvent).pressure || 0.5 : 0.5,
            };
        };

        const commitStraightLine = () => {
            const stroke = machineRef.current.straightStroke;
            if (!stroke) return;
            setStrokes((prev) => [...prev, stroke]);
            setPreviewStroke(null);
            machineRef.current.straightStroke = null;
            resetToIdle();
        };

        const onPointerDown = (e: PointerEvent) => {
            // Middle-click undo is handled by the document-level mousedown listener.
            // Return early BEFORE stopPropagation so the mousedown event still fires.
            if (e.button === 1) return;

            // Ignore mouse-synthesized events from the tablet driver — stylus
            // devices fire both "pen" pointer events and synthetic "mouse" events
            // for the same physical action, which would start a second stroke.
            if (e.pointerType === "mouse" && machineRef.current.pointerType === "pen") return;

            e.preventDefault();
            e.stopPropagation();

            const t = toolRef.current;
            // Reject a new stroke while one is already active (different pointerId)
            if (e.button === 0 && machineRef.current.state !== "idle" && e.pointerId !== machineRef.current.pointerId) return;

            if (e.button === 0 && machineRef.current.state === "idle" && t) {
                el.setPointerCapture(e.pointerId);
                const point = getPoint(e);

                machineRef.current.pointerId = e.pointerId;
                machineRef.current.startPoint = point;
                machineRef.current.state = "freehand";
                machineRef.current.prevButtons = e.buttons;
                machineRef.current.totalDistance = 0;
                machineRef.current.pointerType = e.pointerType;

                if (t === "eraser") {
                    // Save undo snapshot before erasing.
                    void pushUndoSnapshot();
                    // Eraser: draw directly on raster canvas, no SVG stroke
                    const size = getToolSize(t, scaleRef.current, sizeMultRef.current[t]);
                    eraseAtPoint(point, size);
                    lastEraserPointRef.current = point;
                    setIsDrawing(true);
                } else if (t !== "highlighter") {
                    // For highlighter, don't create stroke until we know there's enough drag
                    setCurrentStrokeTracked({
                        id: Date.now().toString(),
                        points: [point],
                        color: colorRef.current,
                        size: getToolSize(t, scaleRef.current, sizeMultRef.current[t]),
                        type: t,
                        pointerType: e.pointerType,
                    });
                    setIsDrawing(true);
                }
            }
        };

        const onPointerMove = (e: PointerEvent) => {
            e.preventDefault();
            e.stopPropagation();

            const point = getPoint(e);
            const t = toolRef.current;
            if (t) setCursorPos(point);

            const buttons = e.buttons;

            if (machineRef.current.state === "freehand") {
                const hadRight = (machineRef.current.prevButtons & 2) !== 0;
                const hasRight = (buttons & 2) !== 0;
                const hasLeft = (buttons & 1) !== 0;

                if (t === "eraser") {
                    // Eraser: draw directly on raster canvas
                    const size = getToolSize(t, scaleRef.current, sizeMultRef.current[t]);
                    const lastPt = lastEraserPointRef.current;
                    if (lastPt) {
                        eraseBetweenPoints(lastPt, point, size);
                    } else {
                        eraseAtPoint(point, size);
                    }
                    lastEraserPointRef.current = point;
                } else if (!hadRight && hasRight && hasLeft) {
                    // Chord detected — switch to straight-line mode
                    // Start line from the original startPoint, not from current point
                    setCurrentStrokeTracked(null);
                    const startPoint = machineRef.current.startPoint || point;
                    const stroke = makeStraightStroke(startPoint, point);
                    if (stroke) {
                        setPreviewStroke(stroke);
                        machineRef.current.straightStroke = stroke;
                        machineRef.current.state = "straight-preview";
                    }
                } else {
                    setCurrentStrokeTracked((prev) => {
                        // Track distance for highlighter drag requirement
                        const lastPoint = prev?.points[prev.points.length - 1] || machineRef.current.startPoint;
                        if (!lastPoint) return prev;

                        const dx = point.x - lastPoint.x;
                        const dy = point.y - lastPoint.y;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        machineRef.current.totalDistance += distance;

                        // For highlighter, create stroke once we've exceeded minimum distance
                        if (t === "highlighter" && !prev && machineRef.current.totalDistance >= 5) {
                            return {
                                id: Date.now().toString(),
                                points: [machineRef.current.startPoint!, point],
                                color: colorRef.current,
                                size: getToolSize(t, scaleRef.current, sizeMultRef.current[t]),
                                type: t,
                                pointerType: machineRef.current.pointerType,
                            };
                        }

                        if (!prev) return prev;
                        return { ...prev, points: [...prev.points, point] };
                    });
                }
            } else if (machineRef.current.state === "straight-preview") {
                if (machineRef.current.startPoint) {
                    const stroke = makeStraightStroke(
                        machineRef.current.startPoint,
                        point,
                        machineRef.current.straightStroke?.id
                    );
                    if (stroke) {
                        setPreviewStroke(stroke);
                        machineRef.current.straightStroke = stroke;
                    }
                }

                const hadRight = (machineRef.current.prevButtons & 2) !== 0;
                const hasRight = (buttons & 2) !== 0;
                if (hadRight && !hasRight) commitStraightLine();
            }

            machineRef.current.prevButtons = buttons;
        };

        const onPointerUp = (e: PointerEvent) => {
            e.preventDefault();
            e.stopPropagation();

            if (e.button === 0 && machineRef.current.state === "freehand") {
                if (toolRef.current === "eraser") {
                    // Eraser: already drawn on canvas, just reset state
                    lastEraserPointRef.current = null;
                    resetToIdle();
                } else {
                    const MIN_DRAG_DISTANCE = 5; // pixels required for highlighter
                    // Only commit the stroke if it's not highlighter, OR if it moved far enough
                    const shouldCommit = toolRef.current !== "highlighter" || machineRef.current.totalDistance >= MIN_DRAG_DISTANCE;

                    // Read from ref to avoid nesting setState inside a setState updater,
                    // which can cause double-commits in React 18 concurrent mode.
                    const stroke = currentStrokeRef.current;
                    currentStrokeRef.current = null;
                    setCurrentStroke(null);
                    if (shouldCommit && stroke) {
                        setStrokes((prev) => [...prev, stroke]);
                    }
                    resetToIdle();
                }
            }

            machineRef.current.prevButtons = e.buttons;
        };

        // Fallback for straight-preview after pointer capture ends (left released)
        const onMouseMove = (e: MouseEvent) => {
            if (machineRef.current.state !== "straight-preview") return;

            const point = getPoint(e);
            if (toolRef.current) setCursorPos(point);

            if (machineRef.current.startPoint) {
                const stroke = makeStraightStroke(
                    machineRef.current.startPoint,
                    point,
                    machineRef.current.straightStroke?.id
                );
                if (stroke) {
                    setPreviewStroke(stroke);
                    machineRef.current.straightStroke = stroke;
                }
            }

            if (!(e.buttons & 2)) commitStraightLine();
        };

        const onMouseUp = (e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.button === 2 && machineRef.current.state === "straight-preview") {
                commitStraightLine();
            }
        };

        const onContextMenu = (e: Event) => {
            e.preventDefault();
            if (machineRef.current.state !== "idle") e.stopPropagation();
        };

        const onPointerCancel = (e: PointerEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setPreviewStroke(null);
            setCurrentStrokeTracked(null);
            setCursorPos(null);
            machineRef.current.straightStroke = null;
            resetToIdle();
        };

        const onMouseLeave = (e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setCursorPos(null);
            if (machineRef.current.state !== "idle") {
                setPreviewStroke(null);
                setCurrentStrokeTracked(null);
                machineRef.current.straightStroke = null;
                resetToIdle();
            }
        };

        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (toolRef.current) {
                const delta = e.deltaY < 0 ? 0.1 : -0.1;
                adjustToolSize(toolRef.current, delta);
            }
        };

        el.addEventListener("pointerdown", onPointerDown);
        el.addEventListener("pointermove", onPointerMove);
        el.addEventListener("pointerup", onPointerUp);
        el.addEventListener("pointercancel", onPointerCancel);
        el.addEventListener("mousemove", onMouseMove);
        el.addEventListener("mouseup", onMouseUp);
        el.addEventListener("mouseleave", onMouseLeave);
        el.addEventListener("contextmenu", onContextMenu);
        el.addEventListener("wheel", onWheel, { passive: false });

        return () => {
            el.removeEventListener("pointerdown", onPointerDown);
            el.removeEventListener("pointermove", onPointerMove);
            el.removeEventListener("pointerup", onPointerUp);
            el.removeEventListener("pointercancel", onPointerCancel);
            el.removeEventListener("mousemove", onMouseMove);
            el.removeEventListener("mouseup", onMouseUp);
            el.removeEventListener("mouseleave", onMouseLeave);
            el.removeEventListener("contextmenu", onContextMenu);
            el.removeEventListener("wheel", onWheel);
        };
    }, [adjustToolSize, setIsDrawing, makeStraightStroke, resetToIdle, setCurrentStrokeTracked, eraseAtPoint, eraseBetweenPoints, pageZoomFactor, pushUndoSnapshot]);

    // ─── Eraser Masking Groups ──────────────────────────────────────

    const allStrokes = useMemo(() => {
        const all = strokes.filter((stroke): stroke is Stroke => stroke != null);
        if (currentStroke) all.push(currentStroke);
        if (previewStroke) all.push(previewStroke);
        return all;
    }, [strokes, currentStroke, previewStroke]);

    const groups = useMemo(() => {
        const result: { id: string; strokes: Stroke[]; erasers: Stroke[] }[] = [];
        let groupStrokes: Stroke[] = [];
        let groupErasers: Stroke[] = [];

        for (let i = allStrokes.length - 1; i >= 0; i--) {
            const s = allStrokes[i];
            if (s.type === "eraser") {
                groupErasers.push(s);
            } else {
                groupStrokes.unshift(s);
                if (i === 0 || allStrokes[i - 1].type === "eraser") {
                    if (groupStrokes.length > 0) {
                        result.unshift({ id: s.id, strokes: groupStrokes, erasers: [...groupErasers] });
                    }
                    groupStrokes = [];
                    groupErasers = [];
                }
            }
        }
        return result;
    }, [allStrokes]);

    const gradientStrokeDefs =
        useGradient
            ? groups
                .flatMap((g) => g.strokes)
                .filter((s) => s.type === "marker" || s.type === "pen" || s.type === "highlighter")
                .map((s) => renderStrokeGradientDef(s, colorRemap.get(s.color) ?? s.color))
            : [];

    // ─── Render ─────────────────────────────────────────────────────

    const bgStyle: React.CSSProperties = {
        backgroundColor:
            background === "dark" ? CANVAS_BG.dark :
            background === "light" ? CANVAS_BG.light :
            "transparent",
        pointerEvents: "auto",
    };

    return (
        <>
            <div
                ref={containerRef}
                className="fixed inset-0 z-[99999] touch-none select-none cursor-none"
                style={bgStyle}
            >
                {/* Grid/vignette background — below raster canvas so it doesn't
                    occlude rasterized glow/blur effects */}
                {gridMode !== "none" && background !== "transparent" && (
                    <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                        <defs>
                            {gridMode === "grid" && renderGridPattern(background === "dark", gridSize, scaleFactor)}
                            {gridMode === "dots" && renderDotsPattern(background === "dark", gridSize, scaleFactor)}
                            <radialGradient id="vignette-fade" cx="50%" cy="50%" r="60%">
                                <stop offset="0%" stopColor="rgba(0, 0, 0, 0)" />
                                <stop offset="100%" stopColor={background === "dark" ? CANVAS_BG.darkRgba : background === "light" ? CANVAS_BG.lightRgba : "rgba(0, 0, 0, 0.05)"} />
                            </radialGradient>
                        </defs>
                        <rect x="0" y="0" width="100%" height="100%" fill={`url(#${gridMode})`} />
                        <rect x="0" y="0" width="100%" height="100%" fill="url(#vignette-fade)" />
                    </svg>
                )}

                {/* Raster canvas — completed strokes baked into a bitmap */}
                <canvas
                    ref={rasterCanvasRef}
                    className="absolute inset-0 pointer-events-none z-[5]"
                    style={{ width: "100%", height: "100%" }}
                    data-version={rasterVersion}
                />

                {/* Active strokes SVG — above raster canvas */}
                <svg ref={svgRef} className="absolute inset-0 w-full h-full pointer-events-none z-10">
                    <defs>
                        {/* Eraser masks */}
                        {groups.map(g => g.erasers.length > 0 ? (
                            <mask id={`mask-${g.id}`} key={`mask-${g.id}`}>
                                <rect x="0" y="0" width="100%" height="100%" fill="white" />
                                {g.erasers.map(e => renderStroke(e, "black"))}
                            </mask>
                        ) : null)}

                        {/* Gradient stroke paints */}
                        {gradientStrokeDefs}

                        {/* Glow filter for the Glitter palette */}
                        {paletteEffect === "glitter" && (
                            <filter id="palette-glow" x="-60%" y="-60%" width="220%" height="220%">
                                <feGaussianBlur in="SourceGraphic" stdDeviation="8" />
                            </filter>
                        )}
                    </defs>

                    {groups.map(g => (
                        <g key={`g-${g.id}`} mask={g.erasers.length > 0 ? `url(#mask-${g.id})` : undefined}>
                            {g.strokes.map(s => renderStroke(s, undefined, colorRemap, useGradient, paletteEffect))}
                        </g>
                    ))}

                </svg>
            </div>

            {/* Cursor indicator — elevated above the Radial Menu */}
            {tool && cursorPos && !((tool === "pen" || tool === "marker" || tool === "highlighter") && machineRef.current.state !== "idle") && (
                <svg className="fixed inset-0 w-full h-full pointer-events-none z-[100001]">
                    <g className="transition-opacity duration-75">
                        {tool === "pen" && (
                            <circle
                                cx={cursorPos.x} cy={cursorPos.y} r={8 * scaleFactor}
                                fill="none" stroke="rgba(150, 150, 150, 0.6)" strokeWidth={Math.max(1, scaleFactor)}
                            />
                        )}
                        {(() => {
                            const ts = getToolSize(tool, scaleFactor, toolSizeMultiplier[tool]);
                            const sw = Math.max(1, scaleFactor);
                            if (tool === "highlighter") return (
                                <rect
                                    x={cursorPos.x - ts / 4} y={cursorPos.y - ts / 2}
                                    width={ts / 2} height={ts}
                                    fill={color} stroke={color} strokeWidth={sw} opacity={0.4}
                                />
                            );
                            if (tool === "marker") return (
                                <circle
                                    cx={cursorPos.x} cy={cursorPos.y} r={ts / 2}
                                    fill={color} stroke={color} strokeWidth={sw} opacity={0.6}
                                />
                            );
                            return (
                                <circle
                                    cx={cursorPos.x} cy={cursorPos.y} r={ts / 2}
                                    fill={tool === "eraser" ? "rgba(200, 200, 200, 0.4)" : color}
                                    stroke={tool === "eraser" ? "rgba(150, 150, 150, 0.8)" : color}
                                    strokeWidth={sw} opacity={1}
                                />
                            );
                        })()}
                    </g>
                </svg>
            )}
        </>
    );
};

export default Canvas;
