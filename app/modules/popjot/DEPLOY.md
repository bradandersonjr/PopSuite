# Deploying popjot.app (Cloudflare Pages)

The website is the **free** PopJot landing page — a static Vite build. Pro is a
paid desktop download, never part of this build (see "Pro" below).

> **ACTION REQUIRED (repo restructure):** PopJot now lives at
> `app/modules/popjot/` inside the PopSuite repo (was top-level `PopJot/`). The
> `npm run build:popjot` command name is UNCHANGED, but its output directory
> moved from `PopJot/dist` to **`app/modules/popjot/dist`**. You MUST update the
> Cloudflare Pages **build output directory** setting to the new path or the next
> deploy will publish nothing / fail. Build command and root directory are
> unchanged.

## One-time setup

> **Monorepo note:** PopJot lives in the single **PopSuite** repo and imports
> shared code from `shared/` at the repo root via the `@shared` alias (no git
> submodule). The landing page build therefore needs the whole PopSuite repo and
> a workspace install at the repo root — deploy from the PopSuite repo, not a
> standalone PopJot checkout.

### 1. Create the Cloudflare Pages project
Connect the **PopSuite** repo and use:

| Setting              | Value                        |
| -------------------- | ---------------------------- |
| Framework preset     | None                         |
| Build command        | `npm run build:popjot`       |
| Build output dir     | `app/modules/popjot/dist`    |
| Root directory       | `/` (PopSuite repo root)     |
| Node version         | 20 (set `NODE_VERSION=20` env var) |

Cloudflare runs `npm install` at the repo root, which hoists all workspace
dependencies into one `node_modules` shared by `shared/` and both app modules.
No submodule fetch step is involved.

SPA routing is already handled by `public/_redirects` (`/* /index.html 200`).

### 2. Custom domain
Add **popjot.app** under the Pages project → Custom domains.

## Local sanity check
```bash
npm run build:popjot                          # from repo root → app/modules/popjot/dist
npm run preview --prefix app/modules/popjot   # serves the dist locally to verify
```

## Pro (do not ship from this repo)
This public repo contains only a **stub** at `src/pro/index.ts` (`IS_PRO = false`,
all features no-op). The real Pro implementation lives privately and is swapped in
only to build the paid desktop binaries. See the private implementation repo.
Never commit real Pro logic to this repo.
