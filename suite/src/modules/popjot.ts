/**
 * PopSuite → PopJot module entry.
 *
 * Booted as its OWN OS process (PopSuite.exe --module=popjot). Sets a
 * per-module userData path FIRST — before createPopApp requests the
 * single-instance lock — so this module gets its own lock and storage,
 * independent of the PopKey module process. Then runs PopJot's shared
 * registration with the suite layout so the shared shell loads PopJot's
 * per-module renderer/preload/icons.
 *
 * The two-tier settings sync files live under ~/.popsuite (homedir), NOT
 * userData, so both module processes still read/write the same shared files.
 */

import { registerPopJot } from "@popjot/main/register";
import { applyModuleUserData, popjotLayout } from "../main/moduleRuntime";

// Per-module userData: <default userData>/modules/popjot. Must run before
// createPopApp (called by registerPopJot) touches the single-instance lock.
applyModuleUserData("popjot");

registerPopJot(popjotLayout());
