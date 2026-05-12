"use client";

import { useRef, useState } from "react";
import { getToken } from "@/lib/api/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
const ACCEPT = "image/jpeg,image/png,image/webp,image/gif";
const MAX_BYTES = 5 * 1024 * 1024;

type Folder = "questions" | "blog";

type Props = {
  folder: Folder;
  value?: string | null;
  onChange: (url: string | null) => void;
  label?: string;
  /** Aspect ratio CSS class for the preview frame, e.g. "aspect-video", "aspect-square". */
  previewAspectClass?: string;
};

export default function CloudinaryUploader({
  folder,
  value,
  onChange,
  label = "Cover image",
  previewAspectClass = "aspect-video",
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(file: File) {
    setError("");

    if (!ACCEPT.includes(file.type)) {
      setError("Only JPEG, PNG, WebP, or GIF images are allowed.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Image must be under 5 MB.");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const token = getToken();
      const res = await fetch(`${API_URL}/api/upload?folder=${folder}`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message ?? "Upload failed.");
      }

      const data = (await res.json()) as { url: string };
      onChange(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">{label}</label>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs text-slate-400 hover:text-red-400 transition-colors"
          >
            Remove
          </button>
        )}
      </div>

      <div
        className={`${previewAspectClass} relative w-full rounded-xl overflow-hidden border-2 border-dashed border-slate-700 bg-slate-900/40 flex items-center justify-center`}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="text-center space-y-2 px-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-slate-500">
              <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
              <circle cx="9" cy="9" r="2"/>
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
            </svg>
            <p className="text-xs text-slate-500">JPEG, PNG, WebP — max 5 MB</p>
          </div>
        )}

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="absolute inset-0 w-full h-full flex items-center justify-center text-sm font-medium opacity-0 hover:opacity-100 bg-black/60 transition-opacity disabled:cursor-not-allowed"
        >
          {uploading ? "Uploading…" : value ? "Replace image" : "Choose image"}
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
