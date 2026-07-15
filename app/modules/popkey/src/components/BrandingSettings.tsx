import { useStore } from "@popkey/store/useStore";
import type { BrandingCorner } from "@popkey/store/useStore";
import { BrandingSettings as SharedBrandingSettings } from "@shared/components/settings";
import { getSurfacePalette } from "@shared/config/desktopTheme";
import { blockedBrandingCorner } from "@popkey/lib/branding";
import {
  sendBrandingEnabled,
  sendBrandingImage,
  sendBrandingCorner,
  sendBrandingSize,
  sendBrandingOffsetX,
  sendBrandingOffsetY,
  sendBrandingOpacity,
  sendBrandingRadius,
  sendBrandingGrayscale,
} from "@popkey/lib/platform";

const BrandingSettings = () => {
  const s = useStore();
  const palette = getSurfacePalette(s.themeMode === "dark");

  return (
    <SharedBrandingSettings
      palette={palette}
      image={s.brandingImage}
      corner={s.brandingCorner}
      size={s.brandingSize}
      offsetX={s.brandingOffsetX}
      offsetY={s.brandingOffsetY}
      opacity={s.brandingOpacity}
      radius={s.brandingRadius}
      grayscale={s.brandingGrayscale}
      blockedCorner={blockedBrandingCorner(s.displayPosition)}
      // No separate toggle now that Branding is its own tab: the overlay is
      // active whenever a logo image is set.
      onImage={(url) => {
        s.setBrandingImage(url); sendBrandingImage(url);
        const on = url !== ""; s.setBrandingEnabled(on); sendBrandingEnabled(on);
      }}
      onCorner={(c: BrandingCorner) => { s.setBrandingCorner(c); sendBrandingCorner(c); }}
      onSize={(px) => { s.setBrandingSize(px); sendBrandingSize(px); }}
      onOffsetX={(v) => { s.setBrandingOffsetX(v); sendBrandingOffsetX(v); }}
      onOffsetY={(v) => { s.setBrandingOffsetY(v); sendBrandingOffsetY(v); }}
      onOpacity={(v) => { s.setBrandingOpacity(v); sendBrandingOpacity(v); }}
      onRadius={(v) => { s.setBrandingRadius(v); sendBrandingRadius(v); }}
      onGrayscale={(v) => { s.setBrandingGrayscale(v); sendBrandingGrayscale(v); }}
    />
  );
};

export default BrandingSettings;
