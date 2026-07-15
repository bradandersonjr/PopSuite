# Deploying popsuite.app (Cloudflare Pages)

The PopSuite website is the single public marketing site. It is a static Vite
build of the `site/` workspace that mounts BOTH apps' live demo engines (PopJot
and PopKey) on one page, each individually toggleable — mirroring the desktop
suite. It replaces the two former per-app sites; popjot.app and popkey.app now
redirect here (see "The two redirect domains" below).

Pro is a paid desktop download, never part of this build.

## One-time setup

> **Monorepo note:** The site lives in the single **PopSuite** repo and imports
> both app modules (`app/modules/popjot`, `app/modules/popkey`) plus `shared/`.
> The build therefore needs the whole repo and a workspace install at the repo
> root — deploy from the PopSuite repo root.

### 1. Create the Cloudflare Pages project

Connect the **PopSuite** repo and use:

| Setting          | Value                              |
| ---------------- | ---------------------------------- |
| Framework preset | None                               |
| Build command    | `npm run build:site`               |
| Build output dir | `site/dist`                        |
| Root directory   | `/` (PopSuite repo root)           |
| Node version     | 20 (set `NODE_VERSION=20` env var) |

Cloudflare runs `npm install` at the repo root, which hoists all workspace
dependencies into one `node_modules` shared by `shared/`, both modules, and the
site. No submodule fetch step is involved.

SPA routing (`/docs`, `/privacy`, `/terms`, `/changelog`) is handled by
`site/public/_redirects` (`/* /index.html 200`).

### 2. Custom domain

Add **popsuite.app** under the Pages project → Custom domains.

## The two redirect domains (popjot.app / popkey.app)

The existing `popjot.app` and `popkey.app` Cloudflare Pages projects stay in
place. Their build commands and output directories are UNCHANGED
(`npm run build:popjot` → `app/modules/popjot/dist`,
`npm run build:popkey` → `app/modules/popkey/dist`), but those commands now emit
a tiny redirect-only dist instead of a full site:

- `_redirects` — `/*  https://popsuite.app/:splat  301` (Cloudflare edge 301,
  preserving the path)
- `index.html` — a meta-refresh + canonical fallback to https://popsuite.app

Nothing to change in those two dashboards — keep their build command, output
dir, and custom domains as they are. The next deploy publishes the redirect.

## Local sanity check

```bash
npm run build:site      # from repo root → site/dist
npm run preview:site    # serves site/dist locally to verify

# redirect builds
npm run build:popjot    # → app/modules/popjot/dist (_redirects + fallback)
npm run build:popkey    # → app/modules/popkey/dist
```
