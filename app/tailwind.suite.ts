/**
 * Suite Tailwind config.
 *
 * The apps' shared preset resolves its `content` globs against process.cwd(),
 * which during the suite build is app/ — the wrong root. This config reuses
 * the same visual preset (colors, fonts, plugins) but rewrites `content` to
 * ABSOLUTE globs covering both app module sources plus shared/, so classes like
 * `border-border` are generated no matter which module's renderer is building.
 */

import type { Config } from "tailwindcss";
import { resolve } from "path";
import preset from "../shared/config/tailwind-preset";

const REPO_ROOT = resolve(__dirname, "..");
const g = (p: string) => resolve(REPO_ROOT, p).replace(/\\/g, "/");

const config: Config = {
  ...preset,
  content: [
    g("app/src/settings/**/*.{html,ts,tsx}"),
    g("app/modules/popjot/index.html"),
    g("app/modules/popjot/src/**/*.{ts,tsx}"),
    g("app/modules/popkey/index.html"),
    g("app/modules/popkey/src/**/*.{ts,tsx}"),
    g("shared/src/**/*.{ts,tsx}"),
  ],
};

export default config;
