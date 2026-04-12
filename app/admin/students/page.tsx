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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

export default function StudentsPage() {
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const limit = 20;

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/users?role=STUDENT&limit=${limit}&offset=${page * limit}`)
      .then((r) => r.ok ? r.json() : { users: [], total: 0 })
      .then((data) => {
        setUsers(data.users ?? []);
        setTotal(data.total ?? 0);
      })
      .finally(() => setLoading(false));
  }, [page]);

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
                  <button
                    onClick={() => setPage((p) => p - 1)}
                    disabled={page === 0}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium border border-slate-700 text-slate-300 disabled:opacity-40 hover:bg-slate-800 transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page >= totalPages - 1}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium border border-slate-700 text-slate-300 disabled:opacity-40 hover:bg-slate-800 transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
