"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api/client";
import Loader from "@/app/components/Loader";

interface SubjectEntry {
  id: string;
  name: string;
  code: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  _count: { questions: number; topics: number };
}

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<SubjectEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient<{ subjects: SubjectEntry[] }>("/admin/subjects")
      .then((data) => setSubjects(data.subjects ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function toggleActive(id: string, current: boolean) {
    await apiClient(`/admin/subjects/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ isActive: !current }),
    }).catch(() => {});
    setSubjects((prev) =>
      prev.map((s) => s.id === id ? { ...s, isActive: !current } : s)
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Subjects</h1>
        <p className="text-slate-400">Manage UTME subjects.</p>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
        {loading ? (
          <Loader />
        ) : subjects.length === 0 ? (
          <p className="text-slate-400 text-sm py-8 text-center">No subjects found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400">
                  <th className="pb-3 font-medium">Subject</th>
                  <th className="pb-3 font-medium">Code</th>
                  <th className="pb-3 font-medium">Topics</th>
                  <th className="pb-3 font-medium">Questions</th>
                  <th className="pb-3 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((s, i) => (
                  <tr
                    key={s.id}
                    className={`${i < subjects.length - 1 ? "border-b border-slate-800" : ""} hover:bg-slate-800/50 transition-colors`}
                  >
                    <td className="py-3">
                      <p className="font-medium text-white">{s.name}</p>
                      {s.description && <p className="text-xs text-slate-500 mt-0.5">{s.description}</p>}
                    </td>
                    <td className="py-3 text-slate-400 font-mono">{s.code}</td>
                    <td className="py-3 text-slate-300">{s._count.topics}</td>
                    <td className="py-3 text-slate-300">{s._count.questions}</td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => toggleActive(s.id, s.isActive)}
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                          s.isActive
                            ? "bg-emerald-900/30 text-emerald-400 hover:bg-emerald-900/50"
                            : "bg-slate-700 text-slate-400 hover:bg-slate-600"
                        }`}
                      >
                        {s.isActive ? "Active" : "Inactive"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
