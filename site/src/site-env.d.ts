/// <reference types="vite/client" />

// The site mounts both modules' web-mode code. Each module ships its own
// `electron.d.ts` typing `window.electronAPI` with an app-specific shape; the
// two shapes conflict as a single global augmentation, and neither module's
// `electron.d.ts` is included in this graph. In web mode every
// `window.electronAPI?.*` call is a guarded no-op, so the site only needs a
// permissive optional declaration.
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    electronAPI?: any;
  }
}

export {};
