import { createRoot } from "react-dom/client";
import DesktopRoot from "@suite/roots/DesktopRoot";
import "@shared/index.css";

// PopSuite ships as a desktop app; the web/landing surface lives in the
// per-product sites (popkey.app / popjot.app). On web this renders the same
// root, whose desktop-only hooks no-op without window.electronAPI.
createRoot(document.getElementById("root")!).render(<DesktopRoot />);
