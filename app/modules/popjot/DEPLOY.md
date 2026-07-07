# Deploying popjot.app (Cloudflare Pages)

The website is the **free** PopJot landing page — a static Vite build. Pro is a
paid desktop download, never part of this build (see "Pro" below).

## One-time setup

> **Monorepo note:** PopJot now lives in the single **PopSuite** repo and imports
> shared code from the sibling `pop-shared/` directory (no git submodule). The
> landing page build therefore needs the whole PopSuite repo and a workspace
> install at the repo root — deploy from the PopSuite repo, not a standalone PopJot
> checkout.

### 1. Create the Cloudflare Pages project
Connect the **PopSuite** repo and use:

| Setting              | Value                  |
| -------------------- | ---------------------- |
| Framework preset     | None                   |
| Build command        | `npm run build:popjot` |
| Build output dir     | `PopJot/dist`          |
| Root directory       | `/` (PopSuite repo root) |
| Node version         | 20 (set `NODE_VERSION=20` env var) |

Cloudflare runs `npm install` at the repo root, which hoists all workspace
dependencies into one `node_modules` shared by `pop-shared` and both apps. No
submodule fetch step is involved.

SPA routing is already handled by `public/_redirects` (`/* /index.html 200`).

### 2. Custom domain
Add **popjot.app** under the Pages project → Custom domains.

## Local sanity check
```bash
npm run build:popjot               # from the PopSuite repo root → PopJot/dist
npm run preview --prefix PopJot    # serves PopJot/dist locally to verify
```

## Pro (do not ship from this repo)
This public repo contains only a **stub** at `src/pro/index.ts` (`IS_PRO = false`,
all features no-op). The real Pro implementation lives privately and is swapped in
only to build the paid desktop binaries. See `../private/README.md`.
Never commit real Pro logic to this repo.
