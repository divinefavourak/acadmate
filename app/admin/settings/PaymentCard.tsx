"use client";

import { useEffect, useState } from "react";
import Loader from "@/app/components/Loader";
import { apiClient, ApiError } from "@/lib/api/client";

interface PaymentDetails {
  priceNaira: number | null;
  bankName: string;
  accountName: string;
  accountNumber: string;
  whatsappNumber: string;
}

type Form = Record<keyof PaymentDetails, string>;

const ENDPOINT = "/api/admin/settings/payment";

function toForm(p: PaymentDetails): Form {
  return {
    priceNaira: p.priceNaira ? String(p.priceNaira) : "",
    bankName: p.bankName,
    accountName: p.accountName,
    accountNumber: p.accountNumber,
    whatsappNumber: p.whatsappNumber,
  };
}

/**
 * What students see on the upgrade page: the price, where to transfer it and
 * the WhatsApp number their "I've paid" message goes to.
 */
export default function PaymentCard() {
  const [saved, setSaved] = useState<PaymentDetails | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    apiClient<PaymentDetails>(ENDPOINT)
      .then((p) => {
        setSaved(p);
        setForm(toForm(p));
      })
      .catch(() => setMessage({ tone: "error", text: "Couldn’t load the payment details." }));
  }, []);

  function set(key: keyof Form, value: string) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  const price = form ? Number(form.priceNaira.replace(/[,\s₦]/g, "")) : NaN;
  const priceValid = !form || form.priceNaira.trim() === "" || (Number.isInteger(price) && price > 0);
  const accountValid = !form || /^(\d{10})?$/.test(form.accountNumber.replace(/\s/g, ""));
  // wa.me needs the international form: country code first, no leading 0.
  const whatsappValid = !form || /^[1-9]\d{9,14}$/.test(form.whatsappNumber.replace(/[\s+]/g, ""));
  const dirty = Boolean(saved && form && JSON.stringify(toForm(saved)) !== JSON.stringify(form));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form || !saved || busy || !priceValid || !accountValid || !whatsappValid) return;
    // Send only the fields changed here, so a save can't put back another
    // admin's older value for a field this admin didn't touch.
    const before = toForm(saved);
    const values = {
      priceNaira: form.priceNaira.trim() === "" ? null : price,
      bankName: form.bankName,
      accountName: form.accountName,
      accountNumber: form.accountNumber.replace(/\s/g, ""),
      whatsappNumber: form.whatsappNumber.replace(/[\s+]/g, ""),
    };
    const patch = Object.fromEntries(
      (Object.keys(values) as (keyof Form)[]).filter((k) => form[k] !== before[k]).map((k) => [k, values[k]]),
    );
    setBusy(true);
    setMessage(null);
    try {
      const updated = await apiClient<PaymentDetails>(ENDPOINT, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      setSaved(updated);
      setForm(toForm(updated));
      setMessage({ tone: "ok", text: "Saved. Students see the new details on the upgrade page now." });
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof ApiError ? err.message : "Couldn’t save. Try again." });
    } finally {
      setBusy(false);
    }
  }

  const input =
    "w-full px-3 py-2 rounded-lg bg-white/60 dark:bg-black/30 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/50";

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight mb-2">Premium payment</h2>
        <p className="text-slate-500 dark:text-slate-400">
          Students pay by bank transfer, then tap “I’ve paid” to send their receipt to your WhatsApp. When you’ve
          checked it, grant Premium from Access Tokens. Until the price, bank and account number are filled in, the
          upgrade page just says to ask on WhatsApp.
        </p>
      </div>

      {!form ? (
        message ? <p className="text-sm text-red-600 dark:text-red-400">{message.text}</p> : <Loader className="py-4" />
      ) : (
        <form onSubmit={save} className="glass-panel p-5 rounded-2xl space-y-4">
          {/* Locked while saving, so the reply can't overwrite edits made in the meantime */}
          <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2 disabled:opacity-70">
            <label className="block">
              <span className="block text-sm font-medium mb-1">Price (₦)</span>
              <input inputMode="numeric" value={form.priceNaira} onChange={(e) => set("priceNaira", e.target.value)} placeholder="e.g. 3000" className={input} aria-invalid={!priceValid} />
              {!priceValid && <span className="mt-1 block text-xs text-red-600 dark:text-red-400">Whole naira, more than 0.</span>}
            </label>
            <label className="block">
              <span className="block text-sm font-medium mb-1">WhatsApp number</span>
              <input inputMode="tel" value={form.whatsappNumber} onChange={(e) => set("whatsappNumber", e.target.value)} placeholder="2348012345678" className={input} aria-invalid={!whatsappValid} />
              <span className={`mt-1 block text-xs ${whatsappValid ? "text-slate-500" : "text-red-600 dark:text-red-400"}`}>
                {form.whatsappNumber.trim().startsWith("0") ? "Drop the leading 0 and start with 234." : "Country code first, no + or leading 0."}
              </span>
            </label>
            <label className="block">
              <span className="block text-sm font-medium mb-1">Bank</span>
              <input value={form.bankName} onChange={(e) => set("bankName", e.target.value)} placeholder="e.g. Moniepoint" className={input} />
            </label>
            <label className="block">
              <span className="block text-sm font-medium mb-1">Account number</span>
              <input inputMode="numeric" value={form.accountNumber} onChange={(e) => set("accountNumber", e.target.value)} placeholder="10 digits" className={input} aria-invalid={!accountValid} />
              {!accountValid && <span className="mt-1 block text-xs text-red-600 dark:text-red-400">10 digits.</span>}
            </label>
            <label className="block sm:col-span-2">
              <span className="block text-sm font-medium mb-1">Account name</span>
              <input value={form.accountName} onChange={(e) => set("accountName", e.target.value)} className={input} />
            </label>
          </fieldset>
          <div className="flex items-center gap-3 flex-wrap">
            <button type="submit" disabled={busy || !dirty || !priceValid || !accountValid || !whatsappValid} className="px-4 py-2 rounded-lg bg-brand-600 text-white font-semibold disabled:opacity-50">
              {busy ? "Saving…" : "Save"}
            </button>
            {message && (
              <p className={`text-sm ${message.tone === "ok" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                {message.text}
              </p>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
