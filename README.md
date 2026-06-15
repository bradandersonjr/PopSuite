# PopSuite

PopSuite is a monorepo of two desktop-first Electron utilities that share a common UI/runtime foundation:

- **[PopJot](PopJot/README.md)** — screen-annotation overlay with a radial tool menu and freehand drawing canvas.
- **[PopKey](PopKey/README.md)** — on-screen keystroke & mouse-action visualizer for screencasts and demos.

Both apps are built with Electron + React + Vite + Tailwind + Zustand and consume shared code from **`pop-shared`**.

PopSuite is a single git repository managed as an **npm workspace**. `pop-shared/`, `PopJot/`, and `PopKey/` are all members of one repo; there are no submodules and no separate copies of the shared code.

## Layout

```
PopSuite/             # single git repo + npm workspace root
├── pop-shared/       # THE shared foundation (one copy, consumed by both apps)
│   ├── src/          # runtime code (see "Shared architecture" below)
│   ├── config/       # vite/electron-vite/vitest/tailwind/eslint/postcss presets
│   ├── tsconfig/     # base tsconfigs (app / electron / node)
│   └── scripts/      # extension build scripts (build-content, pack-extension)
├── PopJot/           # annotation app — unique src/ + thin configs → ../pop-shared
├── PopKey/           # input-visualizer app — unique src/ + thin configs → ../pop-shared
├── node_modules/     # hoisted: shared by pop-shared + both apps
└── package.json      # workspace config + orchestration scripts (concurrently)
```

## Getting started

One install at the repo root hoists all dependencies into a single `node_modules`
shared by `pop-shared` and both apps:

```sh
npm install          # one hoisted workspace install for everything
npm run dev          # runs PopJot + PopKey dev servers in parallel
npm run build        # builds both
npm run dev:popjot   # single app
```

To run a single app's desktop build directly:

```sh
npm run dev:electron --prefix PopJot
npm run dev:electron --prefix PopKey
```

## Shared architecture (`pop-shared`)

Shared code lives in **`pop-shared/`** at the repo root and is consumed by each app
via the `../pop-shared` relative path and the `@shared/*` import alias. Inside shared
code, `@/*` resolves to the **consuming app's** `src/` — this is intentional, so shared
roots and components can bind to each app's own `store`, `engine`, and `SystemTray`.

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
  are thin re-exports pointing at `../pop-shared`; only the dev port and extension
  popup global differ. Shared config/script paths resolve the app root from
  `process.cwd()` and reach `pop-shared` as a sibling.

`pop-shared/` is a normal directory in this repo (an npm workspace member), not a
submodule. It is the single source of truth for shared code — one on-disk copy, no
copy/sync step, no submodule pointers to bump.

### Working on shared code

Just edit files under `pop-shared/src` (or its `config/`, `scripts/`). Because both
apps import the same directory, every app sees the change immediately — no commit
dance, no pointer bump. Re-run the quality gates and commit once in this repo.

> App-specific tests live in each app's own `src/` (e.g. `src/store/useStore.test.ts`); only app-agnostic tests belong in `pop-shared/src/test`.

## Testing

Shared tests live in `pop-shared/src/test` and run inside each app via Vitest (`npm run test` per app). See the per-app `AUDIT.md` for current test-wiring status.

## Quality gates

Run across both apps from the repo root, or per app with `--prefix PopJot` / `--prefix PopKey`:

```sh
npm run typecheck   # tsc --noEmit (both apps; clean)
npm run lint        # eslint      (both apps; 0 errors)
npm run test        # vitest      (both apps)
npm run verify      # typecheck + lint + test
npm run build       # vite build  (each app's website → dist/)
```

`vite build` does not typecheck, so `typecheck` is a separate gate. Each app's
`build` also runs a `prebuild` Pro-stub guard (`guard:pro`) that fails the build
if real Pro code is present in the public source. CI (`.github/workflows/ci.yml`
in each app repo) runs the full gate — guard, typecheck, lint, test, build — on
every push and PR.
