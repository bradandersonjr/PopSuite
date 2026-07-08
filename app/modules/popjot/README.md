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
npm run build
```

Build the Electron app:

```sh
npm run build:electron
```

Desktop distribution is no longer per app: PopJot ships as part of the
**PopSuite** desktop install (one Electron binary that launches PopJot and
PopKey as module processes under a unified tray). Standalone per-app installer
scripts have been removed. To build/package the desktop app, use the suite from
the repo root:

```sh
npm run package:suite
```

See [`../../README.md`](../../README.md) for the suite's architecture and
packaging details. `dev:electron` above (and `dev:module:popjot` from the repo
root) remain the dev workflow for running PopJot standalone.

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

### Spotlight Mode (presenter)
Press Alt+Shift+D (or Cmd+Shift+D on macOS) to toggle a presenter overlay that dims the whole screen except a soft circle following the cursor. Scroll the mouse wheel to resize the circle live; soft-edge and dim-strength are adjustable sliders. Press Esc to exit. Mutually exclusive with drawing mode — entering one exits the other. In the PopSuite build, PopKey auto-hides while Spotlight is active, the same as it does while PopJot is drawing.

## Configuration (tray / settings)

- **Menu style**: flat, flat-outline, pop, glow (default **pop**) — with roundness and translucency controls
- **Color palette**: muted, vibrant, retro, neon, pastel, gradient, glitter, and solid (8 total)
- **Text / icon color**: follow the style, or force white / black
- **Theme**: dark or light
- **Animation intensity**: low, medium, high
- **Whiteboard / grid**: transparent, dark, or light background with optional grid or dot guides
- **Branding** (Pro): replace the radial-menu center with a custom logo, with a scalable center shape

## Notes

- Current overlay/screenshot behavior is centered on the primary display.
- Shortcut registration can fail if another app already owns the accelerator.
- The web root is a functional demo surface, not just marketing content, so some desktop settings are exposed there intentionally.
