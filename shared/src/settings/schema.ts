/**
 * Declarative settings schema for PopSuite apps.
 *
 * Each app defines its tray-adjustable settings once (src/config/settingsSchema.ts);
 * everything else is generated from that table:
 *   - main-process IPC handlers + state + window sync   (settings/main.ts)
 *   - preload bridge setters                            (settings/preload.ts)
 *   - renderer send/subscribe helpers                   (settings/renderer.ts)
 *   - Zustand store slice (values + setters)            (settings/store.ts)
 *
 * This module is pure — no Electron imports — so it is safe to import from
 * main, preload, renderer, and web builds alike.
 */

export type EnumSetting<V extends string = string> = {
  kind: "enum";
  values: readonly V[];
  default: V;
  volatile?: boolean;
};

export type NumberSetting = {
  kind: "number";
  default: number;
  /** Reject zero/negative values (durations, counts, scales). */
  positive?: boolean;
  volatile?: boolean;
};

export type BooleanSetting = {
  kind: "boolean";
  default: boolean;
  volatile?: boolean;
};

export type StringSetting = {
  kind: "string";
  default: string;
  volatile?: boolean;
};

export type SettingSpec = EnumSetting | NumberSetting | BooleanSetting | StringSetting;

/**
 * `volatile` settings are broadcast to renderers but not stored in the main
 * process and not replayed to newly opened windows (e.g. per-monitor scale
 * factor, which each window derives for itself).
 */
export type SettingsSchema = Record<string, SettingSpec>;

/** Ergonomic builders that preserve narrow enum-value types. */
export const setting = {
  enum<const V extends string>(
    values: readonly V[],
    defaultValue: NoInfer<V>,
    opts?: { volatile?: boolean }
  ): EnumSetting<V> {
    return { kind: "enum", values, default: defaultValue, ...opts };
  },
  number(defaultValue: number, opts?: { positive?: boolean; volatile?: boolean }): NumberSetting {
    return { kind: "number", default: defaultValue, ...opts };
  },
  boolean(defaultValue: boolean, opts?: { volatile?: boolean }): BooleanSetting {
    return { kind: "boolean", default: defaultValue, ...opts };
  },
  string(defaultValue: string, opts?: { volatile?: boolean }): StringSetting {
    return { kind: "string", default: defaultValue, ...opts };
  },
};

export type SettingValue<S extends SettingSpec> = S extends EnumSetting<infer V>
  ? V
  : S extends NumberSetting
    ? number
    : S extends BooleanSetting
      ? boolean
      : string;

export type SettingsValues<S extends SettingsSchema> = {
  [K in keyof S]: SettingValue<S[K]>;
};

/** Generated setter-function names, e.g. { setThemeMode(v), setGridMode(v), ... } */
export type SettingsSetters<S extends SettingsSchema> = {
  [K in keyof S & string as `set${Capitalize<K>}`]: (value: SettingValue<S[K]>) => void;
};

/** "themeMode" → "theme-mode" */
export function kebabCase(key: string): string {
  return key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

/** Renderer → main channel for a setting, e.g. "set-theme-mode". */
export function setChannel(key: string): string {
  return `set-${kebabCase(key)}`;
}

/** Main → renderers broadcast channel for a setting, e.g. "tray-set-theme-mode". */
export function trayChannel(key: string): string {
  return `tray-set-${kebabCase(key)}`;
}

/** Bridge/store setter name for a setting, e.g. "setThemeMode". */
export function setterName(key: string): string {
  return `set${key.charAt(0).toUpperCase()}${key.slice(1)}`;
}

export function settingsDefaults<S extends SettingsSchema>(schema: S): SettingsValues<S> {
  const values: Record<string, unknown> = {};
  for (const key of Object.keys(schema)) {
    values[key] = schema[key].default;
  }
  return values as SettingsValues<S>;
}

/** Runtime validation applied to every incoming IPC payload. */
export function isValidSettingValue(spec: SettingSpec, value: unknown): boolean {
  switch (spec.kind) {
    case "enum":
      return typeof value === "string" && (spec.values as readonly string[]).includes(value);
    case "number":
      return (
        typeof value === "number" && isFinite(value) && (!spec.positive || value > 0)
      );
    case "boolean":
      return typeof value === "boolean";
    case "string":
      return typeof value === "string";
  }
}
