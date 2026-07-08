# PopSuite

PopSuite ships two utilities — **PopJot** (screen annotation) and **PopKey**
(keystroke/mouse visualizer) — that share a common UI/runtime foundation and are
distributed as a single desktop install. The repo produces three surfaces from
one codebase:

1. **PopSuite desktop app** — the only shipped desktop deliverable. One Electron
   binary (`app/`) launches PopJot and PopKey as independent module processes
   under a single unified tray. See [`app/README.md`](app/README.md) for the
   architecture.
2. **Two websites** — [popjot.app](https://popjot.app) and
   [popkey.app](https://popkey.app), static Vite builds of each app's
   `src/roots/WebRoot.tsx`, deployed from this repo via Cloudflare Pages.
3. **Chromium extensions** — `app/modules/popjot/extension/` and
   `app/modules/popkey/extension/`, parked/dormant but buildable
   (`build:extension` per module).

- **[PopJot](app/modules/popjot/README.md)** — screen-annotation overlay with a radial tool menu and freehand drawing canvas.
- **[PopKey](app/modules/popkey/README.md)** — on-screen keystroke & mouse-action visualizer for screencasts and demos.

Both apps are built with Electron + React + Vite + Tailwind + Zustand and consume shared code from **`shared/`**.

PopSuite is a single git repository managed as an **npm workspace**. `shared/`, `app/`, `app/modules/popjot/`, and `app/modules/popkey/` are all members of one repo; there are no submodules and no separate copies of the shared code. The desktop app (`app/`) is the master; PopJot and PopKey are its child modules under `app/modules/`.

## Layout

```
PopSuite/                 # single git repo + npm workspace root
├── app/                  # PopSuite desktop shell — launcher + module entrypoints, electron-builder config
│   └── modules/
│       ├── popjot/       # annotation app — unique src/ + thin configs → ../../../shared
│       └── popkey/       # input-visualizer app — unique src/ + thin configs → ../../../shared
├── shared/               # THE shared foundation (one copy, consumed by both modules + app)
│   ├── src/              # runtime code (see "Shared architecture" below)
│   ├── config/           # vite/electron-vite/vitest/tailwind/eslint/postcss presets
│   ├── tsconfig/         # base tsconfigs (app / electron / node)
│   └── scripts/          # extension build scripts (build-content, pack-extension)
├── node_modules/         # hoisted: shared by shared/, both modules, and app
└── package.json          # workspace config + orchestration scripts (concurrently)
```

> The `shared/` directory keeps the npm package name `pop-shared` (folder renamed, package name unchanged for low churn).

## Getting started

One install at the repo root hoists all dependencies into a single `node_modules`
shared by `shared/`, both modules, and `app`:

```sh
npm install          # one hoisted workspace install for everything
npm run dev          # runs PopJot + PopKey web dev servers in parallel
npm run build        # builds both websites
npm run dev:popjot   # single app's web dev server
```

To run a single app's desktop build directly (dev-only; standalone per-app
installers are no longer shipped, see "The suite" below):

```sh
npm run dev:module:popjot
npm run dev:module:popkey
```

To run both modules together under the suite's own electron-vite config (closer
to how the packaged suite behaves, still without the launcher/tray):

```sh
npm run dev:suite
```

## Scripts

Run from the repo root; each fans out to the relevant workspace member(s) via
`--prefix` or `concurrently`.

| Script | What it does |
| --- | --- |
| `dev` | PopJot + PopKey web dev servers (Vite), in parallel |
| `dev:popjot` / `dev:popkey` | Single app's web dev server |
| `build` | Builds both apps' websites (`app/modules/popjot/dist`, `app/modules/popkey/dist`) |
| `build:popjot` / `build:popkey` | Single app's website build |
| `dev:module:popjot` / `dev:module:popkey` | Run that app's Electron desktop build standalone (dev) |
| `dev:suite` | Both modules' Electron dev servers under `app/`'s own configs, in parallel |
| `build:suite` | Builds the suite (launcher + both module bundles) |
| `typecheck:suite` | Typechecks the `app/` package |
| `package:suite` | Builds and packages the PopSuite desktop installer (Windows NSIS) |
| `typecheck` | Typechecks PopJot, PopKey, and suite, in parallel |
| `lint` | Lints PopJot and PopKey, in parallel |
| `test` | Runs PopJot and PopKey's test suites, in parallel |
| `verify` | `typecheck` + `lint` + `test` |

## The suite (single desktop install)

`app/` builds **one Electron binary** (`PopSuite.exe`) that runs in two modes
from the same executable:

- **Launcher** (`PopSuite.exe`, no args) — a resident, lightweight process that
  owns the single unified system tray icon for the whole product, spawns one
  detached child process per module (`--module=popjot`, `--module=popkey`), and
  stays alive listening on a local named pipe. Each module reports its state
  (active/inactive, shortcut hints, annotating, etc.) over that pipe; the
  launcher builds one dynamic tray menu from whichever modules are currently
  connected and relays clicks back. The launcher owns no overlay/settings
  windows and never touches a module's window/focus/overlay behavior.
- **Module** (`PopSuite.exe --module=<id>`) — boots that module's normal main
  process in this process, with its own userData, its own single-instance lock,
  and its own overlay window — identical to the standalone app. It runs in
  `tray.mode: "reported"`, so it reports to the launcher instead of drawing its
  own OS tray icon.

Cross-module glue lives in the launcher too: PopJot reports when it starts/stops
annotating, and the launcher relays that as an auto-suppress command to PopKey
(so the keystroke overlay hides itself while you're actively drawing, then
restores to whatever state you'd last asked for).

**Resilience:** if the launcher's pipe is unreachable when a module starts (run
directly via `--module=`, or the launcher isn't running) or the connection drops
later (launcher killed/crashed), the module automatically falls back to creating
its own local tray icon — the same code path the standalone apps use. A module
is never left without a tray, and a dropped pipe also clears any active
suppression so a module can't get stuck hidden.

Per-app standalone installers (`PopJot.exe` / `PopKey.exe` as separate products)
are **deprecated**; their packaging scripts and workflows were removed. Desktop
distribution is exclusively through `package:suite`. Standalone Electron builds
survive only as a **dev workflow** (`dev:module:*`, or `dev:electron` inside each
app) and as the pipe-fallback mode described above.

See [`app/README.md`](app/README.md) for build/package details and
[`app/MANUAL_VERIFICATION.md`](app/MANUAL_VERIFICATION.md) for the manual
verification checklist.

## Shared architecture (`shared/`)

Shared code lives in **`shared/`** at the repo root (npm package name `pop-shared`)
and is consumed by each module (and by `app/`) via a relative path (`../../../shared`
from a module, `../shared` from `app/`) and the `@shared/*` import alias. Inside shared
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
  capture; PopKey: uiohook input capture). The tray can run in `"owned"` mode
  (standalone apps, the default) or `"reported"` mode (suite modules report to
  the launcher's unified tray instead of drawing their own).
- **Settings UI kit** (`src/components/settings/`) — option grids, toggles,
  sliders, shortcut recorder, settings-window chrome, at two densities
  (PopJot "comfortable", PopKey "compact"). Both `SystemTray` components are
  built from these primitives.
- **Landing page template** (`src/components/landing/LandingPage.tsx`) — the
  full marketing-page structure (hero/demo/features/how-it-works/settings/
  use-cases/pricing/faq, section scroller, dot nav, FAQ accordion, settings
  modal). Each app's `WebRoot.tsx` supplies only content and theme styling.
- **Build presets** (`config/`, `tsconfig/`, `scripts/`) — per-module config files
  are thin re-exports pointing at `../../../shared`; only the dev port and extension
  popup global differ. Shared config/script paths resolve the module root from
  `process.cwd()` and reach `shared/` three levels up at the repo root.

`shared/` is a normal directory in this repo (an npm workspace member), not a
submodule. It is the single source of truth for shared code — one on-disk copy, no
copy/sync step, no submodule pointers to bump. `app/` consumes it the same way
the two modules do.

### Working on shared code

Just edit files under `shared/src` (or its `config/`, `scripts/`). Because both
modules (and the app) import the same directory, every consumer sees the change immediately — no commit
dance, no pointer bump. Re-run the quality gates and commit once in this repo.

> App-specific tests live in each module's own `src/` (e.g. `src/store/useStore.test.ts`); only app-agnostic tests belong in `shared/src/test`.

## Testing

Shared tests live in `shared/src/test` and run inside each module via Vitest (`npm run test` per module). See the per-module `AUDIT.md` for a point-in-time snapshot of test-wiring status (predates the suite/nest restructure; see its note at the top).

## Quality gates

Run across both modules from the repo root, or per module with `--prefix app/modules/popjot` / `--prefix app/modules/popkey` (add `--prefix app` for the suite's own typecheck):

```sh
npm run typecheck   # tsc --noEmit (PopJot, PopKey, suite; clean)
npm run lint        # eslint      (PopJot, PopKey; 0 errors)
npm run test        # vitest      (PopJot, PopKey)
npm run verify      # typecheck + lint + test
npm run build       # vite build  (each app's website → dist/)
```

`vite build` does not typecheck, so `typecheck` is a separate gate. Each app's
`build` also runs a `prebuild` Pro-stub guard (`guard:pro`) that fails the build
if real Pro code is present in the public source. CI (`.github/workflows/ci.yml`
in each app repo) runs the full gate — guard, typecheck, lint, test, build — on
every push and PR.
