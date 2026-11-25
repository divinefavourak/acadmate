"use client";

import { useEffect, useState } from "react";
import Loader from "@/app/components/Loader";
import { apiClient, ApiError } from "@/lib/api/client";

const ENDPOINT = "/api/admin/settings/utme-date";

/** The UTME start date behind the students' dashboard countdown. */
export default function UtmeDateCard() {
  const [saved, setSaved] = useState<string | null | undefined>(undefined);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    apiClient<{ date: string | null }>(ENDPOINT)
      .then((r) => {
        setSaved(r.date);
        setInput(r.date ?? "");
      })
      .catch(() => setMessage({ tone: "error", text: "Couldn’t load the UTME date." }));
  }, []);

  async function save(date: string | null) {
    setBusy(true);
    setMessage(null);
    try {
      const r = await apiClient<{ date: string | null }>(ENDPOINT, { method: "PATCH", body: JSON.stringify({ date }) });
      setSaved(r.date);
      setInput(r.date ?? "");
      setMessage({ tone: "ok", text: r.date ? "Saved. Students see the countdown on their dashboard." : "Cleared. The countdown is hidden." });
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof ApiError ? err.message : "Couldn’t save. Try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight mb-2">UTME countdown</h2>
        <p className="text-slate-500 dark:text-slate-400">
          The day the next UTME starts. Students see “N days to go” on their dashboard. Leave it empty until JAMB
          announces the date.
        </p>
      </div>
      {saved === undefined ? (
        message ? <p className="text-sm text-red-600 dark:text-red-400">{message.text}</p> : <Loader className="py-4" />
      ) : (
        <form
          className="glass-panel p-5 rounded-2xl flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            save(input || null);
          }}
        >
          <label className="block">
            <span className="block text-sm font-medium mb-1">UTME starts on</span>
            <input
              type="date"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="px-3 py-2 rounded-lg bg-white/60 dark:bg-black/30 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            />
          </label>
          <button
            type="submit"
            disabled={busy || input === (saved ?? "")}
            className="px-4 py-2 rounded-lg bg-brand-600 text-white font-semibold disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save"}
          </button>
          {saved && (
            <button type="button" disabled={busy} onClick={() => save(null)} className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 font-semibold disabled:opacity-50">
              Clear
            </button>
          )}
          {message && (
            <p className={`w-full text-sm ${message.tone === "ok" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
              {message.text}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
