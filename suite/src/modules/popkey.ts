/**
 * PopSuite → PopKey module entry.
 *
 * Booted as its OWN OS process (PopSuite.exe --module=popkey). Sets a
 * per-module userData path FIRST so this module gets its own single-instance
 * lock and storage, then runs PopKey's shared registration with the suite
 * layout. uiohook-napi is only pulled in here (via registerPopKey →
 * inputCapture), so the launcher and the PopJot process never load it.
 */

import { registerPopKey } from "@popkey/main/register";
import { applyModuleUserData, popkeyLayout } from "../main/moduleRuntime";

applyModuleUserData("popkey");

// "reported": hand this module's tray to the suite launcher's single unified
// icon (falls back to a local tray if the launcher isn't reachable).
registerPopKey(popkeyLayout(), "reported");
