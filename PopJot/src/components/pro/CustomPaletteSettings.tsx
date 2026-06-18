import { useEffect, useRef, useState } from "react";
import { Plus, Check, Shuffle, X } from "lucide-react";
import { getSurfacePalette, PRO_ACCENT } from "@shared/config/desktopTheme";
import { PALETTE_SEEDS } from "@jot/config/themes";
import { useStore } from "@jot/store/useStore";
import {
  deleteProPreset,
  getProPalette,
  getProPresets,
  isProPaletteActive,
  PalettePreset,
  saveProPreset,
  setProPalette,
  setProPaletteActive,
  getProEffect,
  setProEffect,
  type ProEffect,
} from "@jot/pro";

const DEFAULT_DRAW = ["#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF"];
const DEFAULT_HL = ["#FF0000", "#00FF00", "#0000FF", "#FFFF00"];

// Hue families per slot: red, orange, yellow, green, blue, purple
const BASE_HUES = [0, 25, 55, 140, 215, 275];
const HL_HUE_INDICES = [2, 3, 0, 4];

function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  const hex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

const rnd = (min: number, max: number) => min + Math.random() * (max - min);

function randomizePalette(): { draw: string[]; hl: string[] } {
  const sat = rnd(60, 100);
  const light = rnd(42, 78);
  const hueJitter = rnd(0, 20);
  const hueDir = Math.random() > 0.5 ? 1 : -1;
  const draw = BASE_HUES.map((baseHue) => {
    const h = baseHue + hueDir * rnd(0, hueJitter);
    const s = Math.min(100, sat + rnd(-8, 8));
    const l = Math.min(88, Math.max(30, light + rnd(-6, 6)));
    return hslToHex(h, s, l);
  });
  const hl = HL_HUE_INDICES.map((idx) => {
    const h = BASE_HUES[idx] + hueDir * rnd(0, hueJitter);
    const s = Math.min(100, sat + rnd(0, 10));
    const l = Math.min(88, Math.max(30, light + rnd(-4, 4)));
    return hslToHex(h, s, l);
  });
  return { draw, hl };
}

type SP = ReturnType<typeof getSurfacePalette>;

const ColorSwatch = ({ color, onChange, label, sp }: { color: string; onChange: (c: string) => void; label: string; sp: SP }) => {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <button
      onClick={() => ref.current?.click()}
      className="relative rounded-full border-2 transition-transform hover:scale-110 active:scale-95"
      style={{ width: 40, height: 40, backgroundColor: color, borderColor: sp.divider }}
      title={`${label} — ${color.toUpperCase()}`}
    >
      <input ref={ref} type="color" value={color} onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
    </button>
  );
};

const EFFECTS: { value: ProEffect; label: string }[] = [
  { value: "none", label: "None" },
  { value: "gradient", label: "Gradient" },
  { value: "glitter", label: "Glitter" },
];

const CustomPaletteSettings = () => {
  const themeMode = useStore((s) => s.themeMode);
  const bumpPaletteVersion = useStore((s) => s.bumpPaletteVersion);
  const sp = getSurfacePalette(themeMode === "dark");

  const [drawColors, setDrawColors] = useState<string[]>([...DEFAULT_DRAW]);
  const [hlColors, setHlColors] = useState<string[]>([...DEFAULT_HL]);
  const [paletteActive, setPaletteActive] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [activeSeed, setActiveSeed] = useState<string | null>(null);
  const [presets, setPresets] = useState<PalettePreset[]>([]);
  const [savingPreset, setSavingPreset] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [effect, setEffect] = useState<ProEffect>("none");

  useEffect(() => {
    const palette = getProPalette(null);
    let saved = false;
    if (palette) {
      setDrawColors([...palette.draw] as string[]);
      setHlColors([...palette.highlighter] as string[]);
      saved = true;
      setHasSaved(true);
    }
    setPaletteActive(isProPaletteActive() && saved);
    setPresets(getProPresets());
    setEffect(getProEffect());
  }, []);

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
  const updateDraw = (i: number, c: string) => setDrawColors(drawColors.map((v, idx) => (idx === i ? c : v)));
  const updateHl = (i: number, c: string) => setHlColors(hlColors.map((v, idx) => (idx === i ? c : v)));

  const handleSavePreset = () => {
    if (!presetName.trim()) return;
    const p = saveProPreset(presetName.trim(), drawColors, hlColors);
    setPresets((prev) => [...prev, p]);
    setPresetName("");
    setSavingPreset(false);
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

  const sectionLabel = "text-[11px] font-bold uppercase tracking-widest";

  return (
    <div className="space-y-3">
      {/* Active toggle */}
      {hasSaved && (
        <button
          onClick={handleToggle}
          className="flex w-full items-center justify-center gap-1.5 rounded-[12px] px-3 py-2 text-xs font-semibold transition-opacity hover:opacity-80"
          style={{ backgroundColor: paletteActive ? PRO_ACCENT : sp.card, color: paletteActive ? "#fff" : sp.muted }}
        >
          {paletteActive ? "Active — overriding built-in palette" : "Saved — inactive"}
        </button>
      )}

      {/* Swatches */}
      <div className="rounded-[12px] p-3 space-y-3" style={{ backgroundColor: sp.card }}>
        <div>
          <div className={`mb-2 ${sectionLabel}`} style={{ color: sp.muted }}>Draw</div>
          <div className="flex flex-wrap gap-2">
            {drawColors.map((c, i) => (
              <ColorSwatch key={i} color={c} onChange={(v) => updateDraw(i, v)} label={`Draw ${i + 1}`} sp={sp} />
            ))}
          </div>
        </div>
        <div>
          <div className={`mb-2 ${sectionLabel}`} style={{ color: sp.muted }}>Highlighter</div>
          <div className="flex flex-wrap gap-2">
            {hlColors.map((c, i) => (
              <ColorSwatch key={i} color={c} onChange={(v) => updateHl(i, v)} label={`HL ${i + 1}`} sp={sp} />
            ))}
          </div>
        </div>
      </div>

      {/* Stroke effect */}
      <div>
        <div className={`mb-1.5 ${sectionLabel}`} style={{ color: sp.muted }}>Stroke Effect</div>
        <div className="grid grid-cols-3 gap-2">
          {EFFECTS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setEffect(opt.value); setProEffect(opt.value); bumpPaletteVersion(); }}
              className="rounded-[10px] py-2 text-xs font-semibold transition-colors"
              style={{ backgroundColor: effect === opt.value ? PRO_ACCENT : sp.card, color: effect === opt.value ? "#fff" : sp.muted }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Seeds */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <div className={sectionLabel} style={{ color: sp.muted }}>Start from</div>
          <button
            onClick={() => { const { draw, hl } = randomizePalette(); setDrawColors(draw); setHlColors(hl); setActiveSeed(null); }}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-opacity hover:opacity-80"
            style={{ backgroundColor: sp.card, color: sp.text }}
          >
            <Shuffle size={12} /> Randomize
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {PALETTE_SEEDS.map((seed) => {
            const isActive = activeSeed === seed.name;
            return (
              <button
                key={seed.name}
                onClick={() => { setDrawColors([...seed.draw]); setHlColors([...seed.hl]); setActiveSeed(seed.name); }}
                className="flex flex-col items-start gap-1.5 rounded-[10px] px-3 py-2 transition-opacity hover:opacity-90"
                style={{ backgroundColor: isActive ? sp.selected : "transparent", border: `1.5px solid ${isActive ? PRO_ACCENT : sp.divider}` }}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="text-xs font-semibold" style={{ color: isActive ? sp.text : sp.muted }}>{seed.name}</span>
                  {isActive && <Check size={13} color={PRO_ACCENT} />}
                </div>
                <div className="flex gap-1">
                  {seed.draw.map((c, i) => (
                    <div key={i} className="rounded-full" style={{ width: 14, height: 14, backgroundColor: c }} />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Presets */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <div className={sectionLabel} style={{ color: sp.muted }}>Presets</div>
          <button onClick={() => setSavingPreset(true)} className="flex items-center gap-1.5 text-xs font-medium transition-opacity hover:opacity-70" style={{ color: PRO_ACCENT }}>
            <Plus size={13} /> Save current
          </button>
        </div>
        {savingPreset && (
          <div className="flex gap-2">
            <input autoFocus type="text" value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSavePreset(); if (e.key === "Escape") { setSavingPreset(false); setPresetName(""); } }}
              placeholder="Preset name…"
              className="flex-1 rounded-lg px-3 py-1.5 text-sm outline-none"
              style={{ backgroundColor: sp.card, color: sp.text, border: `1px solid ${sp.divider}` }} />
            <button onClick={handleSavePreset} disabled={!presetName.trim()}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-80 disabled:opacity-40"
              style={{ backgroundColor: PRO_ACCENT, color: "#fff" }}>Save</button>
          </div>
        )}
        {presets.length === 0 && !savingPreset ? (
          <div className="rounded-lg px-3 py-2 text-xs" style={{ backgroundColor: sp.card, color: sp.muted }}>No presets saved yet</div>
        ) : (
          <div className="space-y-1.5">
            {presets.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg px-3 py-1.5" style={{ backgroundColor: sp.card }}>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {p.draw.slice(0, 6).map((c, i) => (
                      <div key={i} className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: c, border: `1px solid ${sp.divider}` }} />
                    ))}
                  </div>
                  <span className="text-xs font-medium" style={{ color: sp.text }}>{p.name}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => handleLoadPreset(p)} className="rounded-md px-2 py-0.5 text-xs font-medium transition-opacity hover:opacity-80" style={{ backgroundColor: sp.selected, color: sp.text }}>Load</button>
                  <button onClick={() => handleDeletePreset(p.id)} className="rounded-md p-1 transition-opacity hover:opacity-70" style={{ color: sp.muted }}><X size={12} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Apply */}
      <button onClick={handleApply}
        className="w-full rounded-[12px] px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-80"
        style={{ backgroundColor: PRO_ACCENT, color: "#fff" }}>
        {hasSaved ? "Apply changes" : "Save & Activate"}
      </button>
    </div>
  );
};

export default CustomPaletteSettings;
