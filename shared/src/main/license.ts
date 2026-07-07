/**
 * Pro unlock (main process).
 *
 * PopSuite Pro is a one-time $7 unlock sold through Ko-fi. Ko-fi only supports a
 * single static "thank-you" message per product, so every buyer receives the same
 * key — but the key is built to LOOK like a unique, encrypted, per-customer license
 * so buyers think nothing of it.
 *
 * A key is self-validating: it carries its own checksum. No list or server is
 * needed — the app recomputes the checksum from an embedded secret and accepts any
 * key whose checksum matches. Shape:
 *
 *   POPSUITE-<base64url( 7-byte random nonce || 8-byte HMAC-SHA256(secret, nonce) )>
 *   e.g.  POPSUITE-Xk29fL3mAQ8vT1nB7wPz
 *
 * Because the nonce is random, every minted key is different; because the checksum
 * depends on the secret, a random-looking string won't validate. Mint as many keys
 * as you like with `generateLicenseKey()` (see private/gen-license.mjs) — no list to
 * maintain. To rotate (e.g. a leak gets bad enough to care), change LICENSE_SECRET
 * below and ship an update; that invalidates ALL prior keys, legit buyers included,
 * so you'd re-issue a fresh key on Ko-fi.
 *
 * This is open-source and intentionally NOT hardened against piracy: the secret is
 * visible in the repo, so anyone reading the source can forge a key. That's the
 * accepted trade-off for a $7 unlock — it stops casual fabrication (eyeballing a
 * key, typing gibberish), not a determined user. No client-side scheme does.
 */

import { app, ipcMain } from "electron";
import { createHmac, timingSafeEqual, randomBytes } from "crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync, watchFile, unwatchFile } from "fs";
import { join } from "path";
import { LICENSE_KEY_PREFIX } from "../license/format";
import type { LicenseStatus } from "../license/types";

/**
 * Secret used to compute/verify a key's checksum. Change this to rotate keys
 * (invalidates every existing key). Must stay in sync with private/gen-license.mjs.
 */
const LICENSE_SECRET = "GUmCxFaPMQRJAH2iivVc6X-BLfWBzR7E1F7-g8nxciU";

const NONCE_BYTES = 7; // random per key → keys look unique
const MAC_BYTES = 8; // truncated HMAC → forging needs the secret (~2^64 work)

/** Checksum for a nonce: first MAC_BYTES of HMAC-SHA256(secret, nonce). */
function macFor(nonce: Buffer): Buffer {
  return createHmac("sha256", LICENSE_SECRET).update(nonce).digest().subarray(0, MAC_BYTES);
}

/**
 * True if `key` is a valid Pro unlock key (prefix + a checksum matching our
 * secret). The `product` arg is unused (one suite-wide unlock) but kept so
 * existing callers don't have to change.
 */
export function verifyLicenseKey(key: string, _product?: string): boolean {
  try {
    const trimmed = String(key ?? "").trim();
    if (!trimmed.startsWith(LICENSE_KEY_PREFIX)) return false;
    const raw = Buffer.from(trimmed.slice(LICENSE_KEY_PREFIX.length), "base64url");
    if (raw.length !== NONCE_BYTES + MAC_BYTES) return false;
    const nonce = raw.subarray(0, NONCE_BYTES);
    const mac = raw.subarray(NONCE_BYTES);
    return timingSafeEqual(mac, macFor(nonce));
  } catch {
    return false;
  }
}

/** Mint a fresh, valid Pro key (random nonce + matching checksum). */
export function generateLicenseKey(): string {
  const nonce = randomBytes(NONCE_BYTES);
  const body = Buffer.concat([nonce, macFor(nonce)]).toString("base64url");
  return LICENSE_KEY_PREFIX + body;
}

export interface LicenseController {
  isPro(): boolean;
  status(): LicenseStatus;
  /** Validate and (if valid) persist a key. Returns the resulting status. */
  activate(key: string): LicenseStatus;
  /** Clear the active license. */
  deactivate(): LicenseStatus;
}

/**
 * Create the license controller for a product. Loads any previously-saved key
 * from userData and re-verifies it (a saved key that no longer validates — e.g.
 * the file was hand-edited — is ignored). Call after `app` is ready.
 */
export function createLicenseController(
  product: string,
  onChange?: (status: LicenseStatus) => void
): LicenseController {
  // Shared across all PopSuite apps — activating in one app unlocks the others.
  const dir = join(app.getPath("appData"), "PopSuite");
  const file = join(dir, "license.json");
  let key: string | null = null;

  function load(): string | null {
    try {
      if (existsSync(file)) {
        const saved = JSON.parse(readFileSync(file, "utf8")) as { key?: unknown };
        if (typeof saved.key === "string" && verifyLicenseKey(saved.key, product)) {
          return saved.key;
        }
      }
    } catch {
      // Corrupt/unreadable → unlicensed.
    }
    return null;
  }

  key = load();

  function persist(): void {
    try {
      mkdirSync(dir, { recursive: true });
      writeFileSync(file, JSON.stringify({ key }), "utf8");
    } catch {
      // Best-effort; an unwritable dir just means the key won't persist.
    }
  }

  function status(): LicenseStatus {
    return { isPro: key !== null, key };
  }

  // Watch for changes written by the other app so both stay in sync live.
  watchFile(file, { interval: 2000 }, () => {
    const next = load();
    if (next !== key) {
      key = next;
      onChange?.(status());
    }
  });

  app.on("will-quit", () => unwatchFile(file));

  return {
    isPro: () => key !== null,
    status,
    activate(candidate) {
      const trimmed = String(candidate ?? "").trim();
      if (verifyLicenseKey(trimmed, product)) {
        key = trimmed;
        persist();
        onChange?.(status());
      }
      return status();
    },
    deactivate() {
      key = null;
      persist();
      onChange?.(status());
      return status();
    },
  };
}

/**
 * Register the renderer-facing license IPC. `sendToRenderers` broadcasts the
 * new status to all windows whenever it changes.
 */
export function registerLicenseIpc(
  controller: LicenseController,
  sendToRenderers: (channel: string, value: unknown) => void
): void {
  ipcMain.handle("license:status", () => controller.status());
  ipcMain.handle("license:activate", (_event, key: string) => {
    const next = controller.activate(key);
    sendToRenderers("license-changed", next);
    return next;
  });
  ipcMain.handle("license:deactivate", () => {
    const next = controller.deactivate();
    sendToRenderers("license-changed", next);
    return next;
  });
}
