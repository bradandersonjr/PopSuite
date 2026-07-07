# Deploying popkey.app (Cloudflare Pages)

The website is the **free** PopKey landing page — a static Vite build.

## One-time setup

> **Monorepo note:** PopKey now lives in the single **PopSuite** repo and imports
> shared code from the sibling `pop-shared/` directory (no git submodule). The
> landing page build therefore needs the whole PopSuite repo and a workspace
> install at the repo root — deploy from the PopSuite repo, not a standalone PopKey
> checkout.

### 1. Create the Cloudflare Pages project
Connect the **PopSuite** repo and use:

| Setting              | Value                  |
| -------------------- | ---------------------- |
| Framework preset     | None                   |
| Build command        | `npm run build:popkey` |
| Build output dir     | `PopKey/dist`          |
| Root directory       | `/` (PopSuite repo root) |
| Node version         | 20 (set `NODE_VERSION=20` env var) |

Cloudflare runs `npm install` at the repo root, which hoists all workspace
dependencies into one `node_modules` shared by `pop-shared` and both apps. No
submodule fetch step is involved.

SPA routing is handled by `public/_redirects` (`/* /index.html 200`).

### 2. Custom domain
Add **popkey.app** under the Pages project → Custom domains.

## Local sanity check
```bash
npm run build:popkey               # from the PopSuite repo root → PopKey/dist
npm run preview --prefix PopKey    # serves PopKey/dist locally to verify
```

## Pro
PopKey has no Pro features yet. If/when it gets them, follow the same open-core
pattern as PopJot: a public **stub** `src/pro/index.ts`, with the real
implementation kept private (see `../private/README.md`).
