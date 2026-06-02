"use client";

import { useCallback, useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Loader from "@/app/components/Loader";
import { apiClient, ApiError } from "@/lib/api/client";

type LiveStatus = "SCHEDULED" | "ACTIVE" | "ENDED";

interface PublicSession {
  code: string;
  title: string | null;
  status: LiveStatus;
  mode: string;
  durationMinutes: number;
  questionCount: number;
  subjects: { id: string; name: string }[];
  joinedCount: number;
  endsAt: string | null;
}

const POLL_INTERVAL_MS = 8_000;

export default function LiveJoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const router = useRouter();

  const [session, setSession] = useState<PublicSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);

  const fetchSession = useCallback(async () => {
    try {
      const { session: s } = await apiClient<{ session: PublicSession }>(
        `/api/live-sessions/${code}`,
        { skipAuth: true },
      );
      setSession(s);
      setError("");
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setError("__NOT_FOUND__");
      } else {
        setError(err instanceof ApiError ? err.message : "Failed to load session.");
      }
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  // Poll while the session is still scheduled so the student's "Start" button
  // unlocks the moment the tutor goes live — no manual refresh required.
  useEffect(() => {
    if (!session || session.status !== "SCHEDULED") return;
    const t = setInterval(fetchSession, POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [session, fetchSession]);

  async function handleJoin() {
    if (joining) return;
    setJoining(true);
    setError("");
    try {
      const { examSessionId } = await apiClient<{ examSessionId: string }>(
        `/api/live-sessions/${code}/join`,
        { method: "POST", on401: "throw" },
      );
      router.push(`/exam/${examSessionId}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        // Not signed in — send them to log in, then straight back to join.
        router.push(`/login?callbackUrl=${encodeURIComponent(`/live/${code}`)}`);
        return;
      }
      setError(err instanceof ApiError ? err.message : "Failed to join. Please try again.");
      setJoining(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-slate-50 dark:bg-[#09090b]">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <Image
            src="/images/logo.jpg"
            alt="Acadmate"
            width={36}
            height={36}
            className="rounded-xl shadow-md object-cover"
          />
          <span className="text-xl font-bold tracking-tight">Acadmate</span>
        </div>

        {loading ? (
          <div className="glass-panel rounded-3xl p-10">
            <Loader className="py-6" />
          </div>
        ) : error === "__NOT_FOUND__" ? (
          <Card>
            <EmptyState
              title="Session not found"
              body="Double-check the code with your tutor — it may have a typo or the session may have been removed."
            />
          </Card>
        ) : session ? (
          <Card>
            {/* Status pill */}
            <div className="flex justify-center mb-5">
              <StatusPill status={session.status} />
            </div>

            <h1 className="text-2xl font-bold text-center tracking-tight">
              {session.title || "Live Practice Session"}
            </h1>
            <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-2">
              {session.status === "ENDED"
                ? "This session has ended."
                : session.status === "ACTIVE"
                  ? "You're about to join a live session. Ready when you are."
                  : "You're in! Hang tight — your tutor will start the session shortly."}
            </p>

            {/* Details */}
            <div className="grid grid-cols-2 gap-3 mt-6">
              <Detail label="Questions" value={`${session.questionCount}`} />
              <Detail label="Time limit" value={`${session.durationMinutes} min`} />
              <Detail
                label="Joined"
                value={`${session.joinedCount}`}
              />
              <Detail
                label="Code"
                value={session.code}
                mono
              />
            </div>

            {session.subjects.length > 0 && (
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {session.subjects.map((s) => (
                  <span
                    key={s.id}
                    className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                  >
                    {s.name}
                  </span>
                ))}
              </div>
            )}

            {error && error !== "__NOT_FOUND__" && (
              <p className="mt-5 text-sm text-center text-red-500 dark:text-red-400">{error}</p>
            )}

            {/* Action */}
            <div className="mt-7">
              {session.status === "ACTIVE" ? (
                <button
                  onClick={handleJoin}
                  disabled={joining}
                  className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {joining ? (
                    "Joining…"
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                      Start Exam
                    </>
                  )}
                </button>
              ) : session.status === "SCHEDULED" ? (
                <div className="w-full flex items-center justify-center gap-2 py-3 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-sm font-semibold">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
                  </span>
                  Waiting for tutor to start…
                </div>
              ) : (
                <div className="w-full text-center py-3 rounded-full bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-sm font-semibold">
                  Session ended
                </div>
              )}
            </div>
          </Card>
        ) : (
          <Card>
            <EmptyState title="Something went wrong" body={error || "Please try again."} />
          </Card>
        )}

        <p className="text-center text-xs text-slate-400 mt-6">
          Powered by Acadmate · Practice smarter, score higher
        </p>
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="glass-panel rounded-3xl p-7 sm:p-8">{children}</div>;
}

function Detail({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl bg-slate-100/70 dark:bg-slate-900/50 px-4 py-3 text-center">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p
        className={`font-bold mt-0.5 ${
          mono
            ? "font-mono tracking-widest text-indigo-600 dark:text-indigo-400"
            : "text-slate-800 dark:text-slate-100"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function StatusPill({ status }: { status: LiveStatus }) {
  if (status === "ACTIVE") {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        Live now
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${
        status === "SCHEDULED"
          ? "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800"
          : "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/50"
      }`}
    >
      {status === "SCHEDULED" ? "Starting soon" : "Ended"}
    </span>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="text-center py-6">
      <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400"><circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>
      </div>
      <h1 className="font-bold text-lg">{title}</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5">{body}</p>
    </div>
  );
}
