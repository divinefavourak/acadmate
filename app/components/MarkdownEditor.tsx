"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { apiClient, ApiError } from "@/lib/api/client";

// Mirrors the limits enforced by the upload endpoint.
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function altFromFilename(name: string) {
  return name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").replace(/[[\]]/g, "").trim() || "image";
}

type Props = {
  value: string;
  /**
   * Takes a value or an updater, like a state setter: an upload finishes
   * asynchronously and has to edit whatever the text is by then.
   */
  onChange: (next: string | ((prev: string) => string)) => void;
  /** Upload folder key understood by /api/upload. */
  folder: "blog" | "notes";
  label?: string;
  rows?: number;
  placeholder?: string;
  onError?: (message: string) => void;
  /** Called with the number of image uploads in flight, so the parent can hold off saving. */
  onUploadingChange?: (count: number) => void;
};

/** Markdown textarea with Write/Preview tabs and image insert (button, paste, drag-and-drop). */
export default function MarkdownEditor({
  value,
  onChange,
  folder,
  label = "Body (Markdown)",
  rows = 20,
  placeholder,
  onError,
  onUploadingChange,
}: Props) {
  const [tab, setTab] = useState<"write" | "preview">("write");
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const uploadSeq = useRef(0);
  const pendingCaret = useRef<number | null>(null);
  const [uploadingImages, setUploadingImages] = useState(0);

  useEffect(() => {
    onUploadingChange?.(uploadingImages);
  }, [uploadingImages, onUploadingChange]);

  // Changing the body from code sends the caret to the end of the textarea —
  // put it back where the insert/swap left it.
  useLayoutEffect(() => {
    if (pendingCaret.current === null) return;
    bodyRef.current?.setSelectionRange(pendingCaret.current, pendingCaret.current);
    pendingCaret.current = null;
  }, [value]);

  function swapPlaceholder(placeholder: string, replacement: string) {
    const el = bodyRef.current;
    if (el) {
      const at = el.value.indexOf(placeholder);
      const caret = el.selectionStart;
      if (at !== -1) {
        pendingCaret.current = caret > at ? caret + replacement.length - placeholder.length : caret;
      }
    }
    // Runs from an upload's promise, where React would queue the update. Commit
    // it now so no keystroke, paste or drop can read the pre-swap body (or stale
    // textarea offsets) and overwrite the swap.
    flushSync(() => {
      onChange((prev) => prev.replace(placeholder, () => replacement));
    });
  }

  async function insertImages(files: File[]) {
    const accepted: File[] = [];
    let issue = "";
    for (const file of files) {
      if (!IMAGE_TYPES.includes(file.type)) issue = "Only JPEG, PNG, WebP, or GIF images are allowed.";
      else if (file.size > MAX_IMAGE_BYTES) issue = `"${file.name}" is over 5 MB.`;
      else accepted.push(file);
    }
    onError?.(issue);
    if (!accepted.length) return;

    // Drop a placeholder per image at the cursor now, then swap each for its
    // Markdown once the upload finishes — the position holds even if the
    // author keeps typing meanwhile.
    const slots = accepted.map((file) => ({
      file,
      placeholder: `[Uploading ${file.name}… #${++uploadSeq.current}]`,
    }));
    const el = bodyRef.current;
    const before = value.slice(0, el?.selectionStart ?? value.length);
    const after = value.slice(el?.selectionEnd ?? value.length);
    // Images are block content — pad so each sits in its own paragraph.
    const lead = !before || before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
    const trail = after.startsWith("\n\n") ? "" : after.startsWith("\n") ? "\n" : "\n\n";
    const inserted = before + lead + slots.map((s) => s.placeholder).join("\n\n") + trail;
    pendingCaret.current = inserted.length;
    onChange(inserted + after);
    el?.focus();

    setUploadingImages((n) => n + slots.length);
    await Promise.all(
      slots.map(async ({ file, placeholder }) => {
        try {
          const fd = new FormData();
          fd.append("file", file);
          const { url } = await apiClient<{ url: string }>(`/api/upload?folder=${folder}`, {
            method: "POST",
            body: fd,
            timeout: 60_000,
          });
          swapPlaceholder(placeholder, `![${altFromFilename(file.name)}](${url})`);
        } catch (err) {
          swapPlaceholder(placeholder, "");
          onError?.(err instanceof ApiError ? err.message : `Could not upload "${file.name}".`);
        } finally {
          setUploadingImages((n) => n - 1);
        }
      }),
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium">{label}</label>
        <div className="flex items-center gap-2">
          {tab === "write" && (
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors"
            >
              {uploadingImages > 0 ? `Uploading ${uploadingImages}…` : "Insert image"}
            </button>
          )}
          <div className="inline-flex rounded-lg border border-slate-700 overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => setTab("write")}
              className={`px-3 py-1.5 font-medium transition-colors ${tab === "write" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"}`}
            >
              Write
            </button>
            <button
              type="button"
              onClick={() => setTab("preview")}
              className={`px-3 py-1.5 font-medium transition-colors ${tab === "preview" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"}`}
            >
              Preview
            </button>
          </div>
        </div>
      </div>

      <input
        ref={imageInputRef}
        type="file"
        accept={IMAGE_TYPES.join(",")}
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length) insertImages(files);
        }}
      />

      {tab === "write" ? (
        <>
          <textarea
            ref={bodyRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onPaste={(e) => {
              // Word/Excel put an image copy of text on the clipboard too — only take over for pure image pastes.
              const files = Array.from(e.clipboardData.files);
              if (!files.length || e.clipboardData.getData("text/plain")) return;
              e.preventDefault();
              insertImages(files);
            }}
            onDragOver={(e) => {
              if (e.dataTransfer.types.includes("Files")) e.preventDefault();
            }}
            onDrop={(e) => {
              const files = Array.from(e.dataTransfer.files);
              if (!files.length) return;
              e.preventDefault();
              insertImages(files);
            }}
            placeholder={placeholder}
            rows={rows}
            className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-mono text-sm leading-relaxed resize-y"
          />
          <p className="text-xs text-slate-500 mt-1">
            Put the cursor where a picture should go, then click Insert image — or paste or drag one in. You can add as many as you like.
          </p>
        </>
      ) : (
        <div className="prose prose-invert prose-sm max-w-none p-5 rounded-xl bg-slate-900/40 border border-slate-700 min-h-[400px]">
          {value.trim() ? (
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{value}</ReactMarkdown>
          ) : (
            <p className="text-slate-500 italic">Nothing to preview yet — start writing.</p>
          )}
        </div>
      )}
    </div>
  );
}
