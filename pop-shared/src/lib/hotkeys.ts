/** Detect macOS platform (works in both browser and Electron renderer) */
export const isMac = (): boolean => {
    if (typeof navigator === "undefined") return false;
    const platform = (navigator as Navigator & { userAgentData?: { platform: string } }).userAgentData?.platform ?? navigator.platform ?? "";
    return /mac|iphone|ipad/i.test(platform);
};

/** Detect Linux platform (works in both browser and Electron renderer) */
export const isLinux = (): boolean => {
    if (typeof navigator === "undefined") return false;
    const platform = (navigator as Navigator & { userAgentData?: { platform: string } }).userAgentData?.platform ?? navigator.platform ?? "";
    return /linux/i.test(platform);
};

/** Detect Windows platform */
export const isWindows = (): boolean => !isMac() && !isLinux();

/** Normalize browser key names to consistent lowercase form */
export const normalizeKey = (key: string): string => {
    const k = key.toLowerCase();
    if (k === "ctrl") return "control";
    if (k === "meta") return "meta";
    // On Mac, map "cmd" alias to "meta"
    if (k === "cmd" || k === "command") return "meta";
    // On Mac, map "option" alias to "alt"
    if (k === "option") return "alt";
    return k;
};

/** Format a set of active keys into a display string like "Ctrl + Alt + A" or "Cmd + Shift + A" */
export const formatHotkey = (keys: Set<string>): string => {
    const mac = isMac();
    const parts: string[] = [];
    if (keys.has("control")) parts.push("Ctrl");
    if (keys.has("meta")) parts.push(mac ? "Cmd" : "Meta");
    if (keys.has("alt")) parts.push(mac ? "Option" : "Alt");
    if (keys.has("shift")) parts.push("Shift");

    keys.forEach(k => {
        if (k !== "control" && k !== "alt" && k !== "shift" && k !== "meta") {
            parts.push(k.length === 1 ? k.toUpperCase() : k);
        }
    });
    return parts.join(" + ");
};

const MODIFIER_KEYS = new Set(["control", "alt", "shift", "meta"]);

/** Check if a set of keys contains at least one non-modifier key */
export const hasNonModifierKey = (keys: Set<string>): boolean => {
    for (const k of keys) {
        if (!MODIFIER_KEYS.has(k)) return true;
    }
    return false;
};

/** Check if all target hotkey keys are currently pressed */
export const isHotkeyPressed = (hotkey: string, activeKeys: Set<string>): boolean => {
    const targetKeys = hotkey.toLowerCase().split("+").map(k => normalizeKey(k.trim()));
    if (targetKeys.length === 0) return false;
    return targetKeys.every(k => activeKeys.has(k));
};

/** Get the platform-appropriate modifier name for display (e.g. "Alt" on Windows/Linux, "Option" on Mac) */
export const platformModifier = (winName: string): string => {
    const mac = isMac();
    const lower = winName.toLowerCase();
    if (lower === "ctrl" || lower === "control") return mac ? "Cmd" : "Ctrl";
    if (lower === "alt") return mac ? "Option" : "Alt";
    return winName;
};
