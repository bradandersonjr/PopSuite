import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react-swc";
import { aliases } from "./vite";

/** Shared electron-vite config (electron.vite.config.ts). */
export function createElectronConfig({ root, moduleAlias }: { root: string; moduleAlias: string }) {
  return defineConfig({
    main: {
      plugins: [externalizeDepsPlugin()],
      resolve: {
        alias: aliases(root, moduleAlias),
      },
      build: {
        outDir: "out/main",
        lib: {
          entry: "src/main/index.ts",
        },
        rollupOptions: {
          output: {
            format: "cjs",
          },
        },
      },
    },
    preload: {
      plugins: [externalizeDepsPlugin()],
      resolve: {
        alias: aliases(root, moduleAlias),
      },
      build: {
        outDir: "out/preload",
        lib: {
          entry: "src/preload/index.ts",
        },
        rollupOptions: {
          output: {
            format: "cjs",
          },
        },
      },
    },
    renderer: {
      root: ".",
      build: {
        outDir: "out/renderer",
        rollupOptions: {
          input: "./index.html",
        },
      },
      plugins: [react()],
      define: {
        __IS_DESKTOP__: JSON.stringify(true),
      },
      resolve: {
        alias: aliases(root, moduleAlias),
      },
    },
  });
}
