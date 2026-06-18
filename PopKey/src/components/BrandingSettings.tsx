import { useStore } from "@keys/store/useStore";
import type { BrandingCorner } from "@keys/store/useStore";
import { BrandingSettings as SharedBrandingSettings } from "@shared/components/settings";
import { getSurfacePalette } from "@shared/config/desktopTheme";
import { blockedBrandingCorner } from "@keys/lib/branding";
import {
  sendBrandingEnabled,
  sendBrandingImage,
  sendBrandingCorner,
  sendBrandingSize,
  sendBrandingOpacity,
  sendBrandingRadius,
} from "@keys/lib/platform";

const BrandingSettings = () => {
  const s = useStore();
  const palette = getSurfacePalette(s.themeMode === "dark");

  return (
    <SharedBrandingSettings
      palette={palette}
      enabled={s.brandingEnabled}
      image={s.brandingImage}
      corner={s.brandingCorner}
      size={s.brandingSize}
      opacity={s.brandingOpacity}
      radius={s.brandingRadius}
      blockedCorner={blockedBrandingCorner(s.displayPosition)}
      onToggle={() => { const v = !s.brandingEnabled; s.setBrandingEnabled(v); sendBrandingEnabled(v); }}
      onImage={(url) => { s.setBrandingImage(url); sendBrandingImage(url); }}
      onCorner={(c: BrandingCorner) => { s.setBrandingCorner(c); sendBrandingCorner(c); }}
      onSize={(px) => { s.setBrandingSize(px); sendBrandingSize(px); }}
      onOpacity={(v) => { s.setBrandingOpacity(v); sendBrandingOpacity(v); }}
      onRadius={(v) => { s.setBrandingRadius(v); sendBrandingRadius(v); }}
    />
  );
};

export default BrandingSettings;
