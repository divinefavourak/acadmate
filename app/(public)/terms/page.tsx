import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata, webPageSchema } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Terms of Service",
  description:
    "Terms and conditions for using the Acadmate CBT practice platform. Read about your rights and responsibilities as an Acadmate user.",
  path: "/terms",
});

const jsonLd = webPageSchema({
  title: "Terms of Service | Acadmate",
  description: "Terms and conditions for using the Acadmate platform.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-slate-800 dark:text-slate-200">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link
          href="/"
          className="text-sm text-indigo-500 hover:text-indigo-600 font-medium mb-8 inline-block"
        >
          ← Back to home
        </Link>

        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mb-10">
          Last updated: May 31, 2026
        </p>

        <div className="prose prose-slate dark:prose-invert max-w-none space-y-8">

          <section>
            <h2 className="text-xl font-semibold mb-3">1. Acceptance of terms</h2>
            <p>
              By creating an account or using the Acadmate platform (&ldquo;Service&rdquo;) at{" "}
              <strong>acadmate.com.ng</strong>, you agree to be bound by these Terms of Service.
              The Service is operated by <strong>Acadmate Business Consult</strong>. If you do not
              agree to these terms, please do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. What Acadmate provides</h2>
            <p>
              Acadmate is an educational platform that helps Nigerian students prepare for
              JAMB/UTME, Post-UTME, and other standardised examinations. We also publish school
              news, scholarship information, career guidance, and general academic resources. The
              platform includes practice questions, mock exams, progress tracking, and community
              features.
            </p>
            <p className="mt-2">
              Acadmate is a <strong>study aid</strong>. We do not guarantee any particular exam
              result or admission outcome.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Accounts</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>You must provide accurate information when registering.</li>
              <li>You are responsible for keeping your password secure.</li>
              <li>You must be at least 13 years old to create an account.</li>
              <li>
                One person may not maintain more than one account. Accounts are not
                transferable.
              </li>
              <li>
                We reserve the right to suspend or terminate accounts that violate these terms.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Acceptable use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Use the Service for any unlawful purpose.</li>
              <li>Share, reproduce, or resell exam questions or platform content without permission.</li>
              <li>
                Attempt to gain unauthorised access to any part of the Service or its
                infrastructure.
              </li>
              <li>Post harmful, offensive, or misleading content in community features.</li>
              <li>Use automated tools or bots to scrape or abuse the platform.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Intellectual property</h2>
            <p>
              All content on Acadmate — including questions, explanations, articles, logos, and
              design — is the property of Acadmate Business Consult or its licensors. You may use
              the platform for personal study only. Redistribution, republication, or commercial
              use of any content without written permission is prohibited.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Access tokens &amp; premium features</h2>
            <p>
              Some features may require an access token or premium plan. Details of what is
              included in each tier will be displayed at the point of purchase. All fees are
              stated in Nigerian Naira (NGN) and are non-refundable unless we are unable to
              deliver the promised service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Disclaimer of warranties</h2>
            <p>
              The Service is provided &ldquo;as is&rdquo; without warranties of any kind. We do
              not warrant that the Service will be uninterrupted, error-free, or free of viruses.
              Use of the Service is at your own risk.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Limitation of liability</h2>
            <p>
              To the maximum extent permitted by law, Acadmate Business Consult shall not be
              liable for any indirect, incidental, or consequential damages arising from your use
              of the Service, including loss of data or exam results.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Changes to the Service</h2>
            <p>
              We reserve the right to modify, suspend, or discontinue any part of the Service at
              any time. We will try to give reasonable notice of significant changes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Changes to these terms</h2>
            <p>
              We may update these terms from time to time. The &ldquo;Last updated&rdquo; date at
              the top of this page reflects the most recent revision. Continued use of the Service
              after changes constitutes your acceptance of the new terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">11. Governing law</h2>
            <p>
              These terms are governed by the laws of the Federal Republic of Nigeria. Any
              disputes shall be resolved under Nigerian jurisdiction.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">12. Contact</h2>
            <p>
              Questions about these terms? Email us at{" "}
              <a
                href="mailto:acadmatebc@gmail.com"
                className="text-indigo-500 hover:underline"
              >
                acadmatebc@gmail.com
              </a>
              .
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
