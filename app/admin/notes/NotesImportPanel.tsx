"use client";

import { useRef, useState } from "react";
import { apiClient, ApiError } from "@/lib/api/client";

interface ReportRow {
  row: number;
  subject: string;
  topic: string;
  status: "ok" | "error";
  sections: number;
  message?: string;
}

interface ImportResult {
  dryRun: boolean;
  imported: number;
  errors: number;
  report: ReportRow[];
}

const SAMPLE = `[
  {
    "subject": "Biology",
    "topic": "Cell Structure",
    "access": "FREE",
    "sections": [
      { "title": "What is a cell?", "body": "A cell is the **basic unit of life**..." },
      { "title": "Organelles", "body": "- Nucleus\\n- Mitochondria" }
    ]
  }
]`;

/** Bulk import of note sections from a JSON file: check first, then import as drafts. */
export default function NotesImportPanel({ onImported }: { onImported: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [filename, setFilename] = useState("");
  const [items, setItems] = useState<unknown[] | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send(list: unknown[], dryRun: boolean) {
    setBusy(true);
    setError("");
    try {
      const data = await apiClient<ImportResult>("/api/admin/notes/import", {
        method: "POST",
        body: JSON.stringify({ items: list, dryRun }),
        timeout: 60_000,
      });
      setResult(data);
      if (!data.dryRun) {
        setItems(null);
        onImported();
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Import failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleFile(file: File) {
    setFilename(file.name);
    setResult(null);
    setItems(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      return setError("That file is not valid JSON.");
    }
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return setError("The file must be a non-empty JSON list of topics.");
    }
    setItems(parsed);
    await send(parsed, true);
  }

  const totalSections = result?.report.reduce((n, r) => n + (r.status === "ok" ? r.sections : 0), 0) ?? 0;

  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="space-y-3 text-sm text-slate-400">
          <p>
            Upload a JSON file with one entry per topic. Subjects and topics must already exist and are matched by
            name (subjects also by code), ignoring case.
          </p>
          <p>
            Imported sections are saved as <span className="text-amber-300">drafts</span>, after any sections the
            topic already has. <code>access</code> is optional and sets the topic to Free or Premium.
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="px-4 py-2 rounded-xl text-sm font-medium border border-slate-700 text-slate-200 hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              {busy ? "Working…" : "Choose JSON file"}
            </button>
            {filename && <span className="text-xs text-slate-500 truncate">{filename}</span>}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void handleFile(file);
            }}
          />
        </div>
        <pre className="text-xs text-slate-400 bg-slate-950/60 border border-slate-800 rounded-xl p-4 overflow-x-auto">{SAMPLE}</pre>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {result && (
        <div className="space-y-3">
          {!result.dryRun ? (
            <p className="text-sm text-emerald-300">
              Imported {result.imported} section{result.imported === 1 ? "" : "s"} as drafts. Open a topic to review and publish.
            </p>
          ) : result.errors > 0 ? (
            <p className="text-sm text-red-300">
              {result.errors} of {result.report.length} entries have problems. Fix the file and upload it again — nothing was imported.
            </p>
          ) : (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-sm text-slate-300">
                File looks good: {totalSections} section{totalSections === 1 ? "" : "s"} across {result.report.length} entr{result.report.length === 1 ? "y" : "ies"}.
              </p>
              <button
                onClick={() => items && send(items, false)}
                disabled={busy || !items}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 transition-colors"
              >
                {busy ? "Importing…" : `Import ${totalSections} section${totalSections === 1 ? "" : "s"}`}
              </button>
            </div>
          )}

          <div className="rounded-xl border border-slate-800 overflow-x-auto max-h-72 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="text-slate-500 uppercase tracking-wider text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">Subject</th>
                  <th className="px-3 py-2 font-medium">Topic</th>
                  <th className="px-3 py-2 font-medium">Sections</th>
                  <th className="px-3 py-2 font-medium">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {result.report.map((r) => (
                  <tr key={r.row}>
                    <td className="px-3 py-2 text-slate-500 tabular-nums">{r.row}</td>
                    <td className="px-3 py-2">{r.subject || "—"}</td>
                    <td className="px-3 py-2">{r.topic || "—"}</td>
                    <td className="px-3 py-2 tabular-nums">{r.sections}</td>
                    <td className={`px-3 py-2 ${r.status === "ok" ? "text-emerald-400" : "text-red-400"}`}>
                      {r.status === "ok" ? "OK" : r.message}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
