"use client";

import { useEffect, useState } from "react";
import Loader from "@/app/components/Loader";
import { apiClient, ApiError } from "@/lib/api/client";

interface FreeQuota {
  enabled: boolean;
  perSubject: number;
}

const MAX = 200;
const ENDPOINT = "/api/admin/settings/free-quota";

/**
 * The free-plan question limit: on/off and how many questions per subject.
 * Off until launch, because the API is shared with the pre-launch site.
 */
export default function FreeQuotaCard() {
  const [quota, setQuota] = useState<FreeQuota | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState<"toggle" | "number" | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    apiClient<FreeQuota>(ENDPOINT)
      .then((q) => {
        setQuota(q);
        setInput(String(q.perSubject));
      })
      .catch(() => setMessage({ tone: "error", text: "Couldn’t load the free question limit." }));
  }, []);

  async function save(patch: Partial<FreeQuota>, kind: "toggle" | "number") {
    if (!quota || busy) return;
    setBusy(kind);
    setMessage(null);
    try {
      const updated = await apiClient<FreeQuota>(ENDPOINT, { method: "PATCH", body: JSON.stringify(patch) });
      setQuota(updated);
      setInput(String(updated.perSubject));
      if (kind === "number") setMessage({ tone: "ok", text: `Saved. ${updated.perSubject} free questions per subject.` });
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof ApiError ? err.message : "Couldn’t save. Try again." });
    } finally {
      setBusy(null);
    }
  }

  const n = Number(input);
  const valid = Number.isInteger(n) && n >= 1 && n <= MAX;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight mb-2">Free question limit</h2>
        <p className="text-slate-500 dark:text-slate-400">
          When this is on, a Free account can practise a set number of different questions in each subject,
          for good. After that, CBT practice in that subject needs Premium. Public past-question pages and live
          sessions don’t count. When it’s off, Free accounts keep the old rule: up to 20 questions a session.
        </p>
      </div>

      {!quota ? (
        message ? (
          <p className="text-sm text-red-600 dark:text-red-400">{message.text}</p>
        ) : (
          <Loader className="py-4" />
        )
      ) : (
        <div className="glass-panel p-5 rounded-2xl space-y-5">
          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-lg">Limit Free accounts</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {quota.enabled
                  ? `On. Free accounts get ${quota.perSubject} questions per subject.`
                  : "Off. Turn it on at launch (9 December)."}
              </p>
            </div>
            <button
              role="switch"
              aria-checked={quota.enabled}
              aria-label="Limit Free accounts"
              disabled={busy !== null}
              onClick={() => save({ enabled: !quota.enabled }, "toggle")}
              className={`relative shrink-0 mt-1 h-7 w-12 rounded-full transition-colors disabled:opacity-60 ${
                quota.enabled ? "bg-brand-600" : "bg-slate-300 dark:bg-slate-700"
              }`}
            >
              <span
                className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  quota.enabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (valid) save({ perSubject: n }, "number");
            }}
          >
            <label className="block">
              <span className="block text-sm font-medium mb-1">Free questions per subject</span>
              <input
                type="number"
                min={1}
                max={MAX}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="w-32 px-3 py-2 rounded-lg bg-white/60 dark:bg-black/30 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              />
            </label>
            <button
              type="submit"
              disabled={busy !== null || !valid || n === quota.perSubject}
              className="px-4 py-2 rounded-lg bg-brand-600 text-white font-semibold disabled:opacity-50"
            >
              {busy === "number" ? "Saving…" : "Save"}
            </button>
            <p className="w-full text-xs text-slate-500">
              Counts every question a student has been given, including ones in exams they haven’t finished. Changes
              reach students within a minute.
            </p>
          </form>

          {message && (
            <p className={`text-sm ${message.tone === "ok" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
              {message.text}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
