/**
 * PopJot Chrome Extension — Content Script entry point.
 *
 * Injects a shadow-DOM container into the current page so our React app
 * and CSS don't bleed into (or get clobbered by) the host page's styles.
 * The actual UI is rendered inside ExtensionRoot.
 *
 * Build note: this file is compiled as a fully self-contained IIFE so Chrome
 * can inject it as a content script without any module resolver.
 */

import { createRoot } from "react-dom/client";
import ExtensionRoot from "@shared/roots/ExtensionRoot";
// Import all CSS as an inlined string — bundled into the IIFE, then injected
// into the shadow root as a <style> element so Tailwind styles are scoped
// inside the overlay and don't conflict with the host page.
import cssText from "@shared/index.css?inline";

const HOST_ID = "popjot-extension-host";

// Bail out if already injected (guard against duplicate injection).
if (!document.getElementById(HOST_ID)) {
  const host = document.createElement("div");
  host.id = HOST_ID;
  Object.assign(host.style, {
    position: "fixed",
    inset: "0",
    zIndex: "2147483647",
    pointerEvents: "none",
    overflow: "hidden",
  });
  document.documentElement.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });

  // Inject Tailwind + component styles into the shadow root as a <style> tag.
  const styleEl = document.createElement("style");
  styleEl.textContent = cssText;
  shadow.appendChild(styleEl);

  const appRoot = document.createElement("div");
  appRoot.id = "popjot-root";
  appRoot.style.cssText = "width:100%;height:100%;pointer-events:none;";
  shadow.appendChild(appRoot);

  createRoot(appRoot).render(<ExtensionRoot shadowRoot={shadow} />);
}
