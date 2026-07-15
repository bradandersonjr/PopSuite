export {
  type Option,
  type SettingsDensity,
  SettingsUIProvider,
  useSettingsUI,
  SectionHeading,
  SettingGroup,
  OptionGrid,
  ToggleRow,
  SliderRow,
  ShortcutButton,
  ShortcutErrorBanner,
  SettingsColumns,
  SettingsSection,
} from "./primitives";
export { SettingsWindowFrame, EmbeddedSettingsPanel } from "./SettingsWindowFrame";
export { ToastProvider, useToast } from "./Toast";
export { LicenseField } from "./LicenseField";
export { SettingsImportExport } from "./SettingsImportExport";
export { SuiteImportExport, type SuiteAppConfig } from "./SuiteImportExport";
export { SuitePresets } from "./SuitePresets";
export { SyncSettings } from "./SyncSettings";
export { BrandingSettings } from "./BrandingSettings";
export { ColorMixerPopover } from "./ColorMixerPopover";
export { ProSection } from "./ProSection";
export { useOpenAtLogin, useShortcutRecorder } from "./hooks";
// NOTE: dropdown primitives are intentionally not re-exported here — import
// from "@shared/components/settings/dropdown" directly so apps that don't use
// the dropdown tray (PopKey) don't pull Radix dropdown-menu into their bundle.
