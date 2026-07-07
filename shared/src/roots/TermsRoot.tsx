import { ArrowLeft } from "lucide-react";

const SectionHeading = ({ id, children, isFirst }: { id: string; children: React.ReactNode; isFirst?: boolean }) => (
  <h2 id={id} className={`text-2xl font-bold text-foreground ${isFirst ? "" : "mt-12"} mb-4 scroll-mt-24 border-b border-foreground/10 pb-3`}>
    {children}
  </h2>
);

const P = ({ children }: { children: React.ReactNode }) => (
  <p className="text-foreground/80 leading-relaxed mb-4">{children}</p>
);

const TermsRoot = () => {
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
                <span className="text-foreground">Jot</span>
              </span>
            </a>
            <span className="text-foreground/30">/</span>
            <span className="text-sm font-semibold text-foreground">Terms of Service</span>
          </div>
        </div>
      </header>

      {/* ─── Content ─── */}
      <main className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-foreground mb-2">Terms of Service</h1>
        <p className="text-sm text-foreground/40 mb-10">Last updated: March 5, 2026</p>

        <SectionHeading id="agreement" isFirst>Agreement</SectionHeading>
        <P>
          By downloading, installing, or using PopJot (&ldquo;the Software&rdquo;), you agree to
          these Terms of Service. If you do not agree, do not use the Software. These terms are
          governed by the laws of the State of Georgia, United States.
        </P>

        <SectionHeading id="license">License</SectionHeading>
        <P>
          PopJot is sold as a one-time purchase. Upon purchase you receive a personal,
          non-exclusive, non-transferable license to install and use the Software on your own
          devices. You may install it on multiple devices that you personally own or control.
        </P>
        <P>
          The license is granted to you as an individual. It may not be shared, transferred,
          sublicensed, or sold to another person. Organizations wishing to deploy PopJot across
          multiple users must purchase a license for each user.
        </P>

        <SectionHeading id="permitted-use">Permitted Use</SectionHeading>
        <P>
          You may use PopJot for personal and professional purposes, including:
        </P>
        <ul className="list-disc list-inside text-foreground/80 space-y-1 mb-4">
          <li>Screen recordings and video tutorials published commercially</li>
          <li>Live presentations, webinars, and remote meetings</li>
          <li>Educational content, courses, and instructional videos</li>
          <li>Internal business use by the licensed individual</li>
        </ul>
        <P>
          Use of the Software in productions that you distribute, monetize, or sell is permitted
          under this license.
        </P>

        <SectionHeading id="prohibited-use">Prohibited Use</SectionHeading>
        <P>You may not:</P>
        <ul className="list-disc list-inside text-foreground/80 space-y-1 mb-4">
          <li>Resell, redistribute, or sublicense the Software or your license to another person</li>
          <li>Reverse engineer, decompile, or disassemble the Software</li>
          <li>Remove or alter any copyright notices or proprietary markings</li>
          <li>Use the Software in any way that violates applicable law</li>
        </ul>

        <SectionHeading id="refunds">Refund Policy</SectionHeading>
        <P>
          All sales are final. Because PopJot is a digital software product that is immediately
          accessible upon purchase, refunds are not offered. Please review the free web demo and
          documentation at <a href="https://popjot.app" className="text-foreground hover:underline">popjot.app</a> before
          purchasing to ensure the Software meets your needs.
        </P>
        <P>
          If the Software fails to function as described due to a defect, please contact support
          at{" "}
          <a href="mailto:brad@bradandersonjr.com" className="text-foreground hover:underline">
            brad@bradandersonjr.com
          </a>{" "}
          and we will work to resolve the issue.
        </P>

        <SectionHeading id="updates">Updates</SectionHeading>
        <P>
          Your purchase includes all future updates to the major version of PopJot you purchased.
          Brad Anderson Jr reserves the right to determine what constitutes a major version change
          at their sole discretion.
        </P>

        <SectionHeading id="disclaimer">Disclaimer of Warranties</SectionHeading>
        <P>
          The Software is provided &ldquo;as is&rdquo; without warranty of any kind, express or
          implied. Brad Anderson Jr does not warrant that the Software will be error-free, uninterrupted,
          or compatible with all operating systems or configurations. Your use of the Software is
          at your own risk.
        </P>

        <SectionHeading id="liability">Limitation of Liability</SectionHeading>
        <P>
          To the maximum extent permitted by applicable law, Brad Anderson Jr shall not be liable
          for any indirect, incidental, special, consequential, or punitive damages arising from
          your use of or inability to use the Software, even if advised of the possibility of such
          damages. Brad Anderson Jr&apos;s total liability to you for any claim shall not exceed the
          amount you paid for the Software.
        </P>

        <SectionHeading id="changes">Changes to These Terms</SectionHeading>
        <P>
          These terms may be updated from time to time. Material changes will be posted at this
          URL with a new &ldquo;Last updated&rdquo; date. Continued use of the Software after
          changes are posted constitutes acceptance of the updated terms.
        </P>

        <SectionHeading id="contact">Contact</SectionHeading>
        <P>
          Questions about these terms can be directed to{" "}
          <a href="mailto:brad@bradandersonjr.com" className="text-foreground hover:underline">
            brad@bradandersonjr.com
          </a>
          .
        </P>

        {/* ─── Footer ─── */}
        <div className="mt-20 pt-8 border-t border-foreground/10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <a href="/" className="text-sm text-foreground/50 hover:text-foreground transition-colors">
              &larr; Back to PopJot
            </a>
            <div className="flex gap-6 text-sm text-foreground/40">
              <a href="/docs" className="hover:text-foreground transition-colors">Docs</a>
              <a href="/changelog" className="hover:text-foreground transition-colors">Changelog</a>
              <a href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</a>
              <a href="/terms" className="text-foreground/60 hover:text-foreground transition-colors">Terms of Service</a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default TermsRoot;
