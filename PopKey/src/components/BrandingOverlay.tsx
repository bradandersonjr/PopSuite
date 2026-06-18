import { useStore } from "@keys/store/useStore";
import { BrandingOverlay as SharedBrandingOverlay } from "@shared/components/BrandingOverlay";
import { blockedBrandingCorner } from "@keys/lib/branding";

/** PopKey branding overlay — keystroke badges block their own corner. */
const BrandingOverlay = () => {
  const {
    isPro,
    brandingEnabled,
    brandingImage,
    brandingCorner,
    brandingSize,
    brandingOpacity,
    brandingRadius,
    displayPosition,
    scaleFactor,
  } = useStore();

  if (!isPro || !brandingEnabled) return null;

  return (
    <SharedBrandingOverlay
      image={brandingImage}
      corner={brandingCorner}
      size={brandingSize}
      opacity={brandingOpacity}
      radius={brandingRadius}
      scaleFactor={scaleFactor}
      blockedCorner={blockedBrandingCorner(displayPosition)}
    />
  );
};

export default BrandingOverlay;
