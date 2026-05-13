"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Loader from "@/app/components/Loader";
import { apiClient, ApiError } from "@/lib/api/client";
import { signOut } from "@/lib/api/auth";
import UserAvatar from "@/app/components/UserAvatar";
import AvatarPicker from "@/app/components/AvatarPicker";
import type { AvatarFullConfig } from "react-nice-avatar";

interface UserProfile {
  id: string;
  name: string | null;
  email: string;
  role: string;
  studentProfile: {
    id: string;
    age: number | null;
    targetYear: number | null;
    courseChoice: string | null;
    institution: string | null;
    avatarConfig: Record<string, unknown> | null;
    avatarUrl: string | null;
    courseSubjectCombinations: { subjectId: string }[];
  } | null;
}

interface SubjectLite {
  id: string;
  name: string;
  code: string;
}

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR + i);

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const [form, setForm] = useState({
    name: "",
    age: "",
    targetYear: "",
    courseChoice: "",
    institution: "",
  });
  const [utmeSubjectIds, setUtmeSubjectIds] = useState<string[]>([]);
  const [subjects, setSubjects] = useState<SubjectLite[]>([]);

  useEffect(() => {
    Promise.allSettled([
      apiClient<UserProfile>("/api/users/me"),
      apiClient<{ subjects: SubjectLite[] }>("/api/subjects"),
    ])
      .then(([uRes, sRes]) => {
        if (uRes.status === "fulfilled") {
          const u = uRes.value;
          setProfile(u);
          setForm({
            name: u.name ?? "",
            age: u.studentProfile?.age ? String(u.studentProfile.age) : "",
            targetYear: u.studentProfile?.targetYear ? String(u.studentProfile.targetYear) : "",
            courseChoice: u.studentProfile?.courseChoice ?? "",
            institution: u.studentProfile?.institution ?? "",
          });
          setUtmeSubjectIds(
            u.studentProfile?.courseSubjectCombinations.map((c) => c.subjectId) ?? [],
          );
        }
        if (sRes.status === "fulfilled") setSubjects(sRes.value.subjects ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  function toggleUtmeSubject(id: string) {
    setUtmeSubjectIds((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length < 3
        ? [...prev, id]
        : prev,
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess(false);

    const ageNum = form.age ? Number(form.age) : undefined;
    if (ageNum !== undefined && (!Number.isInteger(ageNum) || ageNum < 10 || ageNum > 99)) {
      setError("Age must be between 10 and 99.");
      setSaving(false);
      return;
    }
    if (utmeSubjectIds.length > 0 && utmeSubjectIds.length !== 3) {
      setError("Pick exactly 3 UTME subjects, or clear the selection.");
      setSaving(false);
      return;
    }

    try {
      const updated = await apiClient<UserProfile>("/api/users/me", {
        method: "PATCH",
        body: JSON.stringify({
          name: form.name || undefined,
          age: ageNum,
          targetYear: form.targetYear ? Number(form.targetYear) : undefined,
          courseChoice: form.courseChoice || undefined,
          institution: form.institution || undefined,
          utmeSubjectIds,
        }),
      });
      setProfile(updated);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarSave(data: { avatarConfig?: AvatarFullConfig; avatarUrl?: string }) {
    const updated = await apiClient<UserProfile>("/api/users/me", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    setProfile(updated);
    setShowAvatarPicker(false);
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    setDeleteError("");
    try {
      await apiClient("/api/users/me", { method: "DELETE" });
      await signOut();
      router.replace("/");
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "Failed to delete account.");
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <h1 className="text-3xl font-bold tracking-tight">My Profile</h1>
        <Loader className="h-64" />
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
        {/* Avatar section */}
        <div className="glass-panel p-6 rounded-2xl mb-6">
          <h2 className="font-semibold text-lg mb-4">Avatar</h2>
          {showAvatarPicker ? (
            <div>
              <AvatarPicker
                initialConfig={profile?.studentProfile?.avatarConfig}
                initialUrl={profile?.studentProfile?.avatarUrl}
                onSave={handleAvatarSave}
              />
              <button
                onClick={() => setShowAvatarPicker(false)}
                className="mt-4 w-full text-sm text-slate-500 hover:text-slate-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-5">
              <UserAvatar
                avatarConfig={profile?.studentProfile?.avatarConfig}
                avatarUrl={profile?.studentProfile?.avatarUrl}
                name={profile?.name}
                size={72}
              />
              <div>
                <p className="text-sm text-slate-400 mb-2">
                  {profile?.studentProfile?.avatarUrl
                    ? "Custom photo"
                    : profile?.studentProfile?.avatarConfig
                    ? "Generated avatar"
                    : "No avatar set"}
                </p>
                <button
                  onClick={() => setShowAvatarPicker(true)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Change Avatar
                </button>
              </div>
            </div>
          )}
        </div>

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
            <label className="text-sm font-medium">Age</label>
            <input
              type="number"
              inputMode="numeric"
              min={10}
              max={99}
              value={form.age}
              onChange={(e) => setForm((f) => ({ ...f, age: e.target.value }))}
              placeholder="e.g. 17"
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

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">UTME Subject Combination</label>
              {utmeSubjectIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setUtmeSubjectIds([])}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  Clear
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Use of English is included automatically — pick the 3 other subjects you&apos;ll write.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {subjects
                .filter((s) => s.code !== "ENG")
                .map((s) => {
                  const selected = utmeSubjectIds.includes(s.id);
                  const disabled = !selected && utmeSubjectIds.length >= 3;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleUtmeSubject(s.id)}
                      disabled={disabled}
                      className={`px-3 py-2 rounded-lg border text-xs font-medium text-left transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                        selected
                          ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300"
                          : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                      }`}
                    >
                      {s.name}
                    </button>
                  );
                })}
            </div>
          </div>

          {error && (
            <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 text-sm">
              Profile saved successfully!
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

        {/* Danger Zone */}
        <div className="mt-6 glass-panel p-6 rounded-2xl border border-red-900/40">
          <h2 className="font-semibold text-lg text-red-400 mb-1">Danger Zone</h2>
          <p className="text-sm text-slate-400 mb-4">Permanently delete your account and all associated data. This cannot be undone.</p>

          {showDeleteConfirm ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-300">
                Type your email address <span className="font-mono text-white">{profile?.email}</span> to confirm:
              </p>
              <input
                type="email"
                value={deleteEmail}
                onChange={(e) => setDeleteEmail(e.target.value)}
                placeholder={profile?.email ?? "your@email.com"}
                className="w-full px-4 py-3 rounded-xl bg-black/50 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all text-sm"
              />
              {deleteError && (
                <p className="text-sm text-red-400">{deleteError}</p>
              )}
              <div className="flex gap-3">
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleting || deleteEmail !== profile?.email}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {deleting ? "Deleting…" : "Delete my account"}
                </button>
                <button
                  onClick={() => { setShowDeleteConfirm(false); setDeleteEmail(""); setDeleteError(""); }}
                  disabled={deleting}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-medium rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 bg-red-950/40 hover:bg-red-900/50 border border-red-800 text-red-400 hover:text-red-300 text-sm font-medium rounded-lg transition-colors"
            >
              Delete Account
            </button>
          )}
        </div>

        <div className="mt-4 text-center">
          <Link href="/dashboard" className="text-sm text-slate-500 hover:text-indigo-500 transition-colors">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
