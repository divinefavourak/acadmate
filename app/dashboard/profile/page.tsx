"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiClient, ApiError } from "@/lib/api/client";

interface UserProfile {
  id: string;
  name: string | null;
  email: string;
  role: string;
  studentProfile: {
    id: string;
    targetYear: number | null;
    courseChoice: string | null;
    institution: string | null;
  } | null;
}

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR + i);

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    targetYear: "",
    courseChoice: "",
    institution: "",
  });

  useEffect(() => {
    apiClient<{ user: UserProfile }>("/users/me")
      .then((data) => {
        const u = data.user;
        setProfile(u);
        setForm({
          name: u.name ?? "",
          targetYear: u.studentProfile?.targetYear ? String(u.studentProfile.targetYear) : "",
          courseChoice: u.studentProfile?.courseChoice ?? "",
          institution: u.studentProfile?.institution ?? "",
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess(false);

    try {
      await apiClient("/users/me", {
        method: "PATCH",
        body: JSON.stringify({
          name: form.name || undefined,
          targetYear: form.targetYear ? Number(form.targetYear) : undefined,
          courseChoice: form.courseChoice || undefined,
          institution: form.institution || undefined,
        }),
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <h1 className="text-3xl font-bold tracking-tight">My Profile</h1>
        <div className="glass-panel p-8 rounded-2xl animate-pulse h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">My Profile</h1>
        <p className="text-slate-500 dark:text-slate-400">Update your personal details and UTME targets.</p>
      </div>

      <div className="max-w-xl">
        {/* Account info (read-only) */}
        <div className="glass-panel p-6 rounded-2xl mb-6">
          <h2 className="font-semibold text-lg mb-4">Account</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-slate-200 dark:border-slate-800">
              <span className="text-sm text-slate-500 dark:text-slate-400">Email</span>
              <span className="text-sm font-medium">{profile?.email}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-slate-500 dark:text-slate-400">Role</span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                {profile?.role}
              </span>
            </div>
          </div>
        </div>

        {/* Editable profile form */}
        <form onSubmit={handleSave} className="glass-panel p-6 rounded-2xl space-y-5">
          <h2 className="font-semibold text-lg">Profile Details</h2>

          <div className="space-y-1">
            <label className="text-sm font-medium">Full Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Your full name"
              className="w-full px-4 py-3 rounded-xl bg-white/50 dark:bg-black/50 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Target UTME Year</label>
            <select
              value={form.targetYear}
              onChange={(e) => setForm((f) => ({ ...f, targetYear: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl bg-white/50 dark:bg-black/50 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
            >
              <option value="">Select year…</option>
              {YEARS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Course Choice</label>
            <input
              type="text"
              value={form.courseChoice}
              onChange={(e) => setForm((f) => ({ ...f, courseChoice: e.target.value }))}
              placeholder="e.g. Medicine and Surgery"
              className="w-full px-4 py-3 rounded-xl bg-white/50 dark:bg-black/50 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Institution</label>
            <input
              type="text"
              value={form.institution}
              onChange={(e) => setForm((f) => ({ ...f, institution: e.target.value }))}
              placeholder="e.g. University of Lagos"
              className="w-full px-4 py-3 rounded-xl bg-white/50 dark:bg-black/50 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
            />
          </div>

          {error && (
            <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 text-sm">
              ✅ Profile saved successfully!
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="btn-primary w-full disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? "Saving…" : "Save Profile"}
          </button>
        </form>

        <div className="mt-4 text-center">
          <Link href="/dashboard" className="text-sm text-slate-500 hover:text-indigo-500 transition-colors">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
