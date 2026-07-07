import { useStore } from "@/store/useStore";
import { isDesktop } from "@/lib/platform";
import { BrandingOverlay as SharedBrandingOverlay } from "@shared/components/BrandingOverlay";
import { blockedBrandingCorner } from "@/lib/branding";

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
    brandingGrayscale,
    displayPosition,
    scaleFactor,
  } = useStore();

  const effectiveIsPro = !isDesktop() || isPro;
  if (!effectiveIsPro || !brandingEnabled) return null;

  return (
    <SharedBrandingOverlay
      image={brandingImage}
      corner={brandingCorner}
      size={brandingSize}
      opacity={brandingOpacity}
      radius={brandingRadius}
      grayscale={brandingGrayscale}
      scaleFactor={scaleFactor}
      blockedCorner={blockedBrandingCorner(displayPosition)}
    />
  );
};

export default BrandingOverlay;
