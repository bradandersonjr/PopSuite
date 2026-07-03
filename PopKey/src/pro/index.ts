/**
 * Pro license gate — PopKey.
 *
 * PopKey's Pro tier unlocks the premium badge palettes (gradient / glitter /
 * solid). Those palettes already live in public code, so there's no secret
 * implementation to keep private — this module is just the license gate the
 * renderer wires to. (If PopKey ever gains Pro features with real proprietary
 * logic, follow PopJot's stub/private split.)
 *
 * Keep `setProLicensed` / `isPro` exports here — `guard:pro` checks for them.
 */

let licensed = false;

export const setProLicensed = (value: boolean): void => {
  licensed = value;
};

export const isPro = (): boolean => licensed;
