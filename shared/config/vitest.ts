import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { aliases } from "./vite";

/** Shared Vitest config (vitest.config.ts). */
export function createVitestConfig({ root, moduleAlias }: { root: string; moduleAlias: string }) {
  // shared/ lives at the repo root; each app module is nested at
  // app/modules/<name>, so shared src is three levels up. Its tests/setup live
  // outside the app root; use an absolute POSIX glob (fast-glob/tinyglobby
  // reject leading "../").
  const sharedSrc = path.resolve(root, "../../../shared/src").replace(/\\/g, "/");
  return defineConfig({
    plugins: [react()],
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: [`${sharedSrc}/test/setup.ts`],
      include: [
        "src/**/*.{test,spec}.{ts,tsx}",
        `${sharedSrc}/**/*.{test,spec}.{ts,tsx}`,
      ],
    },
    resolve: {
      alias: aliases(root, moduleAlias),
    },
  });
}
