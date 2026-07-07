/**
 * Standalone PopKey entry. Boots the module with the flat, historical layout
 * (renderer/preload/icons at the top level of out/ and resourcesPath). The
 * PopSuite build reuses registerPopKey() with a per-module layout instead.
 */
import { registerPopKey } from "./register";

registerPopKey();
