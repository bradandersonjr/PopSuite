/**
 * Suite settings app-switcher tab strip.
 *
 * When both modules run under the PopSuite launcher, each module's settings
 * window shows this "PopJot | PopKey" strip at the top of the chrome. The own
 * app's tab is highlighted; clicking the sibling's tab asks the shared shell to
 * open the sibling's settings window at this window's exact bounds and then hide
 * this one — two windows in two processes reading as one that swaps content.
 *
 * Renders nothing outside the suite: on web (no bridge) or standalone (no pipe /
 * no sibling) `getSuiteInfo` reports connected=false / sibling=null, so the strip
 * stays absent and the settings window looks pixel-identical to today. The
 * connected flag is LIVE — a mid-session pipe drop flips it false and the strip
 * disappears without reopening the window.
 */

import React, { useEffect, useState } from "react";
import {
  getSuiteInfo,
  onSuiteConnectedChanged,
  suiteSwitchToSibling,
} from "../../settings/renderer";
import { useSettingsUI } from "./primitives";

export const SuiteTabStrip = () => {
  const { palette } = useSettingsUI();
  // appName/sibling are static per process; only `connected` changes at runtime.
  const [appName, setAppName] = useState("");
  const [sibling, setSibling] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let mounted = true;
    void getSuiteInfo().then((info) => {
      if (!mounted) return;
      setAppName(info.appName);
      setSibling(info.sibling);
      setConnected(info.connected);
    });
    // Live connected updates: connect seeds true, a pipe drop flips it false.
    const unsubscribe = onSuiteConnectedChanged((next) => {
      if (mounted) setConnected(next);
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  // No sibling (standalone build) or not connected (launcher absent / pipe
  // dropped): render nothing so the standalone experience is unchanged.
  if (!sibling || !connected) return null;

  // Own app first, sibling second — stable, matches the unified tray's ordering
  // intent (each window highlights itself). Keep it a two-tab strip.
  const tabs: Array<{ name: string; active: boolean }> = [
    { name: appName, active: true },
    { name: sibling, active: false },
  ];

  const tabStyle = (active: boolean): React.CSSProperties => ({
    // Active tab reads as the current surface; the sibling sits recessed.
    backgroundColor: active ? palette.selected : "transparent",
    color: active ? palette.text : palette.muted,
    cursor: active ? "default" : "pointer",
  });

  return (
    <div
      // Not a drag region: the settings window has no drag chrome, and marking
      // this draggable would swallow the click that triggers the swap.
      className="flex items-center gap-1 px-4 pt-3"
      role="tablist"
      aria-label="Switch settings app"
    >
      {tabs.map((tab) => (
        <button
          key={tab.name}
          type="button"
          role="tab"
          aria-selected={tab.active}
          disabled={tab.active}
          onClick={() => {
            // Only the sibling's tab does anything; the active tab is disabled.
            if (!tab.active) suiteSwitchToSibling();
          }}
          className="rounded-t-lg px-4 py-2 text-sm font-semibold transition-colors duration-150 focus:outline-none focus-visible:ring-2"
          style={tabStyle(tab.active)}
        >
          {tab.name}
        </button>
      ))}
    </div>
  );
};
