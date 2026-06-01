import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata, webPageSchema } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Privacy Policy",
  description:
    "How Acadmate collects, uses, and protects your personal data. Read our full privacy policy for the Acadmate CBT practice platform.",
  path: "/privacy",
  noindex: false,
});

const jsonLd = webPageSchema({
  title: "Privacy Policy | Acadmate",
  description: "How Acadmate collects, uses, and protects your personal data.",
  path: "/privacy",
});

export default function PrivacyPage() {
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

        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mb-10">
          Last updated: May 31, 2026
        </p>

        <div className="prose prose-slate dark:prose-invert max-w-none space-y-8">

          <section>
            <h2 className="text-xl font-semibold mb-3">1. Who we are</h2>
            <p>
              Acadmate is a product of <strong>Acadmate Business Consult</strong>, accessible at{" "}
              <strong>acadmate.com.ng</strong>. We provide educational consultation and digital
              learning resources to help Nigerian students prepare for JAMB/UTME, Post-UTME, and
              other school-related examinations. We also publish school news, scholarship
              information, and general academic guidance.
            </p>
            <p className="mt-2">
              References to &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo; in this
              policy refer to Acadmate Business Consult.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Information we collect</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Account data</strong> — name, email address, and (if you use Google
                Sign-In) your Google profile details.
              </li>
              <li>
                <strong>Usage data</strong> — exam attempts, scores, subjects studied, topics
                viewed, and session activity, used to power your progress dashboard.
              </li>
              <li>
                <strong>Device &amp; log data</strong> — browser type, IP address, and timestamps
                collected automatically for security and debugging.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. How we use your information</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Provide and improve the Acadmate platform and its study tools.</li>
              <li>Authenticate your account and keep it secure.</li>
              <li>Send transactional emails (e.g. password reset, email verification).</li>
              <li>Publish relevant school news, scholarships, and academic updates.</li>
              <li>Analyse aggregate, anonymised usage to improve question quality and features.</li>
            </ul>
            <p className="mt-3">
              We do <strong>not</strong> sell your personal data to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Google Sign-In</h2>
            <p>
              If you choose to sign in with Google, we receive your name and email address from
              Google&rsquo;s OAuth service. We use this information solely to create and manage
              your Acadmate account. Acadmate Business Consult&rsquo;s use of data received from
              Google APIs adheres to the{" "}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-500 hover:underline"
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Cookies &amp; local storage</h2>
            <p>
              We use an <code>acadmate_token</code> HttpOnly cookie to keep you signed in
              securely. No third-party advertising or tracking cookies are used.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Third-party services</h2>
            <p>We use the following third-party services to operate the platform:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Google OAuth</strong> — optional sign-in.</li>
              <li><strong>SendGrid / Email provider</strong> — transactional email delivery.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Data retention</h2>
            <p>
              Your account data is retained for as long as your account is active. You may
              request deletion of your account and all associated data at any time by contacting
              us at the email below.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Your rights</h2>
            <p>
              You have the right to access, correct, or delete personal data we hold about you.
              To exercise these rights, contact us at the email below.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Security</h2>
            <p>
              We use industry-standard measures (HTTPS, hashed passwords, secure cookies) to
              protect your data. No method of transmission over the internet is 100% secure, but
              we take all reasonable steps to protect your information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Changes to this policy</h2>
            <p>
              We may update this policy from time to time. The &ldquo;Last updated&rdquo; date at
              the top of this page will reflect any changes. Continued use of Acadmate after
              changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">11. Contact</h2>
            <p>
              Questions about this policy? Email us at{" "}
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
