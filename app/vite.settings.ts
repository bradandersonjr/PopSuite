import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";
import { resolve } from "path";
import suiteTailwindConfig from "./tailwind.suite";

const MODULES_ROOT = resolve(__dirname, "modules");

function moduleLocalAlias(): Plugin {
  return {
    name: "module-local-alias",
    enforce: "pre",
    async resolveId(source, importer) {
      if (!importer || !source.startsWith("@/")) return null;
      const normalized = importer.replace(/\\/g, "/");
      const moduleId = normalized.includes("/modules/popjot/")
        ? "popjot"
        : normalized.includes("/modules/popkey/")
          ? "popkey"
          : null;
      if (!moduleId) return null;

      return this.resolve(
        resolve(MODULES_ROOT, `${moduleId}/src`, source.slice(2)),
        importer,
        { skipSelf: true },
      );
    },
  };
}

export default defineConfig({
  base: "./",
  root: resolve(__dirname, "src/settings"),
  plugins: [moduleLocalAlias(), react()],
  css: {
    postcss: {
      plugins: [tailwindcss(suiteTailwindConfig), autoprefixer()],
    },
  },
  define: {
    __IS_DESKTOP__: JSON.stringify(true),
  },
  resolve: {
    alias: {
      "@shared": resolve(__dirname, "../shared/src"),
      "@popjot": resolve(MODULES_ROOT, "popjot/src"),
      "@popkey": resolve(MODULES_ROOT, "popkey/src"),
    },
  },
  build: {
    outDir: resolve(__dirname, "out/renderer/settings"),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, "src/settings/index.html"),
    },
  },
});
