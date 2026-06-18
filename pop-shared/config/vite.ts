import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

/**
 * Shared Vite config factories for PopSuite apps.
 * Each app's root config file is a thin call into one of these,
 * passing only what genuinely differs between apps.
 */

export interface WebConfigOptions {
  /** App root directory (pass __dirname from the app's config file). */
  root: string;
  /** Dev-server port — must differ per app so both can run concurrently. */
  port: number;
}

/** Web/landing-page build + dev server (vite.config.mts). */
export function createWebConfig({ root, port }: WebConfigOptions) {
  return defineConfig(({ mode }) => {
    const isDesktop = mode === "desktop";

    return {
      base: isDesktop ? "./" : "/",
      // Limit dependency scanning to the app entry so generated `out/renderer/*.html`
      // files do not get treated as dev entries.
      optimizeDeps: {
        entries: ["index.html"],
      },
      define: {
        __IS_DESKTOP__: JSON.stringify(isDesktop),
      },
      server: {
        host: "::",
        port,
        hmr: {
          overlay: false,
        },
      },
      plugins: [react()],
      resolve: {
        alias: aliases(root),
      },
      build: {
        // Split heavy, rarely-changing vendors into their own cacheable chunks
        // instead of one large app bundle. Keeps the entry chunk small and lets
        // returning visitors reuse cached vendor code across deploys.
        rollupOptions: {
          output: {
            manualChunks: {
              react: ["react", "react-dom"],
              motion: ["framer-motion"],
              icons: ["lucide-react"],
            },
          },
        },
      },
    };
  });
}

export interface ExtensionConfigOptions {
  root: string;
  /** IIFE global for the popup bundle, e.g. "PopJotPopup". */
  popupGlobalName: string;
}

/**
 * Browser-extension popup bundle (vite.extension.config.ts).
 * Builds the popup IIFE bundle only. The content script is built separately
 * by shared/scripts/build-content.mjs (esbuild), which avoids Rollup TDZ
 * issues with Framer Motion in IIFE format.
 */
export function createExtensionConfig({ root, popupGlobalName }: ExtensionConfigOptions) {
  const outDir = path.resolve(root, "dist-extension");

  return defineConfig(() => ({
    define: {
      __IS_DESKTOP__: false,
      __IS_EXTENSION__: true,
      // React and other deps reference process.env.NODE_ENV at runtime.
      // In IIFE lib mode Vite doesn't inject this automatically — define it.
      "process.env.NODE_ENV": JSON.stringify("production"),
    },
    plugins: [react()],
    resolve: {
      alias: aliases(root),
    },
    build: {
      outDir,
      emptyOutDir: true,
      lib: {
        entry: path.resolve(root, "../pop-shared/src/extension/popup.tsx"),
        name: popupGlobalName,
        formats: ["iife" as const],
        fileName: () => "popup.js",
      },
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
          assetFileNames: (assetInfo: { name?: string }) =>
            assetInfo.name === "style.css" ? "popup.css" : "[name][extname]",
        },
      },
    },
  }));
}

export function aliases(root: string): Record<string, string> {
  // Apps live as siblings under the workspace root (PopKey/, PopJot/, PopSuite/,
  // pop-shared/). Resolve every package's alias against that shared parent so the
  // mapping is identical no matter which app is doing the building.
  const apps = path.resolve(root, "..");
  return {
    // "@" = the app currently being built. Shared code (pop-shared) uses it to
    // reach into the consuming app's store/components (extension roots,
    // animations). Each app's OWN source uses its namespaced alias below so it
    // stays self-consistent even when another app (PopSuite) composes it.
    "@": path.resolve(root, "./src"),
    "@shared": path.resolve(apps, "pop-shared/src"),
    "@keys": path.resolve(apps, "PopKey/src"),
    "@jot": path.resolve(apps, "PopJot/src"),
    "@suite": path.resolve(apps, "PopSuite/src"),
  };
}
