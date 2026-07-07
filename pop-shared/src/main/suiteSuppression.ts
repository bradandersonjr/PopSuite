/**
 * PopKey auto-suppression state machine (suite-only, pure).
 *
 * When PopJot is actively annotating, PopKey's overlay must auto-hide, and it
 * must restore afterward to whatever visibility the user last asked for. The
 * subtlety is "PopJot always wins": while suppressed, any manual PopKey toggle
 * (shortcut or tray) must NOT show the overlay, but must also NOT be silently
 * dropped — the LATEST such request is remembered and applied the moment PopJot
 * stops annotating.
 *
 * This module holds that logic as a pure reducer so it is trivially unit-testable
 * without Electron (same philosophy as buildSuiteTrayMenu). The Electron side
 * (createPopApp) owns the actual window hide/show and only feeds events in and
 * reads `effectiveActive` out.
 *
 * State:
 *   - userRequested: the user's last manually-requested visible state. This is
 *     the source of truth for "what PopKey should be when nothing suppresses it".
 *   - suppressed: true while a sibling (PopJot) is annotating.
 *
 * `effectiveActive` = the overlay's real visibility = userRequested AND NOT
 * suppressed. There is no separate "pending request" field: because a manual
 * toggle while suppressed still updates `userRequested` (it just doesn't affect
 * `effectiveActive` until suppression clears), the latest request is inherently
 * remembered. This keeps the model to two booleans and makes "honor the latest
 * deferred toggle on release" fall out for free.
 */

export interface SuppressionState {
  /** The user's last manually-requested visible state (shortcut/tray toggle). */
  userRequested: boolean;
  /** True while a sibling module (PopJot) is annotating. */
  suppressed: boolean;
}

/** The overlay's real visibility given the current state. */
export function effectiveActive(state: SuppressionState): boolean {
  return state.userRequested && !state.suppressed;
}

/** Initial state: visible by default, nothing suppressing. */
export function initialSuppressionState(active = true): SuppressionState {
  return { userRequested: active, suppressed: false };
}

/**
 * Apply a manual toggle (user pressed the shortcut or clicked the tray item).
 * Always flips the remembered request, even while suppressed — the flip just
 * won't affect the visible overlay until suppression clears (PopJot wins), at
 * which point the latest requested value is what restores.
 */
export function applyManualToggle(state: SuppressionState): SuppressionState {
  return { ...state, userRequested: !state.userRequested };
}

/**
 * Apply a suppression change from the launcher (PopJot started/stopped
 * annotating). Setting suppressed hides the overlay; clearing it restores the
 * overlay to `userRequested` (whatever the user last asked for, including any
 * toggle they made while suppressed).
 */
export function applySuppression(
  state: SuppressionState,
  suppressed: boolean
): SuppressionState {
  return { ...state, suppressed };
}

/**
 * Resilience: the suite pipe dropped (launcher died) while we may have been
 * suppressed. Clear suppression so the user regains normal manual control and
 * never gets stuck hidden — the overlay returns to `userRequested` immediately.
 */
export function clearSuppression(state: SuppressionState): SuppressionState {
  return { ...state, suppressed: false };
}
