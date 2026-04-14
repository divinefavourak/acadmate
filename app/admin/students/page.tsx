"use client";

import { useEffect, useState } from "react";

interface UserEntry {
  id: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: string;
  _count: { examSessions: number };
}

interface UserDetail {
  user: {
    id: string;
    name: string | null;
    email: string;
    role: string;
    createdAt: string;
    studentProfile: { targetYear: number | null; courseChoice: string | null; institution: string | null } | null;
    _count: { examSessions: number };
  };
  recentSessions: {
    id: string;
    mode: string;
    status: string;
    totalQuestions: number;
    startedAt: string;
    submittedAt: string | null;
    result: { score: number; correct: number } | null;
  }[];
  totalExams: number;
  averageScore: number;
  bestScore: number;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

export default function StudentsPage() {
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);
  const limit = 20;

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/users?role=STUDENT&limit=${limit}&offset=${page * limit}`)
      .then((r) => r.ok ? r.json() : { users: [], total: 0 })
      .then((data) => { setUsers(data.users ?? []); setTotal(data.total ?? 0); })
      .finally(() => setLoading(false));
  }, [page]);

  async function openDetail(id: string) {
    setLoadingDetail(id);
    try {
      const res = await fetch(`/api/admin/users/${id}`);
      if (res.ok) setDetail(await res.json());
    } finally {
      setLoadingDetail(null);
    }
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Students</h1>
        <p className="text-slate-400">All registered student accounts.</p>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
        {loading ? (
          <p className="text-slate-400 text-sm py-8 text-center">Loading…</p>
        ) : users.length === 0 ? (
          <p className="text-slate-400 text-sm py-8 text-center">No students found.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400">
                    <th className="pb-3 font-medium">Name</th>
                    <th className="pb-3 font-medium">Email</th>
                    <th className="pb-3 font-medium">Joined</th>
                    <th className="pb-3 font-medium text-right">Exams</th>
                    <th className="pb-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, i) => (
                    <tr
                      key={u.id}
                      className={`${i < users.length - 1 ? "border-b border-slate-800" : ""} hover:bg-slate-800/50 transition-colors`}
                    >
                      <td className="py-3 font-medium text-white">{u.name ?? "—"}</td>
                      <td className="py-3 text-slate-400">{u.email}</td>
                      <td className="py-3 text-slate-400">{formatDate(u.createdAt)}</td>
                      <td className="py-3 text-right text-slate-300">{u._count.examSessions}</td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => openDetail(u.id)}
                          disabled={loadingDetail === u.id}
                          className="inline-flex items-center px-2.5 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium transition-colors disabled:opacity-50"
                        >
                          {loadingDetail === u.id ? "…" : "View"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-700">
                <p className="text-sm text-slate-400">
                  {page * limit + 1}–{Math.min((page + 1) * limit, total)} of {total} students
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setPage((p) => p - 1)} disabled={page === 0}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium border border-slate-700 text-slate-300 disabled:opacity-40 hover:bg-slate-800 transition-colors">
                    Previous
                  </button>
                  <button onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages - 1}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium border border-slate-700 text-slate-300 disabled:opacity-40 hover:bg-slate-800 transition-colors">
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* User Detail Modal */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-700 flex justify-between items-start shrink-0">
              <div>
                <h3 className="text-xl font-bold text-white mb-1">{detail.user.name ?? "Unnamed Student"}</h3>
                <p className="text-sm text-slate-400">{detail.user.email}</p>
              </div>
              <button onClick={() => setDetail(null)} className="text-slate-400 hover:text-white transition-colors text-lg">✕</button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Total Exams", value: detail.totalExams },
                  { label: "Avg Score", value: `${detail.averageScore}%` },
                  { label: "Best Score", value: `${Math.round(detail.bestScore)}%` },
                ].map((s) => (
                  <div key={s.label} className="bg-slate-800 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-white mb-1">{s.value}</p>
                    <p className="text-xs text-slate-400">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Profile */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Profile</h4>
                <div className="bg-slate-800/50 rounded-xl p-4 text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Joined</span>
                    <span className="text-slate-200">{formatDate(detail.user.createdAt)}</span>
                  </div>
                  {detail.user.studentProfile?.targetYear && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Target Year</span>
                      <span className="text-slate-200">{detail.user.studentProfile.targetYear}</span>
                    </div>
                  )}
                  {detail.user.studentProfile?.institution && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Institution</span>
                      <span className="text-slate-200">{detail.user.studentProfile.institution}</span>
                    </div>
                  )}
                  {detail.user.studentProfile?.courseChoice && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Course Choice</span>
                      <span className="text-slate-200">{detail.user.studentProfile.courseChoice}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Exams */}
              {detail.recentSessions.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Recent Exams</h4>
                  <div className="space-y-2">
                    {detail.recentSessions.map((s) => (
                      <div key={s.id} className="bg-slate-800/50 rounded-xl p-3 flex items-center justify-between text-sm">
                        <div>
                          <span className="text-white font-medium">{s.mode}</span>
                          <span className="ml-2 text-slate-500 text-xs">{s.totalQuestions}Q</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-400 text-xs">{s.startedAt ? formatDate(s.startedAt) : "—"}</span>
                          {s.result ? (
                            <span className={`font-bold text-sm ${s.result.score >= 50 ? "text-emerald-400" : "text-red-400"}`}>
                              {Math.round(s.result.score)}%
                            </span>
                          ) : (
                            <span className="text-slate-500 text-xs">{s.status}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
