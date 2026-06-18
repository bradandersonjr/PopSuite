"use strict";
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const uiohookNapi = require("uiohook-napi");
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
function trayChannel(key, ns) {
  return `tray-set-${nsPrefix(ns)}${kebabCase(key)}`;
}
function settingsDefaults(schema) {
  const values = {};
  for (const key of Object.keys(schema)) {
    values[key] = schema[key].default;
  }
  return values;
}
function isValidSettingValue(spec, value) {
  switch (spec.kind) {
    case "enum":
      return typeof value === "string" && spec.values.includes(value);
    case "number":
      return typeof value === "number" && isFinite(value) && (!spec.positive || value > 0);
    case "boolean":
      return typeof value === "boolean";
    case "string":
      return typeof value === "string";
  }
}
function registerSettingsIpc(schema, opts) {
  const values = settingsDefaults(schema);
  const ns = opts.namespace;
  for (const key of Object.keys(schema)) {
    const spec = schema[key];
    electron.ipcMain.on(setChannel(key, ns), (_event, value) => {
      if (!isValidSettingValue(spec, value)) return;
      if (!spec.volatile) {
        values[key] = value;
      }
      opts.sendToRenderers(trayChannel(key, ns), value);
      opts.onChange?.[key]?.(value);
    });
  }
  return {
    values,
    syncToWindow(win) {
      for (const key of Object.keys(schema)) {
        if (schema[key].volatile) continue;
        win.webContents.send(trayChannel(key, ns), values[key]);
      }
    }
  };
}
const LICENSE_KEY_PREFIX = "POPSUITE-";
const LICENSE_SECRET = "GUmCxFaPMQRJAH2iivVc6X-BLfWBzR7E1F7-g8nxciU";
const NONCE_BYTES = 7;
const MAC_BYTES = 8;
function macFor(nonce) {
  return crypto.createHmac("sha256", LICENSE_SECRET).update(nonce).digest().subarray(0, MAC_BYTES);
}
function verifyLicenseKey(key, _product) {
  try {
    const trimmed = String(key ?? "").trim();
    if (!trimmed.startsWith(LICENSE_KEY_PREFIX)) return false;
    const raw = Buffer.from(trimmed.slice(LICENSE_KEY_PREFIX.length), "base64url");
    if (raw.length !== NONCE_BYTES + MAC_BYTES) return false;
    const nonce = raw.subarray(0, NONCE_BYTES);
    const mac = raw.subarray(NONCE_BYTES);
    return crypto.timingSafeEqual(mac, macFor(nonce));
  } catch {
    return false;
  }
}
function createLicenseController(product, onChange) {
  const dir = path.join(electron.app.getPath("appData"), "PopSuite");
  const file = path.join(dir, "license.json");
  let key = null;
  function load() {
    try {
      if (fs.existsSync(file)) {
        const saved = JSON.parse(fs.readFileSync(file, "utf8"));
        if (typeof saved.key === "string" && verifyLicenseKey(saved.key, product)) {
          return saved.key;
        }
      }
    } catch {
    }
    return null;
  }
  key = load();
  function persist() {
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(file, JSON.stringify({ key }), "utf8");
    } catch {
    }
  }
  function status() {
    return { isPro: key !== null, key };
  }
  fs.watchFile(file, { interval: 2e3 }, () => {
    const next = load();
    if (next !== key) {
      key = next;
      onChange?.(status());
    }
  });
  electron.app.on("will-quit", () => fs.unwatchFile(file));
  return {
    isPro: () => key !== null,
    status,
    activate(candidate) {
      const trimmed = String(candidate ?? "").trim();
      if (verifyLicenseKey(trimmed)) {
        key = trimmed;
        persist();
        onChange?.(status());
      }
      return status();
    },
    deactivate() {
      key = null;
      persist();
      onChange?.(status());
      return status();
    }
  };
}
function registerLicenseIpc(controller, sendToRenderers) {
  electron.ipcMain.handle("license:status", () => controller.status());
  electron.ipcMain.handle("license:activate", (_event, key) => {
    const next = controller.activate(key);
    sendToRenderers("license-changed", next);
    return next;
  });
  electron.ipcMain.handle("license:deactivate", () => {
    const next = controller.deactivate();
    sendToRenderers("license-changed", next);
    return next;
  });
}
function createPopApp(options) {
  const { appName, settingsSchema: settingsSchema2 } = options;
  const gotTheLock = electron.app.requestSingleInstanceLock();
  if (!gotTheLock) {
    electron.app.quit();
  }
  let mainWindow = null;
  let settingsWindow = null;
  const overlayWindows = /* @__PURE__ */ new Map();
  let tray = null;
  let trayIdleImage = null;
  let trayActiveImage = null;
  let trayActive = false;
  let licenseController = null;
  const shortcutState = {};
  for (const sc of options.shortcuts) {
    shortcutState[sc.name] = sc.default;
  }
  function loadRendererWindow(win, query) {
    win.webContents.setWindowOpenHandler(({ url }) => {
      if (/^(https?:|mailto:)/i.test(url)) void electron.shell.openExternal(url);
      return { action: "deny" };
    });
    if (process.env.ELECTRON_RENDERER_URL) {
      const url = new URL(process.env.ELECTRON_RENDERER_URL);
      if (query) {
        Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value));
      }
      win.loadURL(url.toString());
      return;
    }
    win.loadFile(path.join(__dirname, "../renderer/index.html"), query ? { query } : void 0);
  }
  function sendToRenderers(channel, value) {
    for (const win of overlayWindows.values()) {
      if (!win.isDestroyed()) win.webContents.send(channel, value);
    }
    settingsWindow?.webContents.send(channel, value);
  }
  const settingsController = registerSettingsIpc(settingsSchema2, {
    sendToRenderers,
    onChange: buildOnChange(),
    namespace: options.namespace
  });
  const extraControllers = (options.extraSettings ?? []).map(
    (extra) => registerSettingsIpc(extra.schema, {
      sendToRenderers,
      onChange: extra.onChange,
      namespace: extra.namespace
    })
  );
  function buildOnChange() {
    if (!options.onSettingChange) return void 0;
    const wrapped = {};
    for (const [key, fn] of Object.entries(options.onSettingChange)) {
      if (!fn) continue;
      wrapped[key] = (value) => fn(value, ctx);
    }
    return wrapped;
  }
  function syncTraySettingsToWindow(win) {
    settingsController.syncToWindow(win);
    for (const controller of extraControllers) controller.syncToWindow(win);
    win.webContents.send("tray-open-at-login", electron.app.getLoginItemSettings().openAtLogin);
    for (const name of Object.keys(shortcutState)) {
      win.webContents.send(`tray-set-${name}-shortcut`, shortcutState[name]);
    }
  }
  function moveOverlayToCursorDisplay() {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const cursor = electron.screen.getCursorScreenPoint();
    const display = electron.screen.getDisplayNearestPoint(cursor);
    const { x, y, width, height } = display.bounds;
    mainWindow.setBounds({ x, y, width, height });
  }
  const OVERLAY_TOP_LEVEL = "screen-saver";
  function setOverlayAlwaysOnTop(onTop) {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (onTop) {
      mainWindow.setAlwaysOnTop(true, OVERLAY_TOP_LEVEL);
    } else {
      mainWindow.setAlwaysOnTop(false);
    }
  }
  function getCursorDipPosition() {
    const cursor = electron.screen.getCursorScreenPoint();
    const bounds = mainWindow?.getBounds() ?? { x: 0, y: 0 };
    return {
      x: cursor.x - bounds.x,
      y: cursor.y - bounds.y
    };
  }
  function createWindow(name = "main", query) {
    const display = electron.screen.getPrimaryDisplay();
    const { x, y, width, height } = display.bounds;
    const win = new electron.BrowserWindow({
      width,
      height,
      x,
      y,
      frame: false,
      transparent: true,
      hasShadow: false,
      skipTaskbar: true,
      resizable: false,
      movable: false,
      show: false,
      title: appName,
      webPreferences: {
        preload: path.join(__dirname, "../preload/index.js"),
        contextIsolation: true
      }
    });
    win.setAlwaysOnTop(true, OVERLAY_TOP_LEVEL);
    win.setIgnoreMouseEvents(true);
    loadRendererWindow(win, query);
    win.once("ready-to-show", () => {
      win.setBounds({ x, y, width, height });
      win.show();
    });
    win.on("closed", () => {
      overlayWindows.delete(name);
      if (mainWindow === win) mainWindow = null;
    });
    overlayWindows.set(name, win);
    return win;
  }
  function trayIconPath(file = "tray-icon.png") {
    return electron.app.isPackaged ? path.join(process.resourcesPath, file) : path.join(__dirname, `../../assets/${file}`);
  }
  function setTrayActive(active) {
    trayActive = active;
    if (!tray || tray.isDestroyed()) return;
    const next = active && trayActiveImage ? trayActiveImage : trayIdleImage;
    if (next) tray.setImage(next);
  }
  function createSettingsWindow() {
    const iconPath = trayIconPath();
    const { width, height, minWidth, minHeight, resizable = false } = options.settingsWindow;
    const win = new electron.BrowserWindow({
      width,
      height,
      minWidth,
      minHeight,
      frame: false,
      resizable,
      show: false,
      title: `${appName} Settings`,
      backgroundColor: "#171717",
      icon: fs.existsSync(iconPath) ? iconPath : void 0,
      webPreferences: {
        preload: path.join(__dirname, "../preload/index.js"),
        contextIsolation: true
      }
    });
    loadRendererWindow(win, { settings: "1" });
    win.once("ready-to-show", () => {
      win.show();
    });
    win.webContents.on("did-finish-load", () => {
      syncTraySettingsToWindow(win);
    });
    win.on("closed", () => {
      settingsWindow = null;
    });
    return win;
  }
  function openSettingsWindow() {
    if (!settingsWindow || settingsWindow.isDestroyed()) {
      settingsWindow = createSettingsWindow();
      return;
    }
    syncTraySettingsToWindow(settingsWindow);
    if (settingsWindow.isMinimized()) settingsWindow.restore();
    settingsWindow.show();
    settingsWindow.focus();
  }
  const ctx = {
    settings: settingsController.values,
    getMainWindow: () => mainWindow,
    getOverlay: (name) => overlayWindows.get(name) ?? null,
    getSettingsWindow: () => settingsWindow,
    sendToMainWindow: (channel, ...args) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(channel, ...args);
      }
    },
    sendToRenderers,
    moveOverlayToCursorDisplay,
    setOverlayAlwaysOnTop,
    setTrayActive,
    isPro: () => licenseController?.isPro() ?? false,
    getCursorDipPosition,
    openSettingsWindow
  };
  electron.ipcMain.on("quit-app", () => {
    electron.app.quit();
  });
  electron.ipcMain.on("open-external", (_event, url) => {
    if (typeof url !== "string") return;
    if (/^(https?:|mailto:)/i.test(url)) void electron.shell.openExternal(url);
  });
  electron.ipcMain.handle("read-clipboard", () => electron.clipboard.readText());
  electron.ipcMain.on("close-window", () => {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.hide();
    }
  });
  electron.ipcMain.handle("get-open-at-login", () => {
    return electron.app.getLoginItemSettings().openAtLogin;
  });
  electron.ipcMain.on("set-open-at-login", (_event, enabled) => {
    electron.app.setLoginItemSettings({ openAtLogin: Boolean(enabled) });
    sendToRenderers("tray-open-at-login", Boolean(enabled));
  });
  function unregisterShortcuts(accelerators) {
    for (const accelerator of Object.values(accelerators)) {
      electron.globalShortcut.unregister(accelerator);
    }
  }
  function registerShortcutHandlers(accelerators) {
    const entries = options.shortcuts.map((sc) => ({ sc, accelerator: accelerators[sc.name] }));
    const seen = /* @__PURE__ */ new Set();
    for (const { accelerator } of entries) {
      if (seen.has(accelerator)) {
        return {
          ok: false,
          shortcut: accelerator,
          error: "Shortcuts must be different from each other."
        };
      }
      seen.add(accelerator);
    }
    const registered = [];
    for (const { sc, accelerator } of entries) {
      const ok = electron.globalShortcut.register(accelerator, () => {
        void sc.handler(ctx);
      });
      if (!ok) {
        registered.forEach((a) => electron.globalShortcut.unregister(a));
        return {
          ok: false,
          shortcut: accelerator,
          error: `Couldn't register ${accelerator}. It may be invalid or already in use.`
        };
      }
      registered.push(accelerator);
    }
    return { ok: true, shortcut: entries[0]?.accelerator ?? "" };
  }
  function updateShortcuts(next) {
    const previous = { ...shortcutState };
    unregisterShortcuts(previous);
    const result = registerShortcutHandlers(next);
    if (!result.ok) {
      const rollback = registerShortcutHandlers(previous);
      if (!rollback.ok) {
        electron.dialog.showErrorBox(
          "Shortcut Registration Failed",
          `${result.error}

The previous shortcuts could not be restored, so the app will now quit.`
        );
        electron.app.quit();
      }
      return result;
    }
    Object.assign(shortcutState, next);
    return result;
  }
  for (const sc of options.shortcuts) {
    electron.ipcMain.handle(`set-${sc.name}-shortcut`, (_event, shortcut) => {
      const electronFormat = shortcut.replace(/ /g, "");
      const result = updateShortcuts({ ...shortcutState, [sc.name]: electronFormat });
      if (result.ok) {
        sendToRenderers(`tray-set-${sc.name}-shortcut`, electronFormat);
        return { ok: true, shortcut: electronFormat };
      }
      return result;
    });
  }
  electron.ipcMain.handle("get-shortcuts", () => ({ ...shortcutState }));
  function createTray() {
    const iconPath = trayIconPath();
    trayIdleImage = fs.existsSync(iconPath) ? electron.nativeImage.createFromPath(iconPath) : electron.nativeImage.createEmpty();
    const activePath = trayIconPath("tray-icon-active.png");
    trayActiveImage = fs.existsSync(activePath) ? electron.nativeImage.createFromPath(activePath) : null;
    tray = new electron.Tray(trayActive && trayActiveImage ? trayActiveImage : trayIdleImage);
    tray.setToolTip(appName);
    const buildTrayMenu = () => {
      const sep = { type: "separator" };
      const toggleItem = options.trayToggle ? [
        {
          label: options.trayToggle.getEnabled() ? `Disable ${appName}` : `Enable ${appName}`,
          click: () => options.trayToggle.onToggle()
        },
        sep
      ] : [];
      return electron.Menu.buildFromTemplate([
        {
          label: appName,
          enabled: false
        },
        { type: "separator" },
        ...toggleItem,
        {
          label: options.tray?.settingsLabel ?? "Settings",
          click: () => openSettingsWindow()
        },
        {
          label: "About",
          click: () => {
            electron.dialog.showMessageBox({
              type: "info",
              title: `About ${appName}`,
              message: appName,
              detail: `Version ${electron.app.getVersion()}
${options.aboutDetail}`,
              buttons: ["OK"]
            });
          }
        },
        { type: "separator" },
        {
          label: `Quit ${appName}`,
          click: () => electron.app.quit()
        }
      ]);
    };
    if (options.tray?.doubleClickOpensSettings) {
      tray.on("double-click", () => openSettingsWindow());
    }
    tray.on("right-click", () => {
      tray?.popUpContextMenu(buildTrayMenu());
    });
  }
  electron.app.whenReady().then(() => {
    if (options.proProduct) {
      licenseController = createLicenseController(
        options.proProduct,
        (status) => sendToRenderers("license-changed", status)
      );
      registerLicenseIpc(licenseController, sendToRenderers);
    }
    const overlaySpecs = options.overlays ?? [{ name: "main" }];
    overlaySpecs.forEach((spec, i) => {
      const win = createWindow(spec.name, spec.query);
      if (i === 0) mainWindow = win;
    });
    createTray();
    const shortcutRegistration = registerShortcutHandlers(shortcutState);
    if (!shortcutRegistration.ok) {
      electron.dialog.showErrorBox("Shortcut Registration Failed", shortcutRegistration.error);
    }
    options.onReady?.(ctx);
  });
  electron.app.on("window-all-closed", () => {
    if (process.platform !== "darwin") electron.app.quit();
  });
  electron.app.on("activate", () => {
    if (overlayWindows.size === 0) {
      const overlaySpecs = options.overlays ?? [{ name: "main" }];
      overlaySpecs.forEach((spec, i) => {
        const win = createWindow(spec.name, spec.query);
        if (i === 0) mainWindow = win;
      });
    }
  });
  electron.app.on("will-quit", () => {
    options.onWillQuit?.();
    electron.globalShortcut.unregisterAll();
    settingsWindow?.destroy();
    settingsWindow = null;
    tray?.destroy();
    tray = null;
  });
  electron.app.on("second-instance", () => {
    if (options.secondInstance === "open-settings") {
      openSettingsWindow();
      return;
    }
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
  return ctx;
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
const KEYCODE_TO_NAME = {};
for (const [name, code] of Object.entries(uiohookNapi.UiohookKey)) {
  if (typeof code === "number") {
    KEYCODE_TO_NAME[code] = name;
  }
}
const DISPLAY_NAMES = {
  Space: "Space",
  Backspace: "Backspace",
  Tab: "Tab",
  Enter: "Enter",
  Escape: "Esc",
  Delete: "Del",
  Insert: "Ins",
  Home: "Home",
  End: "End",
  PageUp: "PgUp",
  PageDown: "PgDn",
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  CapsLock: "CapsLock",
  NumLock: "NumLock",
  ScrollLock: "ScrollLock",
  PrintScreen: "PrtSc",
  Pause: "Pause",
  ContextMenu: "Menu",
  // Modifiers
  ShiftLeft: "Shift",
  ShiftRight: "Shift",
  CtrlLeft: "Ctrl",
  CtrlRight: "Ctrl",
  AltLeft: "Alt",
  AltRight: "Alt",
  MetaLeft: "Win",
  MetaRight: "Win",
  // Number keys
  "0": "0",
  "1": "1",
  "2": "2",
  "3": "3",
  "4": "4",
  "5": "5",
  "6": "6",
  "7": "7",
  "8": "8",
  "9": "9",
  // Function keys
  F1: "F1",
  F2: "F2",
  F3: "F3",
  F4: "F4",
  F5: "F5",
  F6: "F6",
  F7: "F7",
  F8: "F8",
  F9: "F9",
  F10: "F10",
  F11: "F11",
  F12: "F12",
  F13: "F13",
  F14: "F14",
  F15: "F15",
  F16: "F16",
  F17: "F17",
  F18: "F18",
  F19: "F19",
  F20: "F20",
  F21: "F21",
  F22: "F22",
  F23: "F23",
  F24: "F24",
  // Punctuation
  Minus: "-",
  Equal: "=",
  BracketLeft: "[",
  BracketRight: "]",
  Backslash: "\\",
  Semicolon: ";",
  Quote: "'",
  Backquote: "`",
  Comma: ",",
  Period: ".",
  Slash: "/",
  // Numpad
  Numpad0: "Num0",
  Numpad1: "Num1",
  Numpad2: "Num2",
  Numpad3: "Num3",
  Numpad4: "Num4",
  Numpad5: "Num5",
  Numpad6: "Num6",
  Numpad7: "Num7",
  Numpad8: "Num8",
  Numpad9: "Num9",
  NumpadMultiply: "Num*",
  NumpadAdd: "Num+",
  NumpadSubtract: "Num-",
  NumpadDecimal: "Num.",
  NumpadDivide: "Num/",
  NumpadEnter: "NumEnter"
};
const MODIFIER_KEYS = /* @__PURE__ */ new Set([
  "ShiftLeft",
  "ShiftRight",
  "CtrlLeft",
  "CtrlRight",
  "AltLeft",
  "AltRight",
  "MetaLeft",
  "MetaRight"
]);
function getKeyName(keycode) {
  const rawName = KEYCODE_TO_NAME[keycode] ?? `Key${keycode}`;
  return DISPLAY_NAMES[rawName] ?? rawName;
}
function isModifier(keycode) {
  const rawName = KEYCODE_TO_NAME[keycode] ?? "";
  return MODIFIER_KEYS.has(rawName);
}
let capturePaused = false;
function setInputCapturePaused(paused) {
  capturePaused = paused;
}
const DRAG_THRESHOLD = 8;
function dirSector(dx, dy) {
  return Math.floor((Math.atan2(dy, dx) * (180 / Math.PI) + 202.5) % 360 / 45);
}
function startInputCapture(getWindows) {
  const downPos = {};
  const wasDrag = /* @__PURE__ */ new Set();
  const dragEmitted = /* @__PURE__ */ new Set();
  const lastDragSector = {};
  uiohookNapi.uIOhook.on("mousedown", (e) => {
    if (capturePaused) return;
    const button = Number(e.button);
    downPos[button] = { x: e.x, y: e.y };
    wasDrag.delete(button);
    dragEmitted.delete(button);
    delete lastDragSector[button];
  });
  uiohookNapi.uIOhook.on("mousemove", (e) => {
    if (capturePaused) return;
    for (const [btn, down] of Object.entries(downPos)) {
      const button = Number(btn);
      const dx = e.x - down.x;
      const dy = e.y - down.y;
      if (!dragEmitted.has(button)) {
        if (Math.sqrt(dx * dx + dy * dy) >= DRAG_THRESHOLD) {
          wasDrag.add(button);
          dragEmitted.add(button);
          lastDragSector[button] = dirSector(dx, dy);
          for (const win of getWindows()) {
            if (!win.isDestroyed()) {
              win.webContents.send("input:drag", {
                button,
                x: e.x,
                y: e.y,
                dx,
                dy,
                time: Date.now(),
                ctrlKey: e.ctrlKey,
                shiftKey: e.shiftKey,
                altKey: e.altKey,
                metaKey: e.metaKey
              });
            }
          }
        }
      } else {
        const sector = dirSector(dx, dy);
        if (sector !== lastDragSector[button]) {
          lastDragSector[button] = sector;
          for (const win of getWindows()) {
            if (!win.isDestroyed()) {
              win.webContents.send("input:dragmove", { button, dx, dy });
            }
          }
        }
      }
    }
  });
  uiohookNapi.uIOhook.on("mouseup", (e) => {
    if (capturePaused) return;
    const button = Number(e.button);
    delete downPos[button];
    delete lastDragSector[button];
    dragEmitted.delete(button);
  });
  const WIN_KEYCODES = /* @__PURE__ */ new Set([uiohookNapi.UiohookKey.Meta, uiohookNapi.UiohookKey.MetaRight]);
  uiohookNapi.uIOhook.on("keydown", (e) => {
    if (capturePaused) return;
    const key = getKeyName(e.keycode);
    const modifier = isModifier(e.keycode);
    for (const win of getWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send("input:keydown", {
          key,
          keycode: e.keycode,
          modifier,
          time: Date.now()
        });
      }
    }
    if (WIN_KEYCODES.has(e.keycode)) {
      setTimeout(() => {
        for (const win of getWindows()) {
          if (!win.isDestroyed()) win.webContents.send("input:focus-lost");
        }
      }, 200);
    }
  });
  uiohookNapi.uIOhook.on("keyup", (e) => {
    if (capturePaused) return;
    const key = getKeyName(e.keycode);
    const modifier = isModifier(e.keycode);
    for (const win of getWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send("input:keyup", {
          key,
          keycode: e.keycode,
          modifier,
          time: Date.now()
        });
      }
    }
  });
  uiohookNapi.uIOhook.on("click", (e) => {
    if (capturePaused) return;
    const button = Number(e.button);
    if (wasDrag.has(button)) {
      wasDrag.delete(button);
      return;
    }
    for (const win of getWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send("input:click", {
          button,
          // 1=left, 2=right, 3=middle
          x: e.x,
          y: e.y,
          time: Date.now(),
          ctrlKey: e.ctrlKey,
          shiftKey: e.shiftKey,
          altKey: e.altKey,
          metaKey: e.metaKey
        });
      }
    }
  });
  uiohookNapi.uIOhook.on("wheel", (e) => {
    if (capturePaused) return;
    for (const win of getWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send("input:wheel", {
          direction: e.rotation > 0 ? "down" : "up",
          x: e.x,
          y: e.y,
          amount: Math.abs(e.rotation),
          time: Date.now()
        });
      }
    }
  });
  uiohookNapi.uIOhook.start();
}
function stopInputCapture() {
  uiohookNapi.uIOhook.stop();
}
const isMac = process.platform === "darwin";
let jotOverlayMode = settingsSchema.overlayMode.default;
let screenshotCaptureWarmed = false;
let screenshotWarmupPromise = null;
async function captureScreenshot() {
  try {
    const cursor = electron.screen.getCursorScreenPoint();
    const display = electron.screen.getDisplayNearestPoint(cursor);
    const { width, height } = display.bounds;
    const sf = display.scaleFactor;
    const sources = await electron.desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: { width: Math.round(width * sf), height: Math.round(height * sf) }
    });
    if (sources.length === 0) return null;
    const displaySource = sources.find((s) => s.display_id === display.id.toString()) ?? sources[0];
    return displaySource.thumbnail.toDataURL();
  } catch {
    return null;
  }
}
function warmupScreenshotCapture() {
  if (screenshotCaptureWarmed) return Promise.resolve();
  if (screenshotWarmupPromise) return screenshotWarmupPromise;
  screenshotWarmupPromise = electron.desktopCapturer.getSources({ types: ["screen"], thumbnailSize: { width: 1, height: 1 } }).then(() => {
    screenshotCaptureWarmed = true;
  }).catch(() => {
  }).finally(() => {
    screenshotWarmupPromise = null;
  });
  return screenshotWarmupPromise;
}
const popApp = createPopApp({
  appName: "PopSuite",
  aboutDetail: "Keystroke visualizer and screen annotation in one app.",
  settingsSchema: settingsSchema$2,
  // Host the keys/jot module schemas under their namespaces so their renderer
  // code (composed in the overlay/settings windows) syncs unchanged.
  extraSettings: [
    { schema: settingsSchema$1, namespace: SETTINGS_NAMESPACE$1 },
    {
      schema: settingsSchema,
      namespace: SETTINGS_NAMESPACE,
      onChange: {
        overlayMode: (mode) => {
          jotOverlayMode = mode;
          if (mode === "snapshot") void warmupScreenshotCapture();
        }
      }
    }
  ],
  proProduct: "suite",
  settingsWindow: { width: 1160, height: 860, minWidth: 900, minHeight: 680, resizable: true },
  // Two overlay windows, each rendering one module so each keeps the exact
  // input/cursor behavior it has standalone. "jot" is primary (interactive,
  // toggled on activation); "keys" stays click-through and just shows the HUD.
  overlays: [
    { name: "jot", query: { module: "jot" } },
    { name: "keys", query: { module: "keys" } }
  ],
  shortcuts: [
    {
      // keys module: toggle the keystroke overlay on/off.
      name: "keys",
      default: isMac ? "Cmd+Shift+K" : "Alt+Shift+K",
      handler: (ctx) => {
        ctx.getOverlay("keys")?.webContents.send("shortcut-toggle");
      }
    },
    {
      // jot module: start annotation. We drive PopJot's PERSISTENT mode (not the
      // hold-style "shortcut-activate"), because persistent mode is immune to
      // focus loss — it never deactivates on window blur or modifier release.
      // That focus-independence is what makes annotation reliable inside the
      // multi-window suite, where the overlay can't be guaranteed to hold OS
      // focus the way a lone standalone window does. Press again to toggle off.
      name: "annotate",
      default: isMac ? "Cmd+Shift+A" : "Alt+Shift+A",
      handler: async (ctx) => {
        const win = ctx.getMainWindow();
        if (!win) return;
        ctx.moveOverlayToCursorDisplay();
        enterJotSession(win);
        const pos = ctx.getCursorDipPosition();
        const snapshot = jotOverlayMode === "snapshot" ? await captureScreenshot() : null;
        win.webContents.send("shortcut-persistent", pos, snapshot);
      }
    },
    {
      // jot module: persistent (sticky) draw mode.
      name: "persistent",
      default: isMac ? "Cmd+Shift+S" : "Alt+Shift+S",
      handler: async (ctx) => {
        const win = ctx.getMainWindow();
        if (!win) return;
        ctx.moveOverlayToCursorDisplay();
        enterJotSession(win);
        const pos = ctx.getCursorDipPosition();
        const snapshot = jotOverlayMode === "snapshot" ? await captureScreenshot() : null;
        win.webContents.send("shortcut-persistent", pos, snapshot);
      }
    }
  ],
  tray: { settingsLabel: "Settings", doubleClickOpensSettings: true },
  secondInstance: "open-settings",
  onReady: (ctx) => {
    ctx.setTrayActive(true);
    startInputCapture(() => {
      const windows = [];
      const keys = ctx.getOverlay("keys");
      const settings = ctx.getSettingsWindow();
      if (keys && !keys.isDestroyed()) windows.push(keys);
      if (settings && !settings.isDestroyed()) windows.push(settings);
      return windows;
    });
    void warmupScreenshotCapture();
  },
  onWillQuit: () => {
    stopInputCapture();
  }
});
function enterJotSession(win) {
  const keys = popApp.getOverlay("keys");
  if (keys && !keys.isDestroyed()) keys.hide();
  setInputCapturePaused(true);
  win.setIgnoreMouseEvents(false);
  win.focus();
}
function exitJotSession(win) {
  win.setIgnoreMouseEvents(true);
  setInputCapturePaused(false);
  const keys = popApp.getOverlay("keys");
  if (keys && !keys.isDestroyed()) keys.showInactive();
}
electron.ipcMain.on("overlay-activated", () => {
  const win = popApp.getMainWindow();
  if (!win) return;
  enterJotSession(win);
});
electron.ipcMain.on("overlay-deactivated", () => {
  const win = popApp.getMainWindow();
  if (!win) return;
  exitJotSession(win);
});
