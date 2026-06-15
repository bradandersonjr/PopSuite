# PopJot — Audit

**Date:** 2026-05-30
**Scope:** PopJot app (`src/`) + consumed `pop-shared` foundation (sibling dir in the PopSuite workspace).

PopJot is the screen-annotation app of the PopSuite monorepo: a transparent Electron overlay with a radial tool menu and a pointer-driven drawing canvas (perfect-freehand strokes, eraser masking, temporary vs. persistent modes).

## Snapshot

| Metric | Value |
|--------|-------|
| App source | ~6,400 LOC TS/TSX |
| Largest files | `Canvas.tsx` (1,426), `SystemTray.tsx` (1,059), `WebRoot.tsx` (824), `RadialMenu.tsx` (675) |
| Lint | 0 errors; 1 warning (shared `button.tsx` fast-refresh) |
| Tests | 9 passing across 3 files (`scale`, `hotkeys`, `store`) |

## Findings

### 1. Test suite does not execute (Resolved 2026-05-30)
`vitest.config.ts` had pointed `include`/`setupFiles` at `src/`, but tests + `setup.ts` live in the `pop-shared` submodule at `shared/src/test/`, so `vitest run` found no files and `npm test` was a no-op. Fixed: config now scans `{src,shared/src}/**` with the correct `setupFiles` and a `@shared` alias; the shared `scale.test.ts` alias was corrected; app-specific store tests moved to `src/store/useStore.test.ts`. `npm test` now runs 9 tests green.

### 2. Large components (Medium)
`Canvas.tsx` (drawing engine + pointer state machine) and `SystemTray.tsx` (settings surface) are large enough to warrant decomposition for testability and review ergonomics. Not urgent; both are cohesive.

### 3. Documentation drift (Resolved)
The previous version of this file was a copy of a different app's ("QuickInk") audit and did not describe PopJot. Replaced with this document.

## Strengths

- Clean lint, strict TS (`noUnusedLocals`, `noImplicitAny`, `strictNullChecks`).
- Clear separation: main process, preload IPC bridge, renderer roots, engine shell, store.
- Shared UI/lib/config consumed from the `pop-shared` foundation (`../pop-shared`) rather than duplicated by hand.

## Recommended next steps

1. Add coverage for the Canvas state machine and radial-selection timing (test wiring is now working).
2. Consider splitting `Canvas.tsx` along stroke-rendering vs. input-handling seams.
