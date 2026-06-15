# PopJot

PopJot is a desktop-first screen annotation tool built with Electron, React, Vite, Tailwind, and Zustand. The app opens a transparent overlay, lets you invoke a radial tool menu at the cursor, and supports both temporary and persistent drawing modes.

## Stack

- Electron for the desktop shell and global shortcuts
- React + TypeScript for the renderer
- Vite and `electron-vite` for web and desktop builds
- Zustand for renderer state
- Tailwind CSS + Radix UI primitives for interface styling
- Framer Motion for radial menu animation
- Perfect Freehand for stroke rendering

## Project Layout

- `src/main/index.ts`: Electron main process, tray, windows, shortcuts, screenshot capture
- `src/preload/index.ts`: typed IPC bridge exposed as `window.electronAPI`
- `src/roots/DesktopRoot.tsx`: desktop renderer root
- `src/roots/WebRoot.tsx`: browser demo/landing surface
- `src/engine/EngineShell.tsx`: shared runtime shell for overlay + canvas + radial menu
- `src/components/Canvas.tsx`: drawing engine and pointer state machine
- `src/components/RadialMenu.tsx`: radial interaction model
- `src/components/SystemTray.tsx`: in-app settings surfaces
- `src/store/useStore.ts`: shared renderer state

## Development

Install dependencies:

```sh
npm install
```

Run the browser experience:

```sh
npm run dev
```

Run the Electron desktop app:

```sh
npm run dev:electron
```

Build the browser bundle:

```sh
npm run build:web
```

Build the Electron app:

```sh
npm run build:electron
```

Package a Windows desktop build:

```sh
npm run package
```

Run the quality gates:

```sh
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run test        # vitest
```

## Modes

### Non-Persistent Mode (default)
Press Alt+Shift+A (or Cmd+Shift+A on macOS) and hold. The overlay activates while you press and deactivates immediately when you release. Best for quick annotations.

### Persistent Mode (toggle)
Press Alt+Shift+S (or Cmd+Shift+S on macOS) once to activate. The canvas stays open until you press Esc. Your annotations persist while the overlay is active. Best for extended annotation sessions, whiteboard-style explanations, or recording tutorials. You can take screenshots with Print Screen or your platform's screenshot tool while in persistent mode.

## Notes

- Current overlay/screenshot behavior is centered on the primary display.
- Shortcut registration can fail if another app already owns the accelerator.
- The web root is a functional demo surface, not just marketing content, so some desktop settings are exposed there intentionally.
