"use strict";
const electron = require("electron");
const setting = {
  enum(values, defaultValue, opts) {
    return { kind: "enum", values, default: defaultValue, ...opts };
  },
  number(defaultValue, opts) {
    return { kind: "number", default: defaultValue, ...opts };
  },
  boolean(defaultValue, opts) {
    return { kind: "boolean", default: defaultValue, ...opts };
  },
  string(defaultValue, opts) {
    return { kind: "string", default: defaultValue, ...opts };
  }
};
function kebabCase(key) {
  return key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}
function nsPrefix(ns) {
  return ns ? `${kebabCase(ns)}-` : "";
}
function setChannel(key, ns) {
  return `set-${nsPrefix(ns)}${kebabCase(key)}`;
}
function bridgeSetterName(key, ns) {
  const base = ns ? `${ns}${key.charAt(0).toUpperCase()}${key.slice(1)}` : key;
  return `set${base.charAt(0).toUpperCase()}${base.slice(1)}`;
}
function subscribe(channel) {
  return (callback) => {
    const handler = (_event, ...args) => callback(...args);
    electron.ipcRenderer.on(channel, handler);
    return () => electron.ipcRenderer.removeListener(channel, handler);
  };
}
function sender(channel) {
  return (...args) => electron.ipcRenderer.send(channel, ...args);
}
function invoker(channel) {
  return (...args) => electron.ipcRenderer.invoke(channel, ...args);
}
function createSettingsBridge(schema, ns) {
  const api = {
    quitApp: sender("quit-app"),
    closeWindow: sender("close-window"),
    onTrayMenuChange: (event, callback) => subscribe(event)(callback),
    getOpenAtLogin: invoker("get-open-at-login"),
    setOpenAtLogin: sender("set-open-at-login"),
    openExternal: sender("open-external"),
    readClipboard: invoker("read-clipboard")
  };
  for (const key of Object.keys(schema)) {
    api[bridgeSetterName(key, ns)] = (value) => electron.ipcRenderer.send(setChannel(key, ns), value);
  }
  return api;
}
function createShortcutBridge(names) {
  const api = {
    getShortcuts: invoker("get-shortcuts")
  };
  for (const name of names) {
    api[`set${name.charAt(0).toUpperCase()}${name.slice(1)}Shortcut`] = invoker(
      `set-${name}-shortcut`
    );
  }
  return api;
}
function createLicenseBridge() {
  return {
    getLicenseStatus: invoker("license:status"),
    activateLicense: invoker("license:activate"),
    deactivateLicense: invoker("license:deactivate"),
    onLicenseChange: (callback) => subscribe("license-changed")(callback)
  };
}
const settingsSchema$2 = {
  themeMode: setting.enum(["dark", "light"], "dark"),
  // Master enable toggles for each module. Disabling a module stops its
  // subsystem (uiohook / annotation hotkeys) and hides its overlay layer.
  keysEnabled: setting.boolean(true),
  jotEnabled: setting.boolean(true),
  // Per-monitor UI scale — derived by each window, broadcast but never stored.
  scaleFactor: setting.number(1, { positive: true, volatile: true })
};
const SETTINGS_NAMESPACE$1 = "keys";
const settingsSchema$1 = {
  themeMode: setting.enum(["dark", "light"], "dark"),
  colorPalette: setting.enum(
    ["muted", "vibrant", "retro", "neon", "pastel", "gradient", "glitter", "solid"],
    "retro"
  ),
  animationIntensity: setting.enum(["low", "medium", "high"], "medium"),
  displayPosition: setting.enum(
    ["top-left", "top-center", "top-right", "bottom-left", "bottom-center", "bottom-right"],
    "bottom-left"
  ),
  positionOffsetX: setting.number(0),
  positionOffsetY: setting.number(0),
  scaleMultiplier: setting.number(1, { positive: true }),
  // Per-monitor UI scale — derived by each window, broadcast but never stored.
  scaleFactor: setting.number(1, { positive: true, volatile: true }),
  badgeDuration: setting.number(2e3, { positive: true }),
  maxBadges: setting.number(5, { positive: true }),
  badgeStyle: setting.enum(["flat", "flat-outline", "pop", "glow"], "flat"),
  // Badge text color: "auto" follows the theme, else force white/black.
  badgeTextColor: setting.enum(["auto", "white", "black"], "auto"),
  // Badge font (Pro) — free users always get "mono".
  badgeFont: setting.enum(["mono", "sans", "serif", "rounded", "condensed", "display"], "mono"),
  // Badge enter/exit animation style (Pro) — free users get "pop".
  badgeAnimation: setting.enum(["pop", "slide", "bounce", "fade", "rise"], "pop"),
  badgeTranslucency: setting.number(0),
  // Glow style: halo intensity (0 = subtle, 100 = intense).
  glowIntensity: setting.number(50),
  fontSize: setting.number(16, { positive: true }),
  badgeRoundness: setting.number(100),
  keyboardEnabled: setting.boolean(true),
  // Show a ×N counter on a held key as the OS auto-repeats it.
  showKeyRepeat: setting.boolean(false),
  wordMode: setting.boolean(false),
  mouseEnabled: setting.boolean(true),
  showMouseClicks: setting.boolean(true),
  showScrollWheel: setting.boolean(true),
  // OBS mode: drop the overlay's always-on-top pin so it sits in normal
  // z-order. Lets OBS capture PopKey as its own window source (and composite
  // later) instead of hard-baking it on top of everything else on screen.
  obsMode: setting.boolean(false),
  scrollColor: setting.string("palette"),
  // "palette" = use palette, else hex
  clickColor: setting.string("palette"),
  // "palette" = use palette, else hex
  // Solid palette: single-color badges. Uses a custom color instead of palette colors.
  solidColor: setting.string("#fcbf47"),
  // Click ripple appearance.
  clickEffect: setting.enum(["ring", "solid", "pulse", "burst"], "ring"),
  clickSize: setting.number(48, { positive: true }),
  // base diameter in px
  // Branding (Pro): a small corner logo/image overlay for screencasts.
  brandingEnabled: setting.boolean(false),
  brandingImage: setting.string(""),
  // data URL of the chosen image
  brandingCorner: setting.enum(["top-left", "top-right", "bottom-left", "bottom-right"], "top-right"),
  brandingSize: setting.number(80, { positive: true }),
  // max width/height in px
  brandingOpacity: setting.number(100),
  brandingRadius: setting.number(0)
  // corner rounding 0–50%
};
const SETTINGS_NAMESPACE = "jot";
const settingsSchema = {
  themeMode: setting.enum(["dark", "light"], "dark"),
  colorPalette: setting.enum(
    ["muted", "vibrant", "retro", "neon", "pastel", "gradient", "glitter", "solid"],
    "retro"
  ),
  // Solid palette: single-color menu. Uses a custom color instead of palette colors.
  solidColor: setting.string("#fcbf47"),
  animationIntensity: setting.enum(["low", "medium", "high"], "medium"),
  menuStyle: setting.enum(["flat", "flat-outline", "pop", "glow"], "pop"),
  // Glow style: halo intensity (0 = subtle, 100 = intense).
  glowIntensity: setting.number(50),
  // Menu text/icon color: "auto" follows the style, else force white/black.
  textColor: setting.enum(["auto", "white", "black"], "auto"),
  // Button corner roundness: 0 = square, 100 = circle.
  buttonRoundness: setting.number(100),
  // Menu button background opacity: 0 = opaque, higher = more see-through.
  menuTranslucency: setting.number(0),
  // Master toggle for the Pro Branding section (custom palette + center circle).
  brandingEnabled: setting.boolean(false),
  gridMode: setting.enum(["none", "grid", "dots"], "none"),
  gridSize: setting.enum(["small", "large"], "small"),
  overlayMode: setting.enum(["live", "snapshot"], "live"),
  // Per-monitor UI scale — derived by each window, broadcast but never stored.
  scaleFactor: setting.number(1, { positive: true, volatile: true })
};
electron.contextBridge.exposeInMainWorld("electronAPI", {
  // Suite (unnamespaced) + both module schemas (namespaced setKeys*/setJot*).
  // The common members (quitApp, onTrayMenuChange, …) are identical across all
  // three spreads.
  ...createSettingsBridge(settingsSchema$2),
  ...createSettingsBridge(settingsSchema$1, SETTINGS_NAMESPACE$1),
  ...createSettingsBridge(settingsSchema, SETTINGS_NAMESPACE),
  ...createShortcutBridge(["keys", "annotate", "persistent"]),
  ...createLicenseBridge(),
  // ── keys module: toggle + raw uiohook input ──
  onShortcutToggle: subscribe("shortcut-toggle"),
  onInputKeyDown: subscribe("input:keydown"),
  onInputKeyUp: subscribe("input:keyup"),
  onInputClick: subscribe("input:click"),
  onInputWheel: subscribe("input:wheel"),
  onInputDrag: subscribe("input:drag"),
  onInputDragMove: subscribe("input:dragmove"),
  onInputFocusLost: subscribe("input:focus-lost"),
  // ── jot module: activation + overlay lifecycle ──
  onShortcutActivate: subscribe("shortcut-activate"),
  onShortcutPersistent: subscribe("shortcut-persistent"),
  overlayActivated: sender("overlay-activated"),
  overlayDeactivated: sender("overlay-deactivated")
});
