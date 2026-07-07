import { describe, expect, it } from "vitest";
import {
  initialSuppressionState,
  applyManualToggle,
  applySuppression,
  clearSuppression,
  effectiveActive,
  type SuppressionState,
} from "./suiteSuppression";

describe("suite suppression reducer", () => {
  it("starts visible with nothing suppressing", () => {
    const s = initialSuppressionState();
    expect(s).toEqual({ userRequested: true, suppressed: false });
    expect(effectiveActive(s)).toBe(true);
  });

  it("honors a non-default initial requested state", () => {
    const s = initialSuppressionState(false);
    expect(effectiveActive(s)).toBe(false);
  });

  it("a manual toggle flips the visible overlay when not suppressed", () => {
    let s = initialSuppressionState();
    s = applyManualToggle(s);
    expect(effectiveActive(s)).toBe(false);
    s = applyManualToggle(s);
    expect(effectiveActive(s)).toBe(true);
  });

  it("suppression hides the overlay regardless of the requested state", () => {
    let s = initialSuppressionState(true);
    s = applySuppression(s, true);
    expect(effectiveActive(s)).toBe(false);
    // The user's request is untouched underneath.
    expect(s.userRequested).toBe(true);
  });

  it("clearing suppression restores the last requested state", () => {
    let s = initialSuppressionState(true);
    s = applySuppression(s, true);
    expect(effectiveActive(s)).toBe(false);
    s = applySuppression(s, false);
    expect(effectiveActive(s)).toBe(true);
  });

  it("PopJot always wins: a manual toggle while suppressed stays hidden but is remembered", () => {
    // Visible, then PopJot annotates → hidden.
    let s = initialSuppressionState(true);
    s = applySuppression(s, true);
    expect(effectiveActive(s)).toBe(false);

    // User toggles while suppressed: overlay stays hidden...
    s = applyManualToggle(s);
    expect(effectiveActive(s)).toBe(false);
    // ...but the request was recorded (they asked to turn it OFF).
    expect(s.userRequested).toBe(false);

    // PopJot stops → restore honors the LATEST request (off), not the old (on).
    s = applySuppression(s, false);
    expect(effectiveActive(s)).toBe(false);
  });

  it("honors the latest of several toggles made while suppressed", () => {
    let s: SuppressionState = { userRequested: true, suppressed: true };
    s = applyManualToggle(s); // requested -> false
    s = applyManualToggle(s); // requested -> true
    s = applyManualToggle(s); // requested -> false
    expect(effectiveActive(s)).toBe(false); // still hidden while suppressed
    s = applySuppression(s, false);
    expect(effectiveActive(s)).toBe(false); // restores to the final request (off)
  });

  it("clearSuppression un-sticks a hidden overlay (launcher-died resilience)", () => {
    let s = initialSuppressionState(true);
    s = applySuppression(s, true);
    expect(effectiveActive(s)).toBe(false);
    // Pipe dropped while suppressed: force-clear so the user regains control.
    s = clearSuppression(s);
    expect(s.suppressed).toBe(false);
    expect(effectiveActive(s)).toBe(true);
  });

  it("clearSuppression preserves a user who had turned the overlay off", () => {
    let s = initialSuppressionState(true);
    s = applyManualToggle(s); // user turned it off (not suppressed)
    s = applySuppression(s, true); // then PopJot annotated
    s = clearSuppression(s); // launcher died
    expect(effectiveActive(s)).toBe(false); // stays off — that's what they wanted
  });
});
