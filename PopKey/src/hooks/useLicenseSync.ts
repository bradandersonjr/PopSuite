import { useEffect } from "react";
import { getLicenseStatus, onLicenseChange, type LicenseStatus } from "@shared/license/renderer";
import { setProLicensed } from "@keys/pro";
import { useStore } from "@keys/store/useStore";
import { isProPalette, DEFAULT_FREE_PALETTE } from "@keys/config/themes";
import { sendColorPalette } from "@keys/lib/platform";

/**
 * Syncs Pro license state into this renderer window. Mount once per window
 * (DesktopRoot covers both the overlay and the settings window).
 *
 * Besides mirroring status into the store and flipping the Pro module gate, it
 * defends the palette gate: if the window becomes unlicensed while a Pro-only
 * palette is selected, it falls back to the default free palette.
 */
export function useLicenseSync(): void {
  useEffect(() => {
    const apply = (status: LicenseStatus) => {
      setProLicensed(status.isPro);
      const store = useStore.getState();
      store.setLicense(status);

      if (!status.isPro && isProPalette(store.colorPalette)) {
        store.setColorPalette(DEFAULT_FREE_PALETTE);
        sendColorPalette(DEFAULT_FREE_PALETTE);
      }
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
