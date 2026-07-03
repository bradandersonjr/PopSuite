# PopKey — Audit

**Date:** 2026-05-30
**Scope:** PopKey app (`src/`) + consumed `pop-shared` foundation (sibling dir in the PopSuite workspace).

PopKey is the on-screen input-visualizer app of the PopSuite monorepo: it captures global keyboard/mouse events (`uiohook-napi`) and renders key badges, a modifier bar, click ripples, and a scroll indicator over the screen.

## Snapshot

| Metric | Value |
|--------|-------|
| App source | ~3,700 LOC TS/TSX |
| Largest files | `SystemTray.tsx` (818), `WebRoot.tsx` (639), `useInputCapture.ts` (479), `main/index.ts` (464) |
| Lint | 0 errors; 1 warning (shared `button.tsx` fast-refresh) |
| Tests | 9 passing across 3 files (`scale`, `hotkeys`, `store`) |

## Findings

### 1. Test suite does not execute (Resolved 2026-05-30)
Same root cause as PopJot: `vitest.config.ts` had pointed `include`/`setupFiles` at `src/` while tests live in the submodule at `shared/src/test/`. Additionally, the shared `example.test.ts` asserted **PopJot** store actions (`triggerClearCanvas`, `adjustToolSize`) absent from PopKey's store. Fixed: config now scans `{src,shared/src}/**`; app-agnostic hotkey/scale tests stay shared; a PopKey-specific store test lives at `src/store/useStore.test.ts`. `npm test` now runs 9 tests green.

### 2. Lint warnings (Resolved 2026-05-30)
The 9 app-side warnings were cleared: removed unused vars in `SystemTray.tsx`/`WebRoot.tsx`, and **fixed the `react-hooks/exhaustive-deps` stale-closure** at `SystemTray.tsx:178` by adding `setScaleFactorLocal`. One pre-existing warning remains in the shared `button.tsx` (shadcn `buttonVariants` exported alongside the component) — fix belongs in `pop-shared`.

### 3. Default-hotkey inconsistency (Resolved 2026-07-02)
The main process owns the global accelerator (`Alt+Shift+K` / `Cmd+Shift+K`), while `src/store/useStore.ts` had initialized `hotkey` to `Alt + Shift + A`. On desktop the store value is overwritten by the synced accelerator, but the pre-sync placeholder briefly showed the wrong key. Fixed: the store default now matches the main default (`Alt+Shift+K` / `Cmd+Shift+K`).

### 4. Documentation drift (Resolved)
The previous `README.md` and `AUDIT.md` were copies of PopJot/"QuickInk" docs and described a screen-annotation tool, not PopKey. Both have been rewritten to describe the actual app.

## Strengths

- Clean separation of native capture (`main/inputCapture.ts`) from renderer presentation (`InputHUD` + visualizer components).
- Rich, well-typed settings store; tray and renderer kept in sync via typed IPC.
- Shared UI/lib/config consumed from the `pop-shared` foundation (`../pop-shared`).

## Recommended next steps

1. Add coverage for the `useInputCapture` badge lifecycle (test wiring is now working).
2. Move the shared `button.tsx` `buttonVariants` export to its own module in `pop-shared`.
