# QuickInk Project Memory

## Latest Fixes (2026-02-23)

### Code Audit & Polish — Commit 5fc2ce3
Fixed critical bugs and removed dead code:

**🔴 Critical Fixes:**
1. Canvas.tsx colorRemap now handles all 3 palettes (muted/vibrant/neon) — was only mapping muted↔vibrant
2. React Hook stale closures fixed — wrapped resetToIdle and makeStraightStroke in useCallback with proper deps
3. ESLint error fixed — changed let→const for currentGroupErasers

**🟡 Important Cleanup:**
- Removed 9 dead exports from themes.ts (POP_BUCKETS*, POP_CENTER_COLORS*, MONO_COLORS*, BOARD_COLORS)
- Uninstalled 4 unused dependencies: react-router-dom, sonner, @radix-ui/react-toast, next-themes
- Deleted 2 dead files: platform.ts, theme-provider.tsx
- Removed 3 unused Tailwind color tokens (pop-blue, pop-orange, pop-pink)
- Deleted 2 unused scale utilities (scaleValue, scaleValues)

**🏗️ Refactoring:**
- Extracted getColors() helper to eliminate DRY violations

**Build:** ✅ Vite passes (139.50 kB gzip), ESLint clean

## Key Lessons

### Tailwind purges `@layer base` styles
Tailwind 3 tree-shakes styles inside `@layer base`. If class names are dynamically constructed (e.g., `radial-btn-${menuStyle}`), Tailwind can't detect them at build time and will purge the CSS rules. Fix: move those styles **outside** `@layer base` so they're always included in the output.

### Radial Menu Pop style
- Keep circles, not squares: combine `neo-box` with `rounded-full` override
- Use `neo-box-hover` for interactive lift effect (translate -2px -2px on hover)
- Selection pop animation: replicate landing page button press effect with box-shadow and translate

## Architecture
- **Stack**: React + Vite + Tailwind + Zustand + Framer Motion + shadcn/ui
- **Config**: `src/config/themes.ts` — Color palettes via getColors() helper; `src/config/animations.ts` — Animation intensity presets
- **Store**: `src/store/useStore.ts` (Zustand) — `menuStyle`, `colorPalette` ("muted"|"vibrant"|"neon"), `themeMode` ("dark"|"light"), `animationIntensity` ("low"|"medium"|"high"), `scaleFactor`
- **Scaling**: `src/utils/scale.ts` — Auto-detects screen resolution and calculates scale multiplier (base: 1920x1080)
- **UI**: SystemTray menu controls all settings (theme, colors, animations, scale)

## 4 Menu Styles + Dark/Light Theme + 3 Color Palettes

| Style | Type | Description |
|-------|------|-------------|
| **Flat** | `"flat"` | Simple flat circles, adapts to dark/light theme |
| **Flat Outline** | `"flat-outline"` | Flat + 2px border, adapts to dark/light theme |
| **Pop** | `"pop"` | Neo-brutalist with random colors from selected palette |
| **Pop Mono** | `"pop-mono"` | Neo-brutalist with mono colors, adapts to dark/light theme |

### Color Palettes (3 options)
- **Muted** — Soft, desaturated colors (default)
- **Vibrant** — Bright, saturated colors
- **Neon** — 90s neon colors with maximum saturation

### Dark/Light Modes
- **Dark** (default) — Slate-based: surface `#1D2026`, text `#B0B8C4`
- **Light** — Gray-based: surface `#F3F4F6`, text `#374151`
- Applied via `.theme-dark` / `.theme-light` on root div (Index.tsx)
- All button skins have dark & light CSS variants

### Animation Intensity Presets (3 levels)
- **Low** — Subtle: hoverScale 1.08, selectionScale [1, 0.95, 1], duration 80ms
- **Medium** (default) — Balanced: hoverScale 1.25, selectionScale [1, 0.6, 1], duration 120ms
- **High** — Playful: hoverScale 1.4, selectionScale [1, 0.5, 1], duration 150ms

## TODO: Future Work
- Landing page buttons (CTA + System Tray) should respect colorPalette selection
- Consider extracting DRAWING_TOOLS to a shared constant
- Add real tests for hotkey parsing, scale calculations, color remap logic, eraser masking
