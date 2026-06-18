import { createRoot } from "react-dom/client";
import WebRoot from "@jot/roots/WebRoot";
import DesktopRoot from "@jot/roots/DesktopRoot";
import DocsRoot from "@shared/roots/DocsRoot";
import PrivacyRoot from "@shared/roots/PrivacyRoot";
import TermsRoot from "@shared/roots/TermsRoot";
import ChangelogRoot from "@shared/roots/ChangelogRoot";
import "@shared/index.css";

const getRoot = () => {
  if (__IS_DESKTOP__) return DesktopRoot;
  const path = window.location.pathname;
  if (path === "/docs") return DocsRoot;
  if (path === "/privacy") return PrivacyRoot;
  if (path === "/terms") return TermsRoot;
  if (path === "/changelog") return ChangelogRoot;
  return WebRoot;
};

const Root = getRoot();
createRoot(document.getElementById("root")!).render(<Root />);
