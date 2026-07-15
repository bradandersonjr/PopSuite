import { createRoot } from "react-dom/client";
import DesktopRoot from "@popjot/roots/DesktopRoot";
import "@shared/index.css";

// This entry is the Electron renderer (index.html is reused as the desktop
// renderer input). The public website now lives at popsuite.app (the `site`
// workspace); popjot.app serves a redirect. Outside Electron this renders a
// small notice pointing at popsuite.app.
const redirectNotice = (
  <div style={{ font: "16px system-ui", padding: "2rem", textAlign: "center" }}>
    PopJot now lives at <a href="https://popsuite.app">popsuite.app</a>.
  </div>
);

const root = __IS_DESKTOP__ ? <DesktopRoot /> : redirectNotice;
createRoot(document.getElementById("root")!).render(root);

