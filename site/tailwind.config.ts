/**
 * Site Tailwind config.
 *
 * The PopSuite marketing site mounts both app modules' engines and settings
 * panels on one page, so classes originate from site/src, both module sources,
 * and shared/. The shared preset resolves its content globs against
 * process.cwd() (the site root), which is the wrong root for the other trees,
 * so this config reuses the visual preset but rewrites `content` to ABSOLUTE
 * globs covering every source that contributes markup.
 */

import type { Config } from "tailwindcss";
import { resolve } from "path";
import preset from "../shared/config/tailwind-preset";

const REPO_ROOT = resolve(__dirname, "..");
const g = (p: string) => resolve(REPO_ROOT, p).replace(/\\/g, "/");

const config: Config = {
  ...preset,
  content: [
    g("site/index.html"),
    g("site/src/**/*.{ts,tsx}"),
    g("app/modules/popjot/src/**/*.{ts,tsx}"),
    g("app/modules/popkey/src/**/*.{ts,tsx}"),
    g("shared/src/**/*.{ts,tsx}"),
  ],
};

export default config;
