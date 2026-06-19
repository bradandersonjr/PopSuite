import { useStore } from "@/store/useStore";
import type { BrandingCorner } from "@/store/useStore";
import { BrandingSettings as SharedBrandingSettings } from "@shared/components/settings";
import { getSurfacePalette } from "@shared/config/desktopTheme";
import { blockedBrandingCorner } from "@/lib/branding";
import {
  sendBrandingEnabled,
  sendBrandingImage,
  sendBrandingCorner,
  sendBrandingSize,
  sendBrandingOpacity,
  sendBrandingRadius,
  sendBrandingGrayscale,
} from "@/lib/platform";

const BrandingSettings = () => {
  const s = useStore();
  const palette = getSurfacePalette(s.themeMode === "dark");

  return (
    <SharedBrandingSettings
      palette={palette}
      image={s.brandingImage}
      corner={s.brandingCorner}
      size={s.brandingSize}
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
      onOpacity={(v) => { s.setBrandingOpacity(v); sendBrandingOpacity(v); }}
      onRadius={(v) => { s.setBrandingRadius(v); sendBrandingRadius(v); }}
      onGrayscale={(v) => { s.setBrandingGrayscale(v); sendBrandingGrayscale(v); }}
    />
  );
};

export default BrandingSettings;
