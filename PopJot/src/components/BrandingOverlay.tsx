import { useStore } from "@/store/useStore";
import { BrandingOverlay as SharedBrandingOverlay } from "@shared/components/BrandingOverlay";

/** PopJot branding overlay — logo/watermark shown while the annotation overlay is up. */
const BrandingOverlay = () => {
  const {
    isPro,
    brandingEnabled,
    brandingImage,
    brandingCorner,
    brandingSize,
    brandingOpacity,
    brandingRadius,
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
      blockedCorner={null}
    />
  );
};

export default BrandingOverlay;
