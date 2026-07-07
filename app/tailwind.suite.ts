/**
 * Suite Tailwind config.
 *
 * The apps' shared preset resolves its `content` globs against process.cwd(),
 * which during the suite build is suite/ — the wrong root. This config reuses
 * the same visual preset (colors, fonts, plugins) but rewrites `content` to
 * ABSOLUTE globs covering both app sources plus pop-shared, so classes like
 * `border-border` are generated no matter which module's renderer is building.
 */

import type { Config } from "tailwindcss";
import { resolve } from "path";
import preset from "../pop-shared/config/tailwind-preset";

const REPO_ROOT = resolve(__dirname, "..");
const g = (p: string) => resolve(REPO_ROOT, p).replace(/\\/g, "/");

const config: Config = {
  ...preset,
  content: [
    g("PopJot/index.html"),
    g("PopJot/src/**/*.{ts,tsx}"),
    g("PopKey/index.html"),
    g("PopKey/src/**/*.{ts,tsx}"),
    g("pop-shared/src/**/*.{ts,tsx}"),
  ],
};

export default config;
