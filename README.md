# PopSuite

PopSuite is a monorepo of two desktop-first Electron utilities that share a common UI/runtime foundation:

- **[PopJot](PopJot/README.md)** — screen-annotation overlay with a radial tool menu and freehand drawing canvas.
- **[PopKey](PopKey/README.md)** — on-screen keystroke & mouse-action visualizer for screencasts and demos.

Both apps are built with Electron + React + Vite + Tailwind + Zustand and consume shared code from **`pop-shared`**.

## Layout

```
PopSuite/
├── PopJot/          # annotation app  (Electron + React)
│   └── shared/      # git submodule → pop-shared
├── PopKey/          # input-visualizer app (Electron + React)
│   └── shared/      # git submodule → pop-shared
├── pop-shared/      # shared source of truth (standalone git repo)
│   ├── src/         # runtime code (see "Shared architecture" below)
│   ├── config/      # vite/electron-vite/vitest/tailwind/eslint/postcss presets
│   ├── tsconfig/    # base tsconfigs (app / electron / node)
│   └── scripts/     # extension build scripts (build-content, pack-extension)
└── package.json     # root orchestration scripts (concurrently)
```

## Getting started

Each app installs and runs independently:

```sh
cd PopJot && npm install && npm run dev:electron
cd PopKey && npm install && npm run dev:electron
```

Or drive both from the root:

```sh
npm install          # root only needs `concurrently`
npm run dev          # runs PopJot + PopKey dev servers in parallel
npm run build        # builds both
npm run dev:popjot   # single app
```

## Shared architecture (`pop-shared`)

Shared code lives in **`pop-shared`** and is consumed by each app at `./shared`,
imported via the `@shared/*` path alias. Inside shared code, `@/*` resolves to the
**consuming app's** `src/` — this is intentional, so shared roots and components can
bind to each app's own `store`, `engine`, and `SystemTray`.

The big shared pieces:

- **Settings schema** (`src/settings/`) — each app declares its tray-adjustable
  settings once in `src/config/settingsSchema.ts` (key, type, allowed values,
  default). Everything else is generated from that table: validated main-process
  IPC handlers (`settings/main.ts`), the preload bridge (`settings/preload.ts`),
  renderer send/subscribe helpers (`settings/renderer.ts`), and the Zustand slice
  (`settings/store.ts`). Adding a setting is a one-line schema change.
- **App shell** (`src/main/createPopApp.ts`) — the entire common Electron main
  process: single-instance lock, transparent overlay + settings windows, tray,
  named global shortcuts with rollback, open-at-login, lifecycle. Each app's
  `src/main/index.ts` only contains its unique subsystems (PopJot: screenshot
  capture; PopKey: uiohook input capture).
- **Settings UI kit** (`src/components/settings/`) — option grids, toggles,
  sliders, shortcut recorder, settings-window chrome, at two densities
  (PopJot "comfortable", PopKey "compact"). Both `SystemTray` components are
  built from these primitives.
- **Landing page template** (`src/components/landing/LandingPage.tsx`) — the
  full marketing-page structure (hero/demo/features/how-it-works/settings/
  use-cases/pricing/faq, section scroller, dot nav, FAQ accordion, settings
  modal). Each app's `WebRoot.tsx` supplies only content and theme styling.
- **Build presets** (`config/`, `tsconfig/`, `scripts/`) — per-app config files
  are thin re-exports; only the dev port and extension popup global differ.

`pop-shared` is embedded as a **git submodule** at `PopJot/shared` and
`PopKey/shared` (see each app's `.gitmodules`). This is the single, versioned
source of truth for shared code — there is no separate copy/sync step.

### Working on shared code

1. Edit shared modules in `pop-shared` (the standalone repo) — or directly in an app's `shared/` working tree, which is the same submodule checkout.
2. Commit in `pop-shared`.
3. Update the submodule pointer in each app: `git -C PopJot/shared pull && git -C PopKey/shared pull`, then commit the bumped pointer in each app.

> App-specific tests live in each app's own `src/` (e.g. `src/store/useStore.test.ts`); only app-agnostic tests belong in `pop-shared/src/test`.

## Testing

Shared tests live in `pop-shared/src/test` and run inside each app via Vitest (`npm run test` per app). See the per-app `AUDIT.md` for current test-wiring status.

## Quality gates (per app)

```sh
npm run lint     # eslint
npm run test     # vitest
npm run build    # vite / electron-vite
```

`vite build` does not typecheck; run `npx tsc -p tsconfig.electron.json --noEmit`
(clean) and `npx tsc -p tsconfig.app.json --noEmit` (some pre-existing component
errors remain) for type validation.
