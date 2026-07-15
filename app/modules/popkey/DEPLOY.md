# popkey.app — now a redirect

The public website moved to a single site, **popsuite.app**, which hosts both
PopKey and PopJot demos on one page. `popkey.app` is now a redirect to it.

The Cloudflare Pages project for this domain is unchanged:

- Build command: `npm run build:popkey` (unchanged)
- Build output dir: `app/modules/popkey/dist` (unchanged)

`npm run build:popkey` now emits a redirect-only dist (`_redirects` with
`/* https://popsuite.app/:splat 301`, plus a meta-refresh `index.html`) instead
of the old landing page. Keep the custom domain (`popkey.app`) attached.

See **[`site/DEPLOY.md`](../../../site/DEPLOY.md)** for the popsuite.app setup and
the full redirect story.
