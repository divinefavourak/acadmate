"use client";

import { useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { genConfig } from "react-nice-avatar";
import type { AvatarFullConfig } from "react-nice-avatar";
import { apiClient, ApiError } from "@/lib/api/client";
import UserAvatar from "@/app/components/UserAvatar";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB

export default function MockRegisterPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Avatar: a random generated config by default; the user may re-randomise or
  // upload a photo. Uploaded image wins when present.
  const [avatarConfig, setAvatarConfig] = useState<AvatarFullConfig>(() => genConfig());
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function randomizeAvatar() {
    setAvatarConfig(genConfig());
    setAvatarUrl(null);
  }

  function handleAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const file = input.files?.[0];
    // Always clear the input so re-selecting the same file fires onChange again.
    input.value = "";
    if (!file) return;
    if (file.size > MAX_AVATAR_BYTES) { setError("Image too large — please pick one under 2 MB."); return; }
    setError("");
    const reader = new FileReader();
    reader.onload = () => {
      // Downscale + square-crop to a small thumbnail so we never store/serve a
      // multi-MB data URL (keeps leaderboard polling light).
      const img = new window.Image();
      img.onload = () => {
        const size = 128;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) { setAvatarUrl(reader.result as string); return; }
        const min = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - min) / 2, (img.height - min) / 2, min, min, 0, 0, size, size);
        setAvatarUrl(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = () => setError("Could not read that image. Please try another.");
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (pin !== confirmPin) { setError("PINs do not match"); return; }
    if (!/^\d{4}$/.test(pin)) { setError("PIN must be exactly 4 digits"); return; }
    setSubmitting(true);
    try {
      await apiClient(`/api/mock/${id}/register`, {
        method: "POST",
        skipAuth: true,
        body: JSON.stringify({
          phone: phone.trim(),
          name: name.trim(),
          pin,
          ...(avatarUrl ? { avatarUrl } : { avatarConfig }),
        }),
      });
      router.push(`/mock/${id}/login?registered=1`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Registration failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Register for Mock Exam</h1>
          <p className="text-sm text-slate-400">Your phone number must be on the approved list to register.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 bg-white/5 rounded-2xl p-6">
          {/* Avatar chooser */}
          <div className="flex flex-col items-center gap-3">
            <UserAvatar
              avatarConfig={avatarUrl ? null : (avatarConfig as unknown as Record<string, unknown>)}
              avatarUrl={avatarUrl}
              name={name}
              size={88}
              className="ring-4 ring-indigo-500/40"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={randomizeAvatar}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" x2="12" y1="22.08" y2="12"/></svg>
                Randomise
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                Upload
              </button>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarFile} />
            </div>
            <p className="text-[11px] text-slate-500">Pick a fun avatar or upload your photo (max 2 MB)</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-300">Phone Number</label>
            <input
              required
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 08012345678"
              className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-300">Full Name</label>
            <input
              required
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-300">4-Digit PIN</label>
            <input
              required
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              placeholder="••••"
              className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-center text-2xl tracking-[0.5em] focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-300">Confirm PIN</label>
            <input
              required
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
              placeholder="••••"
              className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-center text-2xl tracking-[0.5em] focus:outline-none focus:border-indigo-500"
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-semibold transition-colors"
          >
            {submitting ? "Registering…" : "Register"}
          </button>
        </form>

        <p className="text-center text-sm text-slate-400">
          Already registered?{" "}
          <Link href={`/mock/${id}/login`} className="text-indigo-400 hover:text-indigo-300">Log in</Link>
        </p>
        <p className="text-center text-sm">
          <Link href={`/mock/${id}`} className="text-slate-500 hover:text-slate-300">← Back to exam info</Link>
        </p>
      </div>
    </div>
  );
}
