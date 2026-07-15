import { ArrowLeft } from "lucide-react";

const SectionHeading = ({ id, children, isFirst }: { id: string; children: React.ReactNode; isFirst?: boolean }) => (
  <h2 id={id} className={`text-2xl font-bold text-foreground ${isFirst ? "" : "mt-12"} mb-4 scroll-mt-24 border-b border-foreground/10 pb-3`}>
    {children}
  </h2>
);

const P = ({ children }: { children: React.ReactNode }) => (
  <p className="text-foreground/80 leading-relaxed mb-4">{children}</p>
);

const PrivacyRoot = ({ brand = "PopJot" }: { brand?: string }) => {
  return (
    <div className="w-full min-h-screen bg-background theme-dark">
      {/* ─── Top bar ─── */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-foreground/10">
        <div className="max-w-3xl mx-auto flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-4">
            <a href="/" className="flex items-center gap-2 text-foreground/60 hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
              <span className="font-brand text-lg">
                <span className="text-pop-yellow">Pop</span>
                <span className="text-foreground">{brand.replace(/^Pop/, "")}</span>
              </span>
            </a>
            <span className="text-foreground/30">/</span>
            <span className="text-sm font-semibold text-foreground">Privacy Policy</span>
          </div>
        </div>
      </header>

      {/* ─── Content ─── */}
      <main className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-foreground mb-2">Privacy Policy</h1>
        <p className="text-sm text-foreground/40 mb-10">Last updated: July 8, 2026</p>

        <SectionHeading id="overview" isFirst>Overview</SectionHeading>
        <P>
          {brand} is made by Brad Anderson Jr and distributed as part of the PopSuite desktop
          install (PopJot and PopKey). This policy explains what data {brand} does and
          does not collect. The short version: {brand} collects nothing. Everything stays
          on your device.
        </P>

        <SectionHeading id="data-collected">Data We Collect</SectionHeading>
        <P>
          {brand} does not collect, transmit, or store any personal data, usage data, analytics,
          telemetry, crash reports, or diagnostic information. No data is sent to any server at any
          time, including during installation, use, or uninstallation.
        </P>
        <P>
          The desktop application does not make any network requests, with one exception: on
          Windows, PopSuite periodically checks GitHub Releases for a newer version so it can
          offer an update. This check only requests public release metadata — it sends no personal
          or usage data. The Chrome extension does not make any network requests. Your annotations
          exist only in memory and are cleared when you deactivate the overlay.
        </P>

        <SectionHeading id="permissions">Permissions</SectionHeading>
        <P>
          The desktop application requests accessibility and screen overlay permissions from your
          operating system in order to display a transparent drawing canvas on top of other
          applications. These permissions are used solely to render the drawing overlay and are
          never used to capture, record, or transmit your screen content.
        </P>
        <P>
          The Chrome extension requests permission to inject a content script into web pages. This
          permission is used solely to display the overlay on top of the active webpage.
          {" "}{brand} does not read page content, form data, passwords, or any information on the pages
          you visit.
        </P>

        <SectionHeading id="third-parties">Third Parties</SectionHeading>
        <P>
          {brand} does not use any third-party analytics services, advertising networks, or tracking
          software. No data is shared with any third party for any purpose.
        </P>
        <P>
          License purchases are handled by a third-party payment processor. Please review their
          privacy policy at the point of purchase. Brad Anderson Jr does not store your payment
          information.
        </P>

        <SectionHeading id="local-storage">Local Storage</SectionHeading>
        <P>
          {brand} saves your preferences (such as color palette, theme, animation intensity,
          keyboard shortcuts, and UI scale) locally on your device. On desktop this uses the
          operating system&apos;s local application storage, plus a small settings file under{" "}
          <code className="text-sm bg-foreground/10 px-1 rounded mx-0.5">~/.popsuite/</code> used
          to optionally sync specific settings you opt into sharing with PopKey. In the Chrome
          extension this uses{" "}
          <code className="text-sm bg-foreground/10 px-1 rounded mx-0.5">chrome.storage.local</code>.
          This data never leaves your device.
        </P>

        <SectionHeading id="children">Children&apos;s Privacy</SectionHeading>
        <P>
          {brand} is not directed at children under the age of 13 and does not knowingly collect
          any information from children.
        </P>

        <SectionHeading id="changes">Changes to This Policy</SectionHeading>
        <P>
          If this policy changes materially, the updated policy will be posted at this URL with a
          new "Last updated" date. Continued use of {brand} after a policy change constitutes
          acceptance of the updated policy.
        </P>

        <SectionHeading id="contact">Contact</SectionHeading>
        <P>
          Questions about this privacy policy can be directed to{" "}
          <a href="mailto:brad@bradandersonjr.com" className="text-foreground hover:underline">
            brad@bradandersonjr.com
          </a>
          .
        </P>

        {/* ─── Footer ─── */}
        <div className="mt-20 pt-8 border-t border-foreground/10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <a href="/" className="text-sm text-foreground/50 hover:text-foreground transition-colors">
              &larr; Back to {brand}
            </a>
            <div className="flex gap-6 text-sm text-foreground/40">
              <a href="/docs" className="hover:text-foreground transition-colors">Docs</a>
              <a href="/changelog" className="hover:text-foreground transition-colors">Changelog</a>
              <a href="/privacy" className="text-foreground/60 hover:text-foreground transition-colors">Privacy Policy</a>
              <a href="/terms" className="hover:text-foreground transition-colors">Terms of Service</a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PrivacyRoot;
