"use client";

import { useEffect, useState } from "react";
import { apiClient, ApiError } from "@/lib/api/client";
import Loader from "@/app/components/Loader";

type Plan = "FREE" | "PREMIUM";

// GET /api/settings/payment (set by an admin in Settings).
interface PaymentDetails {
  priceNaira: number | null;
  bankName: string;
  accountName: string;
  accountNumber: string;
  whatsappNumber: string;
}

const FALLBACK_WHATSAPP = "2349031843486";

function naira(n: number) {
  return `₦${n.toLocaleString("en-NG")}`;
}

function whatsappLink(number: string, text: string) {
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

export default function UpgradePage() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [email, setEmail] = useState<string>("");
  const [payment, setPayment] = useState<PaymentDetails | null>(null);
  const [freePerSubject, setFreePerSubject] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      apiClient<{ plan: Plan }>("/api/users/me/plan"),
      apiClient<{ email?: string | null }>("/api/users/me"),
      apiClient<PaymentDetails>("/api/settings/payment"),
      apiClient<{ freePerSubject?: number | null }>("/api/users/me/quota"),
    ])
      .then(([p, me, pay, quota]) => {
        setPlan(p.status === "fulfilled" ? p.value.plan : "FREE");
        if (me.status === "fulfilled") setEmail(me.value.email ?? "");
        if (pay.status === "fulfilled") setPayment(pay.value);
        if (quota.status === "fulfilled") setFreePerSubject(quota.value.freePerSubject ?? null);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader className="py-20" />;

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Premium</h1>
        <p className="text-slate-500 dark:text-slate-400">
          {plan === "PREMIUM"
            ? "Your account has Premium. Every question and every exam mode is open to you."
            : "One payment unlocks every question, full timed mocks and Post-UTME papers."}
        </p>
      </div>

      <PlanCompare plan={plan ?? "FREE"} freePerSubject={freePerSubject} />

      {plan === "PREMIUM" ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Questions about your account? Message us on{" "}
          <a
            href={whatsappLink(payment?.whatsappNumber || FALLBACK_WHATSAPP, "Hi Acadmate, I have a question about my Premium account.")}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-brand-600 dark:text-brand-400 hover:underline"
          >
            WhatsApp
          </a>
          .
        </p>
      ) : (
        <>
          <PaySteps payment={payment} email={email} />
          <RedeemCode onRedeemed={() => setPlan("PREMIUM")} />
        </>
      )}
    </div>
  );
}

// ─── What each plan gets ─────────────────────────────────────────────────────

function PlanCompare({ plan, freePerSubject }: { plan: Plan; freePerSubject: number | null }) {
  const rows: [string, string, string][] = [
    ["Past questions with answers", "Yes", "Yes"],
    ["Worked explanations", "Yes", "Yes"],
    [
      "CBT practice by subject and topic",
      freePerSubject ? `${freePerSubject} questions per subject` : "Up to 20 a session",
      "Every question",
    ],
    ["Full timed UTME mocks", "No", "Yes"],
    ["Post-UTME past papers", "No", "Yes"],
  ];
  return (
    <div className="glass-panel rounded-2xl p-5 overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">What Free and Premium include</caption>
        <thead>
          <tr className="text-left">
            <th scope="col" className="pb-3 pr-4 font-medium text-slate-500 dark:text-slate-400">&nbsp;</th>
            <th scope="col" className="pb-3 pr-4 font-semibold">
              Free {plan === "FREE" && <span className="ml-1 text-xs font-medium text-slate-500">(you)</span>}
            </th>
            <th scope="col" className="pb-3 font-semibold text-brand-600 dark:text-brand-400">
              Premium {plan === "PREMIUM" && <span className="ml-1 text-xs font-medium text-slate-500">(you)</span>}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([feature, free, premium]) => (
            <tr key={feature} className="border-t border-slate-200 dark:border-slate-800">
              <th scope="row" className="py-2.5 pr-4 text-left font-medium">{feature}</th>
              <td className={`py-2.5 pr-4 ${free === "No" ? "text-slate-400" : ""}`}>{free}</td>
              <td className="py-2.5">{premium}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Pay by transfer, then tell us on WhatsApp ───────────────────────────────

function PaySteps({ payment, email }: { payment: PaymentDetails | null; email: string }) {
  const whatsapp = payment?.whatsappNumber || FALLBACK_WHATSAPP;
  const price = payment?.priceNaira ?? null;
  const bankReady = Boolean(payment && price && payment.accountNumber && payment.bankName);
  const emailPart = email ? ` Email: ${email}.` : "";

  // Until the owner fills in Settings → Premium payment, send people to chat.
  if (!bankReady) {
    return (
      <section className="glass-panel rounded-2xl p-6 space-y-4">
        <h2 className="text-xl font-bold">Get Premium</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Message us on WhatsApp for the current price and how to pay.
        </p>
        <a
          href={whatsappLink(whatsapp, `Hi Acadmate, I'd like to get Premium.${emailPart}`)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          Ask on WhatsApp
        </a>
      </section>
    );
  }

  const paidText = `Hi Acadmate, I've paid ${naira(price!)} for Premium.${emailPart} Receipt attached.`;

  return (
    <section className="glass-panel rounded-2xl p-6 space-y-6">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <h2 className="text-xl font-bold">Get Premium</h2>
        <p>
          <span className="font-display text-3xl font-extrabold text-brand-600 dark:text-brand-400">{naira(price!)}</span>
          <span className="ml-2 text-sm text-slate-500 dark:text-slate-400">one payment, no subscription</span>
        </p>
      </div>

      <ol className="space-y-6">
        <Step n={1} title="Transfer the money">
          <dl className="mt-3 divide-y divide-slate-200 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800">
            <CopyRow label="Amount" value={String(price)} display={naira(price!)} />
            <CopyRow label="Account number" value={payment!.accountNumber} mono />
            <CopyRow label="Bank" value={payment!.bankName} />
            {payment!.accountName && <CopyRow label="Account name" value={payment!.accountName} />}
          </dl>
        </Step>

        <Step n={2} title="Send us your receipt">
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            WhatsApp opens with a message ready. Attach a screenshot of your receipt, then send.
          </p>
          <a
            href={whatsappLink(whatsapp, paidText)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary mt-3 w-full flex items-center justify-center gap-2"
          >
            I&apos;ve paid: send my receipt
          </a>
          {!email && (
            <p className="mt-2 text-xs text-slate-500">
              Tell us the email or phone number you signed in with, so we can find your account.
            </p>
          )}
        </Step>

        <Step n={3} title="We switch on Premium">
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Once we&apos;ve checked the payment, your account becomes Premium. Refresh this page to see it.
          </p>
        </Step>
      </ol>
    </section>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <span
        aria-hidden="true"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white"
      >
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold">{title}</h3>
        {children}
      </div>
    </li>
  );
}

function CopyRow({ label, value, display, mono }: { label: string; value: string; display?: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard
      .writeText(value)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  }
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <dt className="w-32 shrink-0 text-sm text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className={`min-w-0 flex-1 truncate font-semibold ${mono ? "font-mono tracking-wider" : ""}`}>{display ?? value}</dd>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${label.toLowerCase()}`}
        className="shrink-0 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold hover:border-brand-500 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
      >
        <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
      </button>
    </div>
  );
}

// ─── Older route: an access code ────────────────────────────────────────────

function RedeemCode({ onRedeemed }: { onRedeemed: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function redeem(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    setError("");
    try {
      const data = await apiClient<{ message: string }>("/api/users/me/redeem-token", {
        method: "POST",
        body: JSON.stringify({ code: code.trim() }),
      });
      setSuccess(data.message);
      setCode("");
      onRedeemed();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn’t redeem the code. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="glass-panel rounded-2xl p-5 group">
      <summary className="cursor-pointer font-semibold">Have an access code?</summary>
      <form onSubmit={redeem} className="mt-4 space-y-3">
        <label className="block">
          <span className="sr-only">Access code</span>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ACM-XXXX-XXXX"
            spellCheck={false}
            autoComplete="off"
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/50 px-4 py-3 font-mono text-sm tracking-widest focus:outline-none focus:border-brand-500"
          />
        </label>
        {error && (
          <p role="alert" className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        {success && (
          <p role="status" className="rounded-xl border border-mint-500/30 bg-mint-500/10 px-4 py-3 text-sm font-medium text-mint-700 dark:text-mint-300">
            {success}
          </p>
        )}
        <button type="submit" disabled={busy || !code.trim()} className="btn-primary w-full disabled:opacity-60 disabled:cursor-not-allowed">
          {busy ? "Checking…" : "Activate Premium"}
        </button>
      </form>
    </details>
  );
}
