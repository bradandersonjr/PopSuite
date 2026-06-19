import { useStore } from "@/store/useStore";
import type { BrandingCorner } from "@/store/useStore";
import { BrandingSettings as SharedBrandingSettings } from "@shared/components/settings";
import { getSurfacePalette } from "@shared/config/desktopTheme";
import {
  sendBrandingImage,
  sendBrandingCorner,
  sendBrandingSize,
  sendBrandingOpacity,
  sendBrandingRadius,
  sendBrandingEnabled,
} from "@/lib/platform";

/** PopJot branding overlay settings — logo/watermark, shared with PopKey. */
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
      // PopJot has no fixed badge corner to avoid, so nothing is blocked.
      blockedCorner={null}
      // No separate toggle: the watermark is active whenever an image is set.
      onImage={(url) => {
        s.setBrandingImage(url); sendBrandingImage(url);
        const on = url !== ""; s.setBrandingEnabled(on); sendBrandingEnabled(on);
      }}
      onCorner={(c: BrandingCorner) => { s.setBrandingCorner(c); sendBrandingCorner(c); }}
      onSize={(px) => { s.setBrandingSize(px); sendBrandingSize(px); }}
      onOpacity={(v) => { s.setBrandingOpacity(v); sendBrandingOpacity(v); }}
      onRadius={(v) => { s.setBrandingRadius(v); sendBrandingRadius(v); }}
    />
  );
};

export default BrandingSettings;
