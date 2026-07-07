/**
 * Standout, consistent "PopSuite Pro" section shared by both apps. Renders an
 * accent-bordered card with a Sparkles header, a per-app feature tagline, the
 * license activation field, and optional extra controls (e.g. PopJot's
 * "Customize Pro features" button) as children.
 */

import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { PRO_ACCENT, type SurfacePalette } from "../../config/desktopTheme";
import type { LicenseStatus } from "../../license/types";
import { LicenseField } from "./LicenseField";

export function ProSection({
  palette,
  isPro,
  buyUrl,
  tagline,
  onActivate,
  onDeactivate,
  children,
}: {
  palette: SurfacePalette;
  isPro: boolean;
  buyUrl?: string;
  tagline: string;
  onActivate: (key: string) => Promise<LicenseStatus>;
  onDeactivate: () => void;
  children?: ReactNode;
}) {
  return (
    <div
      className="rounded-[16px] p-4"
      style={{ border: `1.5px solid ${PRO_ACCENT}66`, backgroundColor: `${PRO_ACCENT}12` }}
    >
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4" style={{ color: PRO_ACCENT }} />
        <span className="text-base font-bold" style={{ color: palette.text }}>PopSuite Pro</span>
      </div>
      <p className="mb-3 mt-0.5 text-xs" style={{ color: palette.muted }}>{tagline}</p>
      <LicenseField
        productName="PopSuite"
        isPro={isPro}
        buyUrl={buyUrl}
        onActivate={onActivate}
        onDeactivate={onDeactivate}
      />
      {children && <div className="mt-2.5">{children}</div>}
    </div>
  );
}
