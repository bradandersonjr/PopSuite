import { useCallback, useEffect, useRef, useState } from "react";
import { X, Palette, ImageIcon, CircleDot, Upload, Trash2, Plus, Power, Check, Shuffle, Sparkles } from "lucide-react";
import { getSurfacePalette, PRO_ACCENT } from "@shared/config/desktopTheme";
import { PALETTE_SEEDS } from "@/config/themes";
import { useStore } from "@/store/useStore";
import {
  clearProCenterIcon,
  deleteProPreset,
  getProCenterIcon,
  getProCenterScale,
  getProPalette,
  getProPresets,
  isProPaletteActive,
  PalettePreset,
  saveProPreset,
  setProCenterIcon,
  setProCenterScale,
  setProPalette,
  setProPaletteActive,
  getProEffect,
  setProEffect,
  type ProEffect,
} from "@/pro";

type Tab = "palette" | "center";

type ProSettingsModalProps = {
  onClose: () => void;
};

const DEFAULT_DRAW = ["#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF"];
const DEFAULT_HL = ["#FF0000", "#00FF00", "#0000FF", "#FFFF00"];

// ─── Randomizer ───────────────────────────────────────────────────────────────

// The 6 hue families, matching the position of each color slot
const BASE_HUES = [0, 25, 55, 140, 215, 275]; // red, orange, yellow, green, blue, purple
// Highlighter maps to slots: yellow, green, red, blue
const HL_HUE_INDICES = [2, 3, 0, 4];

function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60)       { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else              { r = c; b = x; }
  const hex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function randomizePalette(): { draw: string[]; hl: string[] } {
  // Pick a consistent style for this roll
  const sat = rand(60, 100);          // 60–100% saturation across all
  const light = rand(42, 78);         // 42–78% lightness across all
  const hueJitter = rand(0, 20);      // how much hue can drift per slot
  const hueDir = Math.random() > 0.5 ? 1 : -1; // shift all hues left or right

  const draw = BASE_HUES.map((baseHue) => {
    const h = baseHue + hueDir * rand(0, hueJitter);
    // Slightly vary sat/light per chip so it doesn't look flat
    const s = Math.min(100, sat + rand(-8, 8));
    const l = Math.min(88, Math.max(30, light + rand(-6, 6)));
    return hslToHex(h, s, l);
  });

  const hl = HL_HUE_INDICES.map((idx) => {
    const baseHue = BASE_HUES[idx];
    const h = baseHue + hueDir * rand(0, hueJitter);
    // Highlighters: same style but slightly more vivid
    const s = Math.min(100, sat + rand(0, 10));
    const l = Math.min(88, Math.max(30, light + rand(-4, 4)));
    return hslToHex(h, s, l);
  });

  return { draw, hl };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

type SP = ReturnType<typeof getSurfacePalette>;

const ColorSwatch = ({
  color, onChange, label, sp,
}: { color: string; onChange: (c: string) => void; label: string; sp: SP }) => {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col items-center gap-0.5">
      <button
        onClick={() => ref.current?.click()}
        className="relative rounded-full border-2 transition-transform hover:scale-110 active:scale-95"
        style={{ width: 52, height: 52, backgroundColor: color, borderColor: sp.divider }}
        title={label}
      >
        <input ref={ref} type="color" value={color} onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
      </button>
      <span className="text-xs font-mono" style={{ color: sp.muted, fontSize: "10px" }}>{color.toUpperCase()}</span>
    </div>
  );
};


// ─── Main modal ───────────────────────────────────────────────────────────────

const ProSettingsModal = ({ onClose }: ProSettingsModalProps) => {
  const themeMode = useStore((s) => s.themeMode);
  const sp = getSurfacePalette(themeMode === "dark");

  const [tab, setTab] = useState<Tab>("palette");

  // ── Palette ──────────────────────────────────────────────────────
  const [drawColors, setDrawColors] = useState<string[]>([...DEFAULT_DRAW]);
  const [hlColors, setHlColors]     = useState<string[]>([...DEFAULT_HL]);
  const [paletteActive, setPaletteActive]   = useState(false);
  const [hasSaved, setHasSaved]             = useState(false);

  const [activeSeed, setActiveSeed] = useState<string | null>(null);

  // Presets
  const [presets, setPresets]       = useState<PalettePreset[]>([]);
  const [savingPreset, setSavingPreset] = useState(false);
  const [presetName, setPresetName] = useState("");

  // ── Icon ─────────────────────────────────────────────────────────
  const [iconDataUrl, setIconDataUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Effect ───────────────────────────────────────────────────────
  const [effect, setEffect] = useState<ProEffect>("none");

  // ── Scale ────────────────────────────────────────────────────────
  const [scale, setScale] = useState(1);

  const SCALE_PRESETS = [
    { label: "Small", value: 0.75 },
    { label: "Default", value: 1.0 },
    { label: "Large", value: 1.35 },
    { label: "XL", value: 1.75 },
  ];

  // Load persisted state
  useEffect(() => {
    const palette = getProPalette(null);
    if (palette) {
      const draw = [...palette.draw] as string[];
      const hl   = [...palette.highlighter] as string[];
      setDrawColors(draw);
      setHlColors(hl);
      setHasSaved(true);
    }
    setPaletteActive(isProPaletteActive() && hasSaved);
    setPresets(getProPresets());
    const icon = getProCenterIcon(); if (icon) setIconDataUrl(icon);
    setScale(getProCenterScale());
    setEffect(getProEffect());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-check active once hasSaved resolves
  useEffect(() => {
    if (hasSaved) setPaletteActive(isProPaletteActive());
  }, [hasSaved]);


  // ── Palette handlers ──────────────────────────────────────────────

  const bumpPaletteVersion = useStore(state => state.bumpPaletteVersion);

  const handleApply = () => {
    setProPalette(drawColors, hlColors);
    setProPaletteActive(true);
    setPaletteActive(true);
    setHasSaved(true);
    bumpPaletteVersion();
  };

  const handleToggle = () => {
    const next = !paletteActive;
    setProPaletteActive(next);
    setPaletteActive(next);
    bumpPaletteVersion();
  };

  const updateDraw = (i: number, c: string) => {
    setDrawColors(drawColors.map((v, idx) => idx === i ? c : v));
  };

  const updateHl = (i: number, c: string) => {
    setHlColors(hlColors.map((v, idx) => idx === i ? c : v));
  };

  // ── Preset handlers ───────────────────────────────────────────────

  const handleSavePreset = () => {
    if (!presetName.trim()) return;
    const p = saveProPreset(presetName.trim(), drawColors, hlColors);
    setPresets((prev) => [...prev, p]);
    setPresetName(""); setSavingPreset(false);
  };

  const handleLoadPreset = (p: PalettePreset) => {
    setDrawColors([...p.draw]);
    setHlColors([...p.highlighter]);
    setActiveSeed(null);
  };

  const handleDeletePreset = (id: string) => {
    deleteProPreset(id);
    setPresets((prev) => prev.filter((p) => p.id !== id));
  };

  // ── Icon handlers ─────────────────────────────────────────────────

  const readFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result;
      if (typeof result === "string") {
        setIconDataUrl(result); setProCenterIcon(result);
      }
    };
    reader.onerror = () => { /* silently ignore — user can retry */ };
    reader.readAsDataURL(file);
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (f) readFile(f);
  }, [readFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f?.type.startsWith("image/")) readFile(f);
  }, [readFile]);

  // ── Scroll isolation — prevent background from scrolling ──────────
  const bodyRef = useRef<HTMLDivElement>(null);

  // ── Tabs ─────────────────────────────────────────────────────────

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "palette", label: "Colors",        icon: <Palette   size={18} /> },
    { id: "center",  label: "Center Circle", icon: <CircleDot size={18} /> },
  ];

  // Keep modal dimensions stable between tabs while still fitting shorter viewports.
  const PANEL_HEIGHT = "min(840px, 90vh)";

  return (
    /* Backdrop — clicks outside close the modal */
    <div
      className="fixed inset-0 z-[200000] flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.55)", backdropFilter: "blur(3px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Panel — wider, no overflow visible at top level */}
      <div
        className="relative flex flex-col"
        style={{
          backgroundColor: sp.panel,
          borderRadius: 32,
          border: `1px solid ${sp.divider}`,
          width: "min(1040px, 90vw)",
          height: PANEL_HEIGHT,
          overflow: "hidden",
        }}
        /* Prevent wheel events leaking to background */
        onWheel={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div
          className="flex shrink-0 items-center justify-between px-9 py-6"
          style={{ borderBottom: `1px solid ${sp.divider}` }}
        >
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl text-sm font-bold"
              style={{ backgroundColor: PRO_ACCENT, color: "#fff" }}>Pro</div>
            <div>
              <div className="text-xl font-semibold" style={{ color: sp.text }}>Pro Settings</div>
              <div className="text-sm" style={{ color: sp.muted }}>Customize your radial menu</div>
            </div>
          </div>
          <button onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full transition-opacity hover:opacity-70"
            style={{ backgroundColor: sp.card, color: sp.muted }}>
            <X size={20} />
          </button>
        </div>

        {/* ── Tabs + Title Bar ── */}
        <div className="shrink-0 px-9 py-3 flex items-center" style={{ borderBottom: `1px solid ${sp.divider}` }}>
          <div className="flex-1">
            <div className="text-base font-semibold" style={{ color: sp.text }}>Custom Color Palette</div>
            <div className="text-xs" style={{ color: sp.muted }}>
              {hasSaved
                ? paletteActive ? "Active — overrides built-in palette" : "Saved but currently inactive"
                : "Adjust colors below and click Apply to activate"}
            </div>
          </div>
          <div className="flex gap-1">
            {tabs.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="flex items-center gap-2 rounded-t-lg px-4 pb-2 pt-1.5 text-sm font-medium"
                style={{
                  color: tab === t.id ? sp.text : sp.muted,
                  borderBottom: tab === t.id ? `2px solid ${PRO_ACCENT}` : "2px solid transparent",
                }}>
                {t.icon}{t.label}
              </button>
            ))}
          </div>
          <div className="flex-1 flex justify-end">
            {hasSaved && (
              <button onClick={handleToggle}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-80 shrink-0"
                style={{ backgroundColor: paletteActive ? PRO_ACCENT : sp.card, color: paletteActive ? "#fff" : sp.muted }}>
                <Power size={12} />{paletteActive ? "Active" : "Inactive"}
              </button>
            )}
          </div>
        </div>

        {/* ── Body ── */}
        <div ref={bodyRef} className="flex-1 min-h-0 overflow-y-auto">

          {/* ════ PALETTE TAB ════ */}
          {tab === "palette" && (
            <div className="p-7 space-y-4 flex flex-col h-full">

              {/* ─── Two-column layout ─── */}
              <div className="grid grid-cols-2 gap-4 flex-1">

                {/* Left: Color swatches + Effect */}
                <div className="flex flex-col gap-3">
                  <div className="flex-1 rounded-2xl p-4 space-y-2.5" style={{ backgroundColor: sp.card }}>
                    <div>
                      <div className="mb-3 text-sm font-bold uppercase tracking-widest" style={{ color: sp.muted }}>
                        Draw (6)
                      </div>
                      <div className="grid grid-cols-3 gap-x-3 gap-y-1.5">
                        {drawColors.map((c, i) => (
                          <ColorSwatch key={i} color={c} onChange={(v) => updateDraw(i, v)} label={`Draw ${i + 1}`} sp={sp} />
                        ))}
                      </div>
                    </div>
                    <div className="h-px" style={{ backgroundColor: sp.divider }} />
                    <div>
                      <div className="mb-3 text-sm font-bold uppercase tracking-widest" style={{ color: sp.muted }}>
                        Highlighter (4)
                      </div>
                      <div className="grid grid-cols-4 gap-x-2 gap-y-1.5">
                        {hlColors.map((c, i) => (
                          <ColorSwatch key={i} color={c} onChange={(v) => updateHl(i, v)} label={`HL ${i + 1}`} sp={sp} />
                        ))}
                      </div>
                    </div>
                    <div className="h-px" style={{ backgroundColor: sp.divider }} />
                    <div>
                      <div className="flex items-center gap-2 mb-2.5">
                        <Sparkles size={14} style={{ color: sp.muted }} />
                        <span className="text-sm font-bold uppercase tracking-widest" style={{ color: sp.muted }}>
                          Stroke Effect
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {([
                          { value: "none", label: "None" },
                          { value: "gradient", label: "Gradient" },
                          { value: "glitter", label: "Glitter" },
                          { value: "magical", label: "Magical" },
                        ] as const).map((opt) => (
                          <button key={opt.value}
                            onClick={() => {
                              setEffect(opt.value);
                              setProEffect(opt.value);
                              bumpPaletteVersion();
                            }}
                            className="rounded-xl py-2 text-sm font-medium transition-colors"
                            style={{
                              backgroundColor: effect === opt.value ? PRO_ACCENT : sp.selected,
                              color: effect === opt.value ? "#fff" : sp.muted,
                            }}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: Seeds + Presets */}
                <div className="flex flex-col gap-3">
                  {/* Seed palettes */}
                  <div className="rounded-2xl p-4 space-y-2" style={{ backgroundColor: sp.card }}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-sm font-bold uppercase tracking-widest" style={{ color: sp.muted }}>
                        Start from
                      </div>
                      <button
                        onClick={() => {
                          const { draw, hl } = randomizePalette();
                          setDrawColors(draw);
                          setHlColors(hl);
                          setActiveSeed(null);
                        }}
                        className="flex items-center gap-2 rounded-lg px-3 py-1 text-sm font-medium transition-opacity hover:opacity-80"
                        style={{ backgroundColor: sp.selected, color: sp.text }}>
                        <Shuffle size={13} /> Randomize
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      {PALETTE_SEEDS.map((seed) => {
                        const isActive = activeSeed === seed.name;
                        return (
                          <button key={seed.name}
                            onClick={() => {
                              setDrawColors([...seed.draw]);
                              setHlColors([...seed.hl]);
                              setActiveSeed(seed.name);
                            }}
                            className="flex flex-col items-start gap-2 rounded-xl px-4 py-3.5 transition-opacity hover:opacity-90"
                            style={{
                              backgroundColor: isActive ? sp.selected : "transparent",
                              border: `1.5px solid ${isActive ? PRO_ACCENT : sp.divider}`,
                            }}>
                            <div className="flex items-center justify-between w-full">
                              <span className="text-base font-semibold" style={{ color: isActive ? sp.text : sp.muted }}>
                                {seed.name}
                              </span>
                              {isActive && <Check size={16} color={PRO_ACCENT} />}
                            </div>
                            <div className="flex gap-1">
                              {seed.draw.map((c, i) => (
                                <div key={i} className="rounded-full" style={{ width: 18, height: 18, backgroundColor: c }} />
                              ))}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Presets */}
                  <div className="flex-1 rounded-2xl p-4 space-y-2" style={{ backgroundColor: sp.card }}>
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-bold uppercase tracking-widest" style={{ color: sp.muted }}>Presets</div>
                      <button onClick={() => setSavingPreset(true)}
                        className="flex items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-70"
                        style={{ color: PRO_ACCENT }}>
                        <Plus size={14} /> Save current
                      </button>
                    </div>

                    {savingPreset && (
                      <div className="flex gap-2">
                        <input autoFocus type="text" value={presetName}
                          onChange={(e) => setPresetName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSavePreset();
                            if (e.key === "Escape") { setSavingPreset(false); setPresetName(""); }
                          }}
                          placeholder="Preset name…"
                          className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
                          style={{ backgroundColor: sp.selected, color: sp.text, border: `1px solid ${sp.divider}` }} />
                        <button onClick={handleSavePreset} disabled={!presetName.trim()}
                          className="rounded-lg px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-40"
                          style={{ backgroundColor: PRO_ACCENT, color: "#fff" }}>
                          Save
                        </button>
                      </div>
                    )}

                    {presets.length === 0 && !savingPreset ? (
                      <div className="rounded-lg px-3 py-2.5 text-sm text-center" style={{ backgroundColor: sp.selected, color: sp.muted }}>
                        No presets saved yet
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {presets.map((p) => (
                          <div key={p.id}
                            className="flex items-center justify-between rounded-lg px-3 py-2"
                            style={{ backgroundColor: sp.selected }}>
                            <div className="flex items-center gap-2.5">
                              <div className="flex gap-1">
                                {p.draw.slice(0, 6).map((c, i) => (
                                  <div key={i} className="h-4 w-4 rounded-full"
                                    style={{ backgroundColor: c, border: `1px solid ${sp.divider}` }} />
                                ))}
                              </div>
                              <span className="text-sm font-medium" style={{ color: sp.text }}>{p.name}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => handleLoadPreset(p)}
                                className="rounded-md px-2.5 py-1 text-xs font-medium transition-opacity hover:opacity-80"
                                style={{ backgroundColor: sp.card, color: sp.text }}>
                                Load
                              </button>
                              <button onClick={() => handleDeletePreset(p.id)}
                                className="rounded-md p-1 transition-opacity hover:opacity-70"
                                style={{ color: sp.muted }}>
                                <X size={13} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* ════ CENTER CIRCLE TAB ════ */}
          {tab === "center" && (
            <div className="p-7 space-y-4 flex flex-col h-full">

              {/* Two-column layout: icon left, size right */}
              <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">

                {/* Left: icon upload */}
                <div className="flex flex-col gap-3">
                  <div className="text-sm font-bold uppercase tracking-widest" style={{ color: sp.muted }}>Custom Icon</div>
                  <div
                    className="flex-1 flex flex-col items-center justify-center gap-5 rounded-2xl border-2 border-dashed"
                    style={{ borderColor: sp.divider, backgroundColor: sp.card }}
                    onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}
                  >
                    {iconDataUrl ? (
                      <img src={iconDataUrl} alt="icon preview" className="h-20 w-20 rounded-full object-contain" />
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded-full" style={{ backgroundColor: sp.selected }}>
                        <ImageIcon size={36} style={{ color: sp.muted }} />
                      </div>
                    )}
                    <div className="text-center">
                      <div className="text-base font-medium" style={{ color: sp.text }}>{iconDataUrl ? "Icon loaded" : "Upload files"}</div>
                      <div className="text-sm mt-0.5" style={{ color: sp.muted }}>PNG, JPG, SVG</div>
                    </div>
                  </div>
                  <input ref={fileInputRef} type="file"
                    accept="image/svg+xml,image/png,image/jpeg,image/webp,image/gif,image/avif,image/*"
                    className="hidden" onChange={handleFileChange} />
                  <div className="flex gap-3">
                    <button onClick={() => fileInputRef.current?.click()}
                      className="flex flex-1 items-center justify-center gap-2.5 rounded-2xl py-3 text-base font-semibold transition-opacity hover:opacity-80"
                      style={{ backgroundColor: PRO_ACCENT, color: "#fff" }}>
                      <Upload size={18} /> Browse
                    </button>
                    {iconDataUrl && (
                      <button onClick={() => { clearProCenterIcon(); setIconDataUrl(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                        className="flex items-center gap-2 rounded-2xl px-4 py-3 text-base font-medium transition-opacity hover:opacity-70"
                        style={{ backgroundColor: sp.card, color: sp.muted }}>
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Right: size */}
                <div className="flex flex-col gap-3">
                  <div className="text-sm font-bold uppercase tracking-widest" style={{ color: sp.muted }}>Circle Size</div>

                  {/* Preview */}
                  <div className="flex-1 flex items-center justify-center rounded-2xl" style={{ backgroundColor: sp.card }}>
                    <div className="flex items-center justify-center rounded-full"
                      style={{ width: 64 * scale, height: 64 * scale, backgroundColor: PRO_ACCENT, transition: "width 0.15s, height 0.15s" }}>
                      {iconDataUrl ? (
                        <img src={iconDataUrl} alt="icon"
                          style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: "50%" }} />
                      ) : (
                        <svg width={30 * scale} height={30 * scale} viewBox="0 0 24 24" fill="none"
                          stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                        </svg>
                      )}
                    </div>
                  </div>

                  {/* Size presets */}
                  <div className="grid grid-cols-2 gap-3">
                    {SCALE_PRESETS.map((p) => (
                      <button key={p.label} onClick={() => { setScale(p.value); setProCenterScale(p.value); }}
                        className="rounded-xl py-3 text-base font-medium transition-colors"
                        style={{
                          backgroundColor: Math.abs(scale - p.value) < 0.01 ? PRO_ACCENT : sp.card,
                          color: Math.abs(scale - p.value) < 0.01 ? "#fff" : sp.muted,
                        }}>
                        {p.label}
                      </button>
                    ))}
                  </div>

                  {/* Fine slider */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm" style={{ color: sp.muted }}>
                      <span>0.5×</span>
                      <span className="font-semibold" style={{ color: sp.text }}>{scale.toFixed(2)}×</span>
                      <span>2.0×</span>
                    </div>
                    <input type="range" min={0.5} max={2} step={0.05} value={scale}
                      onChange={(e) => { const v = parseFloat(e.target.value); setScale(v); setProCenterScale(v); }}
                      className="w-full" style={{ accentColor: PRO_ACCENT }} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="shrink-0 px-9 py-4" style={{ borderTop: `1px solid ${sp.divider}` }}>
          <div className="flex items-center justify-between">
            <div className="text-sm" style={{ color: sp.muted }}>Changes apply immediately</div>
            <div className="flex items-center gap-2">
              <button onClick={onClose}
                className="rounded-2xl px-6 py-2 text-sm font-medium transition-opacity hover:opacity-70"
                style={{ backgroundColor: sp.card, color: sp.text }}>
                Cancel
              </button>
              <button onClick={() => { handleApply(); onClose(); }}
                className="rounded-2xl px-6 py-2 text-sm font-medium transition-opacity hover:opacity-80"
                style={{ backgroundColor: PRO_ACCENT, color: "#fff" }}>
                {hasSaved ? "Apply" : "Save & Activate"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProSettingsModal;
