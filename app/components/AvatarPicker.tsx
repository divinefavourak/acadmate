"use client";

import React, { useState, useRef } from "react";
import ReactNiceAvatar, { genConfig } from "react-nice-avatar";
import type { AvatarFullConfig } from "react-nice-avatar";

const NiceAvatar = ReactNiceAvatar as React.ComponentType<AvatarFullConfig & { style?: React.CSSProperties; className?: string }>;

type Props = {
  initialConfig?: Record<string, unknown> | null;
  initialUrl?: string | null;
  onSave: (data: { avatarConfig?: AvatarFullConfig; avatarUrl?: string }) => Promise<void>;
};

export default function AvatarPicker({ initialConfig, initialUrl, onSave }: Props) {
  const [config, setConfig] = useState<AvatarFullConfig>(
    initialConfig ? (initialConfig as AvatarFullConfig) : genConfig()
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialUrl ?? null);
  const [mode, setMode] = useState<"generated" | "upload">(initialUrl ? "upload" : "generated");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const randomize = () => {
    setConfig(genConfig());
    setPreviewUrl(null);
    setMode("generated");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPreviewUrl(reader.result as string);
      setMode("upload");
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (mode === "upload" && previewUrl) {
        await onSave({ avatarUrl: previewUrl, avatarConfig: undefined });
      } else {
        await onSave({ avatarConfig: config, avatarUrl: "" });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Preview */}
      <div className="relative">
        {mode === "upload" && previewUrl ? (
          <img
            src={previewUrl}
            alt="avatar preview"
            className="w-28 h-28 rounded-full object-cover ring-4 ring-indigo-500/40"
          />
        ) : (
          <NiceAvatar
            style={{ width: 112, height: 112 }}
            className="rounded-full ring-4 ring-indigo-500/40"
            {...config}
          />
        )}
      </div>

      {/* Mode tabs */}
      <div className="flex rounded-xl overflow-hidden border border-slate-700 text-sm">
        <button
          onClick={() => setMode("generated")}
          className={`px-4 py-2 font-medium transition-colors ${
            mode === "generated" ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"
          }`}
        >
          Generated
        </button>
        <button
          onClick={() => setMode("upload")}
          className={`px-4 py-2 font-medium transition-colors ${
            mode === "upload" ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"
          }`}
        >
          Upload Photo
        </button>
      </div>

      {mode === "generated" ? (
        <button
          onClick={randomize}
          className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" x2="12" y1="22.08" y2="12"/></svg>
          Randomize
        </button>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
            Choose Image
          </button>
          <p className="text-xs text-slate-500">JPG, PNG, WebP — max 2 MB</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
      >
        {saving ? "Saving…" : "Save Avatar"}
      </button>
    </div>
  );
}
