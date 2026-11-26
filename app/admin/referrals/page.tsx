"use client";

import { useCallback, useEffect, useState } from "react";
import Loader from "@/app/components/Loader";
import ConfirmModal from "@/app/components/ConfirmModal";
import { apiClient, ApiError } from "@/lib/api/client";

// GET /api/admin/referrals/contest
interface Friend {
  name: string | null;
  email: string;
  signedUpAt: string;
  onboardedAt: string;
  examsFinished: number;
}
interface Entry {
  rank: number;
  userId: string;
  name: string | null;
  email: string;
  plan: "FREE" | "PREMIUM";
  friends: number;
  friendList: Friend[];
}
interface AdminContest {
  settings: { start: string | null; end: string | null; prize: string; excluded: string[] };
  state: "none" | "upcoming" | "live" | "ended";
  entries: Entry[];
  excludedUsers: { id: string; name: string | null; email: string }[];
}

const ENDPOINT = "/api/admin/referrals/contest";

function when(iso: string) {
  return new Date(iso).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Sign-ups by one referrer within 10 minutes of each other: worth a look. */
function burstCount(friends: Friend[]) {
  const times = friends.map((f) => new Date(f.signedUpAt).getTime()).sort((a, b) => a - b);
  let close = 0;
  for (let i = 1; i < times.length; i++) if (times[i] - times[i - 1] < 10 * 60_000) close++;
  return close;
}

export default function AdminReferralsPage() {
  const [data, setData] = useState<AdminContest | null>(null);
  const [form, setForm] = useState({ start: "", end: "", prize: "" });
  const [open, setOpen] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Entry | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  // resetForm is false for board refreshes (Disqualify / Put back), so an
  // unsaved edit to the dates or prize isn't wiped.
  const load = useCallback(async (resetForm = true) => {
    const d = await apiClient<AdminContest>(ENDPOINT);
    setData(d);
    if (resetForm) setForm({ start: d.settings.start ?? "", end: d.settings.end ?? "", prize: d.settings.prize });
  }, []);

  useEffect(() => {
    load().catch(() => setMessage({ tone: "error", text: "Couldn’t load the contest." }));
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await apiClient(ENDPOINT, {
        method: "PATCH",
        body: JSON.stringify({ start: form.start || null, end: form.end || null, prize: form.prize }),
      });
      await load();
      setMessage({
        tone: "ok",
        text: form.start && form.end ? "Saved. Students see the contest on their Invite page." : "Saved. The contest is off.",
      });
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof ApiError ? err.message : "Couldn’t save. Try again." });
    } finally {
      setBusy(false);
    }
  }

  async function setExcluded(userId: string, excluded: boolean) {
    setBusy(true);
    setMessage(null);
    try {
      await apiClient(`${ENDPOINT}/exclude`, { method: "POST", body: JSON.stringify({ userId, excluded }) });
      await load(false);
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof ApiError ? err.message : "Couldn’t update. Try again." });
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  const input =
    "w-full px-3 py-2 rounded-lg bg-white/60 dark:bg-black/30 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/50";

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Referral contest</h1>
        <p className="text-slate-500 dark:text-slate-400 max-w-2xl">
          Students who bring the most friends between the dates below win the prize, which you pay yourself. A friend
          counts when they sign up with the student’s link in that window and finish setting up their account. Check
          the top entries’ friends before paying, and disqualify anyone using fake accounts.
        </p>
      </div>

      {message && (
        <p role={message.tone === "error" ? "alert" : "status"} className={`text-sm ${message.tone === "ok" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
          {message.text}
        </p>
      )}

      {!data ? (
        !message && <Loader className="py-8" />
      ) : (
        <>
          <form onSubmit={save} className="glass-panel p-5 rounded-2xl space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold">Dates and prize</h2>
              <span className="rounded-full bg-slate-500/15 px-2 py-0.5 text-xs font-semibold">
                {data.state === "none" ? "Off" : data.state === "live" ? "On now" : data.state === "upcoming" ? "Starting soon" : "Ended"}
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="block text-sm font-medium mb-1">First day</span>
                <input type="date" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} className={input} />
              </label>
              <label className="block">
                <span className="block text-sm font-medium mb-1">Last day</span>
                <input type="date" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} className={input} />
              </label>
              <label className="block">
                <span className="block text-sm font-medium mb-1">Prize</span>
                <input value={form.prize} maxLength={200} onChange={(e) => setForm({ ...form, prize: e.target.value })} placeholder="₦20,000 to 1st" className={input} />
              </label>
            </div>
            <p className="text-xs text-slate-500">Lagos time; the last day counts until midnight. Clear both dates to switch the contest off.</p>
            <button type="submit" disabled={busy} className="px-4 py-2 rounded-lg bg-brand-600 text-white font-semibold disabled:opacity-50">
              {busy ? "Saving…" : "Save"}
            </button>
          </form>

          <section aria-labelledby="board-heading" className="glass-panel p-5 rounded-2xl">
            <h2 id="board-heading" className="text-lg font-bold mb-3">Board</h2>
            {data.entries.length === 0 ? (
              <p className="text-sm text-slate-500">{data.state === "none" ? "Set dates to start a contest." : "No counted friends yet."}</p>
            ) : (
              <ol className="divide-y divide-slate-200 dark:divide-slate-800">
                {data.entries.map((e) => {
                  const noExams = e.friendList.filter((f) => f.examsFinished === 0).length;
                  const bursts = burstCount(e.friendList);
                  return (
                    <li key={e.userId} className="py-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="w-7 text-center font-bold tabular-nums text-slate-500">{e.rank}</span>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold truncate">{e.name ?? "No name"} <span className="font-normal text-slate-500">· {e.email}</span></p>
                          <p className="text-xs text-slate-500">
                            {e.friends} friend{e.friends === 1 ? "" : "s"} · {noExams} with no finished exam
                            {bursts > 0 && <span className="text-amber-600 dark:text-amber-400"> · {bursts} signed up within 10 minutes of another</span>}
                          </p>
                        </div>
                        <button
                          type="button"
                          aria-expanded={open === e.userId}
                          onClick={() => setOpen(open === e.userId ? null : e.userId)}
                          className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold"
                        >
                          {open === e.userId ? "Hide friends" : "Check friends"}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setConfirm(e)}
                          className="rounded-lg border border-red-300 dark:border-red-800 px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 disabled:opacity-50"
                        >
                          Disqualify
                        </button>
                      </div>
                      {open === e.userId && (
                        <div className="mt-3 overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-left text-slate-500">
                                <th scope="col" className="py-1 pr-3 font-medium">Friend</th>
                                <th scope="col" className="py-1 pr-3 font-medium">Signed up</th>
                                <th scope="col" className="py-1 pr-3 font-medium">Set up</th>
                                <th scope="col" className="py-1 font-medium text-right">Exams finished</th>
                              </tr>
                            </thead>
                            <tbody>
                              {e.friendList.map((f) => (
                                <tr key={f.email} className="border-t border-slate-200 dark:border-slate-800">
                                  <td className="py-1.5 pr-3">{f.name ?? "No name"} <span className="text-slate-500">· {f.email}</span></td>
                                  <td className="py-1.5 pr-3 whitespace-nowrap">{when(f.signedUpAt)}</td>
                                  <td className="py-1.5 pr-3 whitespace-nowrap">{when(f.onboardedAt)}</td>
                                  <td className={`py-1.5 text-right tabular-nums ${f.examsFinished === 0 ? "text-amber-600 dark:text-amber-400" : ""}`}>{f.examsFinished}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          {data.excludedUsers.length > 0 && (
            <section aria-labelledby="excluded-heading" className="glass-panel p-5 rounded-2xl">
              <h2 id="excluded-heading" className="text-lg font-bold mb-3">Disqualified</h2>
              <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                {data.excludedUsers.map((u) => (
                  <li key={u.id} className="flex items-center gap-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-sm">{u.name ?? "No name"} <span className="text-slate-500">· {u.email}</span></span>
                    <button type="button" disabled={busy} onClick={() => setExcluded(u.id, false)} className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold disabled:opacity-50">
                      Put back
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <ConfirmModal
        open={confirm !== null}
        title="Disqualify from the contest?"
        message={confirm ? `${confirm.name ?? confirm.email} comes off the board and sees a note that their entry was removed. Their bonus questions stay. You can put them back later.` : undefined}
        confirmLabel="Disqualify"
        tone="danger"
        loading={busy}
        onConfirm={() => confirm && setExcluded(confirm.userId, true)}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
