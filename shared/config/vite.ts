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
  /**
   * Module-scoped alias name for this app's own `src`, e.g. "@popjot" or
   * "@popkey". The generic "@" alias is always defined too (pointing at the
   * same directory) for shared/src injection consumers — see aliases().
   */
  moduleAlias: string;
}

/** Web/landing-page build + dev server (vite.config.mts). */
export function createWebConfig({ root, port, moduleAlias }: WebConfigOptions) {
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
        alias: aliases(root, moduleAlias),
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

export interface SiteConfigOptions {
  /** Site root directory (pass __dirname from site/vite.config.mts). */
  root: string;
  /** Dev-server port. */
  port: number;
}

/**
 * Multi-module marketing site build (site/vite.config.mts).
 *
 * The PopSuite site mounts BOTH modules' engines and settings panels on one
 * page, so its build graph spans site/src, both app module srcs, and shared/.
 * Aliases are module-scoped (`@popjot`, `@popkey`, `@shared`, `@site`); there
 * is intentionally NO generic `@` alias here — extension dependency-injection
 * files are not in this graph, so a stray `@/` import would be a bug to scope,
 * not to resolve.
 */
export function createSiteConfig({ root, port }: SiteConfigOptions) {
  const modules = path.resolve(root, "../app/modules");
  return defineConfig(() => ({
    base: "/",
    optimizeDeps: {
      entries: ["index.html"],
    },
    define: {
      __IS_DESKTOP__: JSON.stringify(false),
    },
    server: {
      host: "::",
      port,
      hmr: { overlay: false },
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@popjot": path.resolve(modules, "popjot/src"),
        "@popkey": path.resolve(modules, "popkey/src"),
        "@shared": path.resolve(root, "../shared/src"),
        "@site": path.resolve(root, "./src"),
      },
    },
    build: {
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
  }));
}

export interface ExtensionConfigOptions {
  root: string;
  /** IIFE global for the popup bundle, e.g. "PopJotPopup". */
  popupGlobalName: string;
  /** Module-scoped alias name for this app's own `src`, e.g. "@popjot". */
  moduleAlias: string;
}

/**
 * Browser-extension popup bundle (vite.extension.config.ts).
 * Builds the popup IIFE bundle only. The content script is built separately
 * by shared/scripts/build-content.mjs (esbuild), which avoids Rollup TDZ
 * issues with Framer Motion in IIFE format.
 */
export function createExtensionConfig({ root, popupGlobalName, moduleAlias }: ExtensionConfigOptions) {
  const outDir = path.resolve(root, "dist-extension");

  return defineConfig(() => ({
    // The extension bundle is a lib build; the module `public/` dir holds only
    // web-site assets (favicon) that no extension surface references. Disabling
    // publicDir keeps them out of dist-extension/.
    publicDir: false,
    define: {
      __IS_DESKTOP__: false,
      __IS_EXTENSION__: true,
      // React and other deps reference process.env.NODE_ENV at runtime.
      // In IIFE lib mode Vite doesn't inject this automatically — define it.
      "process.env.NODE_ENV": JSON.stringify("production"),
    },
    plugins: [react()],
    resolve: {
      alias: aliases(root, moduleAlias),
    },
    build: {
      outDir,
      emptyOutDir: true,
      lib: {
        entry: path.resolve(root, "../../../shared/src/extension/popup.tsx"),
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

/**
 * `@` stays defined (pointing at the same directory as the module-scoped
 * alias) because a handful of shared/src files intentionally import `@/...`
 * as dependency injection — the consuming app's own build resolves it to
 * its own src. See shared/src/roots/Extension* and extensionStorage.ts.
 */
export function aliases(root: string, moduleAlias: string): Record<string, string> {
  const src = path.resolve(root, "./src");
  return {
    [moduleAlias]: src,
    "@": src,
    "@shared": path.resolve(root, "../../../shared/src"),
  };
}
