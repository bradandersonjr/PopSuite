import { useEffect } from "react";
import { getLicenseStatus, onLicenseChange, type LicenseStatus } from "@shared/license/renderer";
import { setProLicensed } from "@/pro";
import { useStore } from "@/store/useStore";

/**
 * Syncs Pro license state into this renderer window. Mount once per window
 * (DesktopRoot covers both the overlay and the settings window).
 *
 * On status change it: mirrors into the store (reactive UI), flips the Pro
 * module's gate (synchronous feature getters), and bumps paletteVersion so
 * any Pro-dependent rendering (custom palette, effects, center icon) refreshes.
 */
export function useLicenseSync(): void {
  useEffect(() => {
    const apply = (status: LicenseStatus) => {
      setProLicensed(status.isPro);
      useStore.getState().setLicense(status);
      useStore.getState().bumpPaletteVersion();
    };

    let mounted = true;
    void getLicenseStatus().then((status) => {
      if (mounted) apply(status);
    });
    const unsubscribe = onLicenseChange(apply);

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);
}
