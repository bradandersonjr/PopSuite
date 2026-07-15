# PopSuite

PopSuite ships two utilities — **PopJot** (screen annotation) and **PopKey**
(keystroke/mouse visualizer) — that share a common UI/runtime foundation and are
distributed as a single desktop install. The repo produces three surfaces from
one codebase:

1. **PopSuite desktop app** — the only shipped desktop deliverable. One Electron
   runtime (app/) owns two independent PopJot and PopKey overlay windows under a
   single unified tray. The tools share a process, not a window or renderer.
   See app/README.md for the architecture.
2. **One website** — [popsuite.app](https://popsuite.app), a static Vite build
   of the `site/` workspace that mounts BOTH apps' live demo engines on one
   page (each individually toggleable), deployed from this repo via Cloudflare
   Pages. The old per-app domains (popjot.app, popkey.app) now serve redirects
   to popsuite.app (see `site/DEPLOY.md`).
3. **Chromium extensions** — `app/modules/popjot/extension/` and
   `app/modules/popkey/extension/`, parked/dormant but buildable
   (`build:extension` per module).

PopSuite is the parent brand; PopJot and PopKey are its two child apps.

- **[PopJot](app/modules/popjot/README.md)** — screen annotation that stays out of your way: a transparent overlay with a radial tool menu and a freehand drawing canvas.
- **[PopKey](app/modules/popkey/README.md)** — keystrokes worth noticing: an on-screen keystroke and mouse-action visualizer for screencasts and demos.

Both apps are built with Electron + React + Vite + Tailwind + Zustand and consume shared code from **`shared/`**.

## Download and install

Grab the latest build from the
**[GitHub releases page](https://github.com/bradandersonjr/PopSuite/releases/latest)**,
or read more at **[popsuite.app](https://popsuite.app)**. One install gives you
both PopJot and PopKey under a single tray.

### Platform support

- **Windows** — the installer is **unsigned** for now, so SmartScreen may warn
  on first run — choose **More info > Run anyway**. It installs like any normal
  Windows app and auto-updates in the background.
- **macOS and Linux** — builds are provided but are **currently untested** on
  real hardware, and they are **unsigned**. First-launch caveats: on macOS,
  right-click (or Control-click) the app and choose **Open** (a normal
  double-click is blocked by Gatekeeper); on Linux, make the AppImage executable
  with `chmod +x` before running it. Auto-update is disabled on these unsigned
  builds — use **Check for Updates** from the tray to update manually. Reports
  welcome.

PopSuite is a single git repository managed as an **npm workspace**. `shared/`, `app/`, `app/modules/popjot/`, and `app/modules/popkey/` are all members of one repo; there are no submodules and no separate copies of the shared code. The desktop app (`app/`) is the master; PopJot and PopKey are its child modules under `app/modules/`.

## Layout

```
PopSuite/                 # single git repo + npm workspace root
|-- app/                  # PopSuite desktop runtime, module windows, and electron-builder config
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
npm run dev          # runs the popsuite.app site dev server (both engines)
npm run build        # builds the popsuite.app site (site/dist)
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
| `dev` / `dev:site` | popsuite.app site dev server (both live engines) |
| `build` / `build:site` | Builds the popsuite.app site (`site/dist`) |
| `preview:site` | Serves the built `site/dist` locally |
| `build:popjot` / `build:popkey` | Emits the redirect-only dist (`app/modules/<app>/dist`) that popjot.app / popkey.app publish to bounce visitors to popsuite.app |
| `dev:module:popjot` / `dev:module:popkey` | Run that app's Electron desktop build standalone (dev) |
| `dev:suite` | Both modules' Electron dev servers under `app/`'s own configs, in parallel |
| `dev:launcher` | Runs the suite launcher/tray-owner process (`app/`) in dev |
| `build:suite` | Builds the suite (launcher + both module bundles) |
| `typecheck:suite` | Typechecks the `app/` package |
| `package:suite` | Builds and packages the PopSuite desktop installer for Windows (NSIS) |
| `publish:suite` | Builds and publishes the Windows installer to GitHub Releases |
| `publish:suite:mac` / `publish:suite:linux` | Builds and publishes the (unsigned, untested) macOS dmg / Linux AppImage |
| `guard:pro` | Fails if real Pro code leaked into a module's public `src/pro/index.ts` stub |
| `typecheck` | Typechecks PopJot, PopKey, suite, and site, in parallel |
| `lint` | Lints PopJot, PopKey, and site, in parallel |
| `test` | Runs PopJot and PopKey's test suites, in parallel |
| `verify` | `guard:pro` + `typecheck` + `lint` + `test` |

## The suite (single desktop install)

The app/ package builds one Electron desktop runtime. It creates two independent
native BrowserWindows: one for PopJot and one for PopKey. Each window has its own
preload, renderer, persistent Chromium session partition, namespaced IPC channels,
focus policy, and mouse-input policy. Sharing the Electron main process does not
flatten the tools into one overlay.

The same runtime also owns the unified tray, updater, and tabbed Settings shell.
PopJot and PopKey report state independently to the suite coordinator, so their
enable toggles, shortcuts, settings, and overlay lifecycles remain separate.
PopJot annotation state still suppresses PopKey temporarily and restores the
previous PopKey state afterward.

The public website is a single static Vite build (the `site/` workspace) that
mounts both apps' live demo engines on one page; popjot.app and popkey.app
redirect to it. Standalone per-module Electron development commands also remain
available for isolating and debugging one tool at a time.

Per-app standalone installers (`PopJot.exe` / `PopKey.exe` as separate products)
are **deprecated**; their packaging scripts and workflows were removed. Desktop
distribution is exclusively through the suite build (`package:suite` locally
builds the Windows installer; the CI release workflow additionally builds and
publishes an unsigned macOS dmg and Linux AppImage — see
[`.github/workflows/release.yml`](.github/workflows/release.yml)). Standalone
Electron builds survive only as a **dev workflow** (`dev:module:*`, or
`dev:electron` inside each app) and as the pipe-fallback mode described above.

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
  modal). The `site/` workspace supplies merged PopSuite content and theme
  styling and mounts both apps' engines; per-app `WebRoot.tsx` files were
  retired in favor of the single site.
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

Shared tests live in `shared/src/test` and run inside each module via Vitest (`npm run test` per module).

## Quality gates

Run across both modules from the repo root, or per module with `--prefix app/modules/popjot` / `--prefix app/modules/popkey` (add `--prefix app` for the suite's own typecheck):

```sh
npm run guard:pro   # Pro-stub guard (PopJot, PopKey)
npm run typecheck   # tsc --noEmit (PopJot, PopKey, suite, site; clean)
npm run lint        # eslint      (PopJot, PopKey, site; 0 errors)
npm run test        # vitest      (PopJot, PopKey)
npm run verify      # guard:pro + typecheck + lint + test
```

`guard:pro` fails if real Pro code is present in a module's public
`src/pro/index.ts` stub (the real implementation lives outside this public repo).
It runs first in `verify`, which `.github/workflows/release.yml` runs before
packaging so a leak can never ship.
