# Deploying popkey.app (Cloudflare Pages)

The website is the **free** PopKey landing page — a static Vite build.

> **ACTION REQUIRED (repo restructure):** PopKey now lives at
> `app/modules/popkey/` inside the PopSuite repo (was top-level `PopKey/`). The
> `npm run build:popkey` command name is UNCHANGED, but its output directory
> moved from `PopKey/dist` to **`app/modules/popkey/dist`**. You MUST update the
> Cloudflare Pages **build output directory** setting to the new path or the next
> deploy will publish nothing / fail. Build command and root directory are
> unchanged.

## One-time setup

> **Monorepo note:** PopKey lives in the single **PopSuite** repo and imports
> shared code from `shared/` at the repo root via the `@shared` alias (no git
> submodule). The landing page build therefore needs the whole PopSuite repo and
> a workspace install at the repo root — deploy from the PopSuite repo, not a
> standalone PopKey checkout.

### 1. Create the Cloudflare Pages project
Connect the **PopSuite** repo and use:

| Setting              | Value                        |
| -------------------- | ---------------------------- |
| Framework preset     | None                         |
| Build command        | `npm run build:popkey`       |
| Build output dir     | `app/modules/popkey/dist`    |
| Root directory       | `/` (PopSuite repo root)     |
| Node version         | 20 (set `NODE_VERSION=20` env var) |

Cloudflare runs `npm install` at the repo root, which hoists all workspace
dependencies into one `node_modules` shared by `shared/` and both app modules.
No submodule fetch step is involved.

SPA routing is handled by `public/_redirects` (`/* /index.html 200`).

### 2. Custom domain
Add **popkey.app** under the Pages project → Custom domains.

## Local sanity check
```bash
npm run build:popkey                          # from repo root → app/modules/popkey/dist
npm run preview --prefix app/modules/popkey   # serves the dist locally to verify
```

## Pro
PopKey has no Pro features yet. If/when it gets them, follow the same open-core
pattern as PopJot: a public **stub** `src/pro/index.ts`, with the real
implementation kept private (see `../private/README.md`).
