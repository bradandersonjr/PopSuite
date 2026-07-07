/**
 * Ambient declarations for the app register() entry points as seen from the
 * suite package.
 *
 * The app sources use a `@/` alias that points at their OWN src, and PopJot and
 * PopKey each define it to a different directory. A single suite tsconfig can't
 * map `@/` to both, so instead of pulling the app register bodies into the
 * suite's type graph (each app already typechecks its own register.ts under its
 * own tsconfig), we declare just the signatures the suite consumes. `layout` is
 * intentionally loose here — createPopApp validates the real shape.
 */

declare module "@popjot/main/register" {
  export function registerPopJot(layout?: unknown): void;
}

declare module "@popkey/main/register" {
  export function registerPopKey(layout?: unknown): void;
}
