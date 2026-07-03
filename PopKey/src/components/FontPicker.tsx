import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search } from "lucide-react";
import type { SurfacePalette } from "@shared/config/desktopTheme";

/** Common cross-platform fonts to show when queryLocalFonts is unavailable. */
const FALLBACK_FONTS = [
  "Arial", "Arial Black", "Arial Narrow", "Calibri", "Cambria", "Comic Sans MS",
  "Consolas", "Courier New", "Georgia", "Impact", "Segoe UI", "Tahoma",
  "Times New Roman", "Trebuchet MS", "Verdana",
  // macOS
  "Helvetica", "Helvetica Neue", "Menlo", "Monaco", "Optima",
  // Common coding fonts (may or may not be installed)
  "Cascadia Code", "Fira Code", "JetBrains Mono", "Source Code Pro",
].sort((a, b) => a.localeCompare(b));

async function querySystemFonts(): Promise<string[]> {
  try {
    if ("queryLocalFonts" in window) {
      type FontData = { family: string };
      const available = await (
        window as unknown as { queryLocalFonts: () => Promise<FontData[]> }
      ).queryLocalFonts();
      const families = [
        ...new Set(available.map((f) => f.family)),
      ].sort((a, b) => a.localeCompare(b));
      return families;
    }
  } catch {
    // Permission denied or API unavailable
  }
  return [];
}

interface FontPickerProps {
  value: string;
  onChange: (font: string) => void;
  palette: SurfacePalette;
}

export const FontPicker = ({ value, onChange, palette }: FontPickerProps) => {
  const [fonts, setFonts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [dropPos, setDropPos] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    querySystemFonts().then((f) => {
      setFonts(f.length > 0 ? f : FALLBACK_FONTS);
      setLoading(false);
    });
  }, []);

  const openDropdown = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const viewportH = window.innerHeight;
    const spaceBelow = viewportH - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const dropH = Math.min(300, Math.max(spaceBelow, spaceAbove));

    if (spaceBelow >= 200 || spaceBelow >= spaceAbove) {
      setDropPos({ top: rect.bottom + 4, left: rect.left, width: rect.width, maxHeight: dropH });
    } else {
      setDropPos({ bottom: viewportH - rect.top + 4, left: rect.left, width: rect.width, maxHeight: dropH });
    }
    setOpen(true);
    setQuery("");
    setTimeout(() => searchRef.current?.focus(), 50);
  };

  const filtered = query.trim()
    ? fonts.filter((f) => f.toLowerCase().includes(query.toLowerCase()))
    : fonts;

  const select = (font: string) => {
    onChange(font);
    setOpen(false);
  };

  return (
    <>
      <button
        ref={buttonRef}
        onClick={openDropdown}
        className="flex w-full items-center justify-between rounded-[10px] px-3 py-2.5 text-sm font-semibold transition-all hover:brightness-110"
        style={{
          backgroundColor: palette.card,
          color: palette.text,
          fontFamily: value ? `"${value}", system-ui, sans-serif` : undefined,
        }}
      >
        <span className="truncate">{value || "Pick a font…"}</span>
        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </button>

      {open &&
        createPortal(
          <>
            {/* backdrop */}
            <div className="fixed inset-0 z-[99]" onClick={() => setOpen(false)} />

            {/* dropdown */}
            <div
              className="fixed z-[100] flex flex-col overflow-hidden rounded-[14px] shadow-2xl"
              style={{
                top: dropPos?.top,
                bottom: dropPos?.bottom,
                left: dropPos?.left,
                width: dropPos?.width,
                maxHeight: dropPos?.maxHeight,
                backgroundColor: palette.panel,
                border: `1.5px solid ${palette.divider}`,
              }}
            >
              {/* search */}
              <div className="shrink-0 p-2" style={{ borderBottom: `1px solid ${palette.divider}` }}>
                <div
                  className="flex items-center gap-2 rounded-[8px] px-2.5 py-1.5"
                  style={{ backgroundColor: palette.card }}
                >
                  <Search className="h-3.5 w-3.5 shrink-0" style={{ color: palette.muted }} />
                  <input
                    ref={searchRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setOpen(false);
                      if (e.key === "Enter" && filtered.length === 1) select(filtered[0]);
                    }}
                    placeholder="Search fonts…"
                    className="flex-1 bg-transparent text-sm outline-none"
                    style={{ color: palette.text }}
                  />
                </div>
              </div>

              {/* list */}
              <div className="fp-list overflow-y-auto">
                {loading ? (
                  <div className="py-6 text-center text-xs" style={{ color: palette.muted }}>
                    Loading fonts…
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="py-6 text-center text-xs" style={{ color: palette.muted }}>
                    No fonts match "{query}"
                  </div>
                ) : (
                  filtered.map((font) => (
                    <button
                      key={font}
                      onClick={() => select(font)}
                      className="flex w-full items-center px-3 py-2 text-left text-sm transition-colors hover:brightness-110"
                      style={{
                        backgroundColor: font === value ? palette.selected : "transparent",
                        color: palette.text,
                        fontFamily: `"${font}", system-ui, sans-serif`,
                        borderLeft: font === value ? `3px solid ${palette.text}` : "3px solid transparent",
                      }}
                    >
                      {font}
                    </button>
                  ))
                )}
              </div>
            </div>
          </>,
          document.body
        )}
    </>
  );
};
