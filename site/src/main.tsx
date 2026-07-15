import { createRoot } from "react-dom/client";
import SuiteRoot from "@site/roots/SuiteRoot";
import DocsRoot from "@shared/roots/DocsRoot";
import PrivacyRoot from "@shared/roots/PrivacyRoot";
import TermsRoot from "@shared/roots/TermsRoot";
import ChangelogRoot from "@shared/roots/ChangelogRoot";
import "@shared/index.css";

const BRAND = "PopSuite";

const getRoot = () => {
  const path = window.location.pathname;
  if (path === "/docs") return <DocsRoot brand={BRAND} />;
  if (path === "/privacy") return <PrivacyRoot brand={BRAND} />;
  if (path === "/terms") return <TermsRoot brand={BRAND} />;
  if (path === "/changelog") return <ChangelogRoot brand={BRAND} />;
  return <SuiteRoot />;
};

createRoot(document.getElementById("root")!).render(getRoot());
