/**
 * Pure helpers for recognizing a Pro unlock key by its shape (no crypto). Safe to
 * import anywhere — used by the renderer to light up the Paste button when the
 * clipboard looks like a key, and by the main process for the key prefix.
 */

/** Every key starts with this. Keep in sync with main/license.ts. */
export const LICENSE_KEY_PREFIX = "POPSUITE-";

/** Full key length: prefix + base64url(7-byte nonce + 8-byte mac) = 9 + 20. */
export const LICENSE_KEY_LENGTH = LICENSE_KEY_PREFIX.length + 20;

/**
 * Cheap shape check: correct prefix, length, and base64url body. Case-sensitive
 * (base64url is). Not a checksum check — verifyLicenseKey does the real validation.
 */
export function looksLikeLicenseKey(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length !== LICENSE_KEY_LENGTH) return false;
  if (!trimmed.startsWith(LICENSE_KEY_PREFIX)) return false;
  return /^[A-Za-z0-9_-]+$/.test(trimmed.slice(LICENSE_KEY_PREFIX.length));
}
