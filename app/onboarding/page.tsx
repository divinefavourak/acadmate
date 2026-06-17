"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiClient, ApiError } from "@/lib/api/client";
import Loader from "@/app/components/Loader";
import AvatarPicker from "@/app/components/AvatarPicker";
import UserAvatar from "@/app/components/UserAvatar";
import type { AvatarFullConfig } from "react-nice-avatar";

interface Subject {
  id: string;
  name: string;
  code: string;
}

interface MeResponse {
  id: string;
  name: string | null;
  email: string;
  onboardedAt: string | null;
  studentProfile: {
    id: string;
    age: number | null;
    institution: string | null;
    avatarConfig: Record<string, unknown> | null;
    avatarUrl: string | null;
    courseSubjectCombinations: { subjectId: string }[];
  } | null;
}

const TOTAL_STEPS = 3;

// Compulsory subjects, added automatically for Mock & Post-UTME papers.
// The student picks 2–3 electives beyond these.
const COMPULSORY_CODES = ["ENG", "MTH", "GEN"];
const COMPULSORY_LABELS = ["Use of English", "Mathematics", "General Knowledge"];

export default function OnboardingPage() {
  const router = useRouter();

  const [me, setMe] = useState<MeResponse | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Step 1
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [institution, setInstitution] = useState("");

  // Step 2
  const [utmeSubjectIds, setUtmeSubjectIds] = useState<string[]>([]);

  // Step 3
  const [avatarConfig, setAvatarConfig] = useState<AvatarFullConfig | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    Promise.allSettled([
      apiClient<MeResponse>("/api/users/me"),
      apiClient<{ subjects: Subject[] }>("/api/subjects"),
    ])
      .then(([meR, sR]) => {
        const subjectList = sR.status === "fulfilled" ? (sR.value.subjects ?? []) : [];
        if (sR.status === "fulfilled") setSubjects(subjectList);
        // Strip any compulsory subjects persisted by older profiles — the picker
        // only deals with electives now, so they'd otherwise fail backend validation.
        const compulsoryIds = new Set(
          subjectList.filter((s) => COMPULSORY_CODES.includes(s.code)).map((s) => s.id),
        );
        if (meR.status === "fulfilled") {
          const user = meR.value;
          setMe(user);
          if (user.onboardedAt) {
            router.replace("/dashboard");
            return;
          }
          setName(user.name ?? "");
          setAge(user.studentProfile?.age ? String(user.studentProfile.age) : "");
          setInstitution(user.studentProfile?.institution ?? "");
          setAvatarConfig((user.studentProfile?.avatarConfig as AvatarFullConfig) ?? null);
          setAvatarUrl(user.studentProfile?.avatarUrl ?? null);
          setUtmeSubjectIds(
            (user.studentProfile?.courseSubjectCombinations.map((c) => c.subjectId) ?? [])
              .filter((id) => !compulsoryIds.has(id)),
          );
        }
      })
      .finally(() => setLoading(false));
  }, [router]);

  const otherSubjects = useMemo(
    () => subjects.filter((s) => !COMPULSORY_CODES.includes(s.code)),
    [subjects],
  );

  function toggleSubject(id: string) {
    setUtmeSubjectIds((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length < 3
        ? [...prev, id]
        : prev,
    );
  }

  function validateStep1(): string | null {
    if (!name.trim()) return "Please enter your full name.";
    const ageNum = Number(age);
    if (!Number.isInteger(ageNum) || ageNum < 10 || ageNum > 99) {
      return "Please enter a valid age between 10 and 99.";
    }
    if (!institution.trim()) return "Please enter your target institution.";
    return null;
  }

  function validateStep2(): string | null {
    if (utmeSubjectIds.length < 2 || utmeSubjectIds.length > 3) {
      return "Please pick 2 or 3 elective subjects (English, Maths & General Knowledge are automatic).";
    }
    return null;
  }

  function handleNext() {
    setError("");
    const issue = step === 1 ? validateStep1() : step === 2 ? validateStep2() : null;
    if (issue) {
      setError(issue);
      return;
    }
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  }

  function handleBack() {
    setError("");
    setStep((s) => Math.max(s - 1, 1));
  }

  async function handleFinish(skipAvatar: boolean) {
    setError("");
    const issue = validateStep1() ?? validateStep2();
    if (issue) {
      setError(issue);
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        age: Number(age),
        institution: institution.trim(),
        utmeSubjectIds,
      };
      if (!skipAvatar) {
        if (avatarUrl) payload.avatarUrl = avatarUrl;
        else if (avatarConfig) payload.avatarConfig = avatarConfig;
      }
      await apiClient("/api/users/me/onboarding", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save onboarding. Please try again.");
      setSubmitting(false);
    }
  }

  if (loading) {
    return <Loader className="py-24" />;
  }

  return (
    <div className="space-y-8">
      <div className="text-center space-y-3">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          Let&apos;s set up your account
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          A few quick details so we can tailor your practice.
        </p>

        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 pt-2">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((n) => (
            <span
              key={n}
              className={`h-1.5 rounded-full transition-all ${
                n === step
                  ? "w-8 bg-indigo-500"
                  : n < step
                  ? "w-6 bg-indigo-500/60"
                  : "w-6 bg-slate-300 dark:bg-slate-700"
              }`}
            />
          ))}
        </div>
        <p className="text-xs text-slate-400">
          Step {step} of {TOTAL_STEPS}
        </p>
      </div>

      <div className="glass-panel p-6 sm:p-8 rounded-3xl">
        {step === 1 && (
          <div className="space-y-5">
            <h2 className="font-semibold text-lg">The basics</h2>

            <div className="space-y-1">
              <label className="text-sm font-medium">Full name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                required
                className="w-full px-4 py-3 rounded-xl bg-white/50 dark:bg-black/50 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Age</label>
              <input
                type="number"
                inputMode="numeric"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="e.g. 17"
                min={10}
                max={99}
                required
                className="w-full px-4 py-3 rounded-xl bg-white/50 dark:bg-black/50 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Target institution</label>
              <input
                type="text"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                placeholder="e.g. University of Lagos"
                required
                className="w-full px-4 py-3 rounded-xl bg-white/50 dark:bg-black/50 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
              />
              <p className="text-xs text-slate-500 pt-1">
                The university you&apos;re aiming for. Drives Post-UTME paper selection.
              </p>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="font-semibold text-lg">Your subjects</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                English, Mathematics and General Knowledge are compulsory. Pick 2 or 3 electives to complete your combination. We&apos;ll use this for Mock and Post-UTME papers.
              </p>
            </div>

            <div className="space-y-2">
              {COMPULSORY_LABELS.map((label) => (
                <div key={label} className="flex items-center gap-3 p-3 rounded-xl border-2 border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20">
                  <div className="shrink-0 w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <div className="font-semibold text-sm">{label}</div>
                  <span className="ml-auto text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/40 px-2 py-0.5 rounded-full">
                    Compulsory
                  </span>
                </div>
              ))}
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">
                  {utmeSubjectIds.length >= 2
                    ? `${utmeSubjectIds.length} elective${utmeSubjectIds.length > 1 ? "s" : ""} selected`
                    : `Pick ${2 - utmeSubjectIds.length} more (up to 3)`}
                </span>
                {utmeSubjectIds.length > 0 && (
                  <button
                    onClick={() => setUtmeSubjectIds([])}
                    className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {otherSubjects.map((s) => {
                  const selected = utmeSubjectIds.includes(s.id);
                  const disabled = !selected && utmeSubjectIds.length >= 3;
                  return (
                    <button
                      key={s.id}
                      onClick={() => toggleSubject(s.id)}
                      disabled={disabled}
                      className={`px-3 py-2.5 rounded-xl border-2 text-sm font-medium text-left transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
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
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div>
              <h2 className="font-semibold text-lg">Pick an avatar</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Optional — you can also skip and set this later from your profile.
              </p>
            </div>

            <div className="flex justify-center pb-2">
              <UserAvatar
                avatarConfig={avatarConfig as Record<string, unknown> | null}
                avatarUrl={avatarUrl}
                name={name || me?.name}
                size={96}
              />
            </div>

            <AvatarPicker
              initialConfig={avatarConfig as Record<string, unknown> | null}
              initialUrl={avatarUrl}
              onSave={async ({ avatarConfig: cfg, avatarUrl: url }) => {
                if (url) {
                  setAvatarUrl(url);
                  setAvatarConfig(null);
                } else if (cfg) {
                  setAvatarConfig(cfg);
                  setAvatarUrl(null);
                }
              }}
            />
          </div>
        )}

        {error && (
          <div className="mt-5 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="mt-6 flex items-center justify-between gap-3">
          {step > 1 ? (
            <button
              onClick={handleBack}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl text-sm font-medium border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              Back
            </button>
          ) : (
            <span />
          )}

          {step < TOTAL_STEPS ? (
            <button
              onClick={handleNext}
              className="btn-primary flex items-center gap-2"
            >
              Continue
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleFinish(true)}
                disabled={submitting}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 disabled:opacity-50 transition-colors"
              >
                Skip avatar
              </button>
              <button
                onClick={() => handleFinish(false)}
                disabled={submitting}
                className="btn-primary disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? "Saving…" : "Finish"}
              </button>
            </div>
          )}
        </div>
      </div>

      <p className="text-center text-xs text-slate-400">
        Wrong account?{" "}
        <Link href="/login" className="text-indigo-500 hover:text-indigo-600 font-medium">
          Sign in again
        </Link>
      </p>
    </div>
  );
}
