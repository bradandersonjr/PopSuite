/**
 * PopJot Chrome Extension — Popup entry point.
 *
 * Renders the settings panel when the user clicks the extension icon.
 * Loads settings from chrome.storage.local and syncs changes back.
 */

import { createRoot } from "react-dom/client";
import ExtensionPopup from "@shared/roots/ExtensionPopup";
import "@shared/index.css";

createRoot(document.getElementById("root")!).render(<ExtensionPopup />);
