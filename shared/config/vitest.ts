import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { aliases } from "./vite";

/** Shared Vitest config (vitest.config.ts). */
export function createVitestConfig({ root }: { root: string }) {
  // pop-shared is a sibling of the app, so its tests/setup live outside the app
  // root. Use an absolute POSIX glob (fast-glob/tinyglobby reject leading "../").
  const sharedSrc = path.resolve(root, "../pop-shared/src").replace(/\\/g, "/");
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
      alias: aliases(root),
    },
  });
}
