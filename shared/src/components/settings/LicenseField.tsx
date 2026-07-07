/**
 * License activation UI — shared by both apps' settings.
 *
 * Shows the current Pro status and, when unlicensed, a key field + Activate
 * button. Purely presentational: the parent owns the status and supplies
 * activate/deactivate handlers (which talk to the main process over IPC).
 */

import { useEffect, useState } from "react";
import { Check, Sparkles, KeyRound, ClipboardPaste } from "lucide-react";
import { PRO_ACCENT } from "../../config/desktopTheme";
import { openExternal, readClipboard } from "../../settings/renderer";
import { looksLikeLicenseKey } from "../../license/format";
import { useSettingsUI } from "./primitives";
import type { LicenseStatus } from "../../license/types";

export const LicenseField = ({
  productName,
  isPro,
  buyUrl,
  onActivate,
  onDeactivate,
}: {
  productName: string;
  isPro: boolean;
  /** Where "Get a key" links to (Ko-fi product page). */
  buyUrl?: string;
  /** Validate + persist a key. Resolves to the resulting status. */
  onActivate: (key: string) => Promise<LicenseStatus>;
  onDeactivate: () => void;
}) => {
  const { palette } = useSettingsUI();
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A key-shaped clipboard value, or null. Drives the Paste button's enabled state.
  const [clipboardKey, setClipboardKey] = useState<string | null>(null);

  // Watch the clipboard (only while unlicensed) so Paste can light up when a key
  // is copied. Polls on a light interval plus whenever the window regains focus.
  useEffect(() => {
    if (isPro) return;
    let active = true;
    const check = () => {
      void readClipboard()
        .then((text) => {
          if (active) setClipboardKey(looksLikeLicenseKey(text.trim()) ? text.trim() : null);
        })
        .catch(() => {
          /* clipboard unavailable — leave Paste disabled */
        });
    };
    check();
    const id = window.setInterval(check, 1000);
    window.addEventListener("focus", check);
    return () => {
      active = false;
      window.clearInterval(id);
      window.removeEventListener("focus", check);
    };
  }, [isPro]);

  const activate = async (candidate?: string) => {
    const trimmed = (candidate ?? key).trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    const status = await onActivate(trimmed);
    setBusy(false);
    if (status.isPro) {
      setKey("");
    } else {
      setError("That key isn't valid. Check for a copy/paste slip and try again.");
    }
  };

  const fieldKey = key.trim();
  // Offer one-click Paste & Activate only when the field is empty and the
  // clipboard holds a key — otherwise the button just activates what's typed.
  const pasteMode = fieldKey.length === 0 && clipboardKey !== null;

  const primary = () => {
    if (busy) return;
    if (fieldKey.length > 0) {
      void activate();
    } else if (clipboardKey) {
      setKey(clipboardKey);
      setError(null);
      void activate(clipboardKey);
    }
  };

  if (isPro) {
    return (
      <div className="space-y-2">
        <div
          className="flex items-center gap-2 rounded-[12px] px-4 py-3 text-sm font-semibold"
          style={{ backgroundColor: `${PRO_ACCENT}22`, color: palette.text }}
        >
          <Check className="h-4 w-4" style={{ color: PRO_ACCENT }} />
          {productName} Pro unlocked
        </div>
        <button
          onClick={onDeactivate}
          className="text-xs underline-offset-2 hover:underline"
          style={{ color: palette.muted }}
        >
          Remove license from this device
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div
          className="flex flex-1 items-center gap-2 rounded-[12px] px-3 py-2"
          style={{ backgroundColor: palette.card }}
        >
          <KeyRound className="h-4 w-4 shrink-0" style={{ color: palette.muted }} />
          <input
            value={key}
            onChange={(e) => {
              setKey(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") void activate();
            }}
            placeholder="Paste your license key"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            className="w-full bg-transparent text-sm outline-none"
            style={{ color: palette.text }}
          />
        </div>
        <button
          onClick={primary}
          disabled={busy || (fieldKey.length === 0 && !clipboardKey)}
          title={pasteMode ? "Paste the key from your clipboard and activate" : undefined}
          className="flex items-center gap-1.5 rounded-[12px] px-4 py-2 text-sm font-semibold transition-opacity disabled:opacity-40"
          style={{ backgroundColor: PRO_ACCENT, color: "#fff" }}
        >
          {pasteMode && !busy && <ClipboardPaste className="h-4 w-4" />}
          {busy ? "…" : pasteMode ? "Paste & Activate" : "Activate"}
        </button>
      </div>
      {error && (
        <div className="text-xs" style={{ color: "#ef4444" }}>
          {error}
        </div>
      )}
      {buyUrl && (
        <button
          onClick={() => openExternal(buyUrl)}
          className="inline-flex items-center gap-1.5 text-xs font-medium hover:underline"
          style={{ color: PRO_ACCENT }}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Get a {productName} Pro key
        </button>
      )}
    </div>
  );
};
