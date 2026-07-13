import { defineConfig } from "vite";
import { builtinModules } from "module";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@shared": resolve(__dirname, "../shared/src"),
      "@popjot": resolve(__dirname, "modules/popjot/src"),
      "@popkey": resolve(__dirname, "modules/popkey/src"),
    },
  },
  build: {
    outDir: resolve(__dirname, "out/main"),
    emptyOutDir: false,
    rollupOptions: {
      input: resolve(__dirname, "src/main/suiteSettings/preload.ts"),
      external: [
        "electron",
        ...builtinModules,
        ...builtinModules.map((module) => "node:" + module),
      ],
      output: {
        format: "cjs",
        entryFileNames: "suiteSettings/preload.js",
        inlineDynamicImports: true,
      },
    },
  },
});