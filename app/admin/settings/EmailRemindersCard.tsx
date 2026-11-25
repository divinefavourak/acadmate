"use client";

import { useEffect, useState } from "react";
import Loader from "@/app/components/Loader";
import { apiClient, ApiError } from "@/lib/api/client";

interface ReminderSettings {
  enabled: boolean;
  dailyLimit: number;
  mailReady?: boolean;
  loginEmail?: string;
  deliveryEmail?: string | null;
}

const MAX = 300;

/**
 * Study-letter emails: on/off, how many go out each day, where your own mail
 * goes, and a test send. The daily job picks that many random students who
 * haven't practised lately (see acadmate-api EngagementService).
 */
export default function EmailRemindersCard() {
  const [settings, setSettings] = useState<ReminderSettings | null>(null);
  const [limitInput, setLimitInput] = useState("");
  const [deliveryInput, setDeliveryInput] = useState("");
  const [busy, setBusy] = useState<"toggle" | "limit" | "delivery" | "test" | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    apiClient<ReminderSettings>("/api/admin/settings/email-reminders")
      .then((s) => {
        setSettings(s);
        setLimitInput(String(s.dailyLimit));
        setDeliveryInput(s.deliveryEmail ?? "");
      })
      .catch(() => setMessage({ tone: "error", text: "Couldn’t load reminder settings." }));
  }, []);

  async function save(patch: Partial<ReminderSettings>, kind: "toggle" | "limit") {
    if (!settings || busy) return;
    setBusy(kind);
    setMessage(null);
    try {
      const updated = await apiClient<ReminderSettings>("/api/admin/settings/email-reminders", {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      setSettings({ ...settings, ...updated });
      setLimitInput(String(updated.dailyLimit));
      if (kind === "limit") setMessage({ tone: "ok", text: `Saved. Up to ${updated.dailyLimit} reminders a day.` });
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof ApiError ? err.message : "Couldn’t save. Try again." });
    } finally {
      setBusy(null);
    }
  }

  async function saveDelivery(value: string) {
    if (!settings || busy) return;
    setBusy("delivery");
    setMessage(null);
    try {
      const r = await apiClient<{ loginEmail: string; deliveryEmail: string | null }>(
        "/api/admin/settings/email-reminders/delivery-email",
        { method: "PATCH", body: JSON.stringify({ deliveryEmail: value.trim() || null }) },
      );
      setSettings({ ...settings, ...r });
      setDeliveryInput(r.deliveryEmail ?? "");
      setMessage({
        tone: "ok",
        text: r.deliveryEmail
          ? `Saved. Your emails now go to ${r.deliveryEmail}. You still sign in as ${r.loginEmail}.`
          : `Saved. Your emails go to ${r.loginEmail}.`,
      });
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof ApiError ? err.message : "Couldn’t save. Try again." });
    } finally {
      setBusy(null);
    }
  }

  async function sendTest() {
    if (busy) return;
    setBusy("test");
    setMessage(null);
    try {
      const r = await apiClient<{ sent: number; to?: string }>("/api/admin/settings/email-reminders/test", { method: "POST" });
      setMessage({ tone: "ok", text: r.to ? `Sent ${r.sent} test emails to ${r.to}.` : "Your account has no email address." });
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof ApiError ? err.message : "Couldn’t send the test emails." });
    } finally {
      setBusy(null);
    }
  }

  const limit = Number(limitInput);
  const limitValid = Number.isInteger(limit) && limit >= 0 && limit <= MAX;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight mb-2">Study letters</h2>
        <p className="text-slate-500 dark:text-slate-400">
          Every day at 10:00 (Lagos time) a random batch of students who haven’t practised in 5 days gets a study
          letter: a short read on JAMB news, study methods or motivation, with your two newest blog posts at the
          bottom. Each student gets at most one every 14 days, and most of the batch is Free users. New students
          also get a welcome email when they sign up.
        </p>
      </div>

      {!settings ? (
        message ? null : <Loader className="py-4" />
      ) : (
        <div className="glass-panel p-5 rounded-2xl space-y-5">
          {settings.mailReady === false && (
            <p className="px-3 py-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 text-sm">
              Email isn’t configured on the server (Gmail API settings are missing), so nothing will send.
            </p>
          )}

          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-lg">Study letters</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {settings.enabled ? "On. The next batch goes out at 10:00." : "Off. No letters will be sent."}
              </p>
            </div>
            <button
              role="switch"
              aria-checked={settings.enabled}
              aria-label="Study letters"
              disabled={busy !== null}
              onClick={() => save({ enabled: !settings.enabled }, "toggle")}
              className={`relative shrink-0 mt-1 h-7 w-12 rounded-full transition-colors disabled:opacity-60 ${
                settings.enabled ? "bg-brand-600" : "bg-slate-300 dark:bg-slate-700"
              }`}
            >
              <span
                className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  settings.enabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (limitValid) save({ dailyLimit: limit }, "limit");
            }}
          >
            <label className="block">
              <span className="block text-sm font-medium mb-1">Letters per day</span>
              <input
                type="number"
                min={0}
                max={MAX}
                value={limitInput}
                onChange={(e) => setLimitInput(e.target.value)}
                className="w-32 px-3 py-2 rounded-lg bg-white/60 dark:bg-black/30 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              />
            </label>
            <button
              type="submit"
              disabled={busy !== null || !limitValid || limit === settings.dailyLimit}
              className="px-4 py-2 rounded-lg bg-brand-600 text-white font-semibold disabled:opacity-50"
            >
              {busy === "limit" ? "Saving…" : "Save"}
            </button>
            <p className="w-full text-xs text-slate-500">
              Gmail limits how many emails the account can send a day (about 500 on a personal account), and blog
              alerts and password resets use the same allowance. Up to {MAX}.
            </p>
          </form>

          <form
            className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              saveDelivery(deliveryInput);
            }}
          >
            <label className="block min-w-0 flex-1">
              <span className="block text-sm font-medium mb-1">Send my emails to</span>
              <input
                type="email"
                value={deliveryInput}
                placeholder={settings.loginEmail}
                onChange={(e) => setDeliveryInput(e.target.value)}
                className="w-full max-w-sm px-3 py-2 rounded-lg bg-white/60 dark:bg-black/30 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              />
            </label>
            <button
              type="submit"
              disabled={busy !== null || deliveryInput.trim() === (settings.deliveryEmail ?? "")}
              className="px-4 py-2 rounded-lg bg-brand-600 text-white font-semibold disabled:opacity-50"
            >
              {busy === "delivery" ? "Saving…" : "Save"}
            </button>
            <p className="w-full text-xs text-slate-500">
              You sign in as <strong>{settings.loginEmail}</strong>, and that stays the same. If that inbox can’t
              receive mail, put a working address here: password resets, test emails and blog alerts go there
              instead. Leave it empty to use your sign-in address.
            </p>
          </form>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={sendTest}
              disabled={busy !== null || settings.mailReady === false}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 font-semibold hover:border-brand-500 disabled:opacity-50"
            >
              {busy === "test" ? "Sending…" : "Email me the test versions"}
            </button>
            <p className="mt-2 text-xs text-slate-500">
              Sends the welcome email and all six letters to {settings.deliveryEmail || settings.loginEmail || "your address"}.
            </p>
          </div>
        </div>
      )}

      {message && (
        <p
          role="status"
          className={`text-sm ${message.tone === "ok" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
        >
          {message.text}
        </p>
      )}
    </section>
  );
}
