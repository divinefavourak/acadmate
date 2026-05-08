"use client";

import { useEffect, useState, useRef } from "react";
import MathText from "@/app/components/MathText";
import { apiClient, ApiError } from "@/lib/api/client";

interface ImportEntry {
  id: string;
  filename: string;
  format: string;
  status: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  publishedRows: number;
  createdAt: string;
  uploadedBy: { name: string | null; email: string };
}

interface ParsedRow {
  subject: string;
  topic?: string;
  text: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: string;
  year?: string;
  difficulty?: string;
  explanation?: string;
  [key: string]: unknown;
}

const statusColors: Record<string, string> = {
  DONE: "bg-emerald-900/30 text-emerald-400",
  PROCESSING: "bg-amber-900/30 text-amber-400",
  PENDING: "bg-slate-700 text-slate-400",
  FAILED: "bg-red-900/30 text-red-400",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

const CSV_TEMPLATE = `subject,topic,text,optionA,optionB,optionC,optionD,correctOption,year,difficulty,explanation
Mathematics,Algebra,"What is 2+2?","2","3","4","5","C",2024,EASY,"Basic addition: 2+2=4"`;

function parseFile(file: File, text: string): ParsedRow[] {
  if (file.name.endsWith(".json")) {
    return JSON.parse(text) as ParsedRow[];
  }
  const lines = text.trim().split("\n");
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map((line) => {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; }
      else if (ch === "," && !inQuotes) { values.push(current); current = ""; }
      else { current += ch; }
    }
    values.push(current);
    return Object.fromEntries(headers.map((h, i) => [h, values[i]?.trim() ?? ""])) as ParsedRow;
  });
}

const OPTION_LABELS = ["A", "B", "C", "D"];
const OPTION_KEYS = ["optionA", "optionB", "optionC", "optionD"] as const;

function PreviewModal({
  rows,
  filename,
  onConfirm,
  onCancel,
  uploading,
}: {
  rows: ParsedRow[];
  filename: string;
  onConfirm: () => void;
  onCancel: () => void;
  uploading: boolean;
}) {
  const [page, setPage] = useState(0);
  const perPage = 10;
  const totalPages = Math.ceil(rows.length / perPage);
  const visible = rows.slice(page * perPage, (page + 1) * perPage);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-700 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-white">Preview Upload</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {rows.length} questions from <span className="font-mono text-slate-300">{filename}</span>
            </p>
          </div>
          <button onClick={onCancel} className="p-2 rounded-full hover:bg-slate-800 text-slate-400 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>

        {/* Questions list */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {visible.map((row, i) => {
            const globalIdx = page * perPage + i;
            const correct = (row.correctOption ?? "").toUpperCase();
            return (
              <div key={globalIdx} className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 text-xs font-bold text-indigo-400 bg-indigo-900/30 rounded-full px-2.5 py-1 mt-0.5">
                    Q{globalIdx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-100 leading-relaxed">
                      <MathText text={row.text || "(no question text)"} />
                    </p>
                    {(row.subject || row.topic) && (
                      <div className="flex gap-2 mt-1.5 flex-wrap">
                        {row.subject && <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{row.subject}</span>}
                        {row.topic && <span className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full">{row.topic}</span>}
                        {row.year && <span className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full">{row.year}</span>}
                        {row.difficulty && <span className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full">{row.difficulty}</span>}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {OPTION_KEYS.map((key, idx) => {
                    const label = OPTION_LABELS[idx];
                    const isCorrect = correct === label;
                    return (
                      <div
                        key={key}
                        className={`flex items-start gap-2.5 px-3 py-2 rounded-lg text-sm ${
                          isCorrect
                            ? "bg-emerald-900/30 border border-emerald-700/50 text-emerald-300"
                            : "bg-slate-900/40 border border-slate-700/40 text-slate-400"
                        }`}
                      >
                        <span className={`flex-shrink-0 font-bold text-xs mt-0.5 ${isCorrect ? "text-emerald-400" : "text-slate-500"}`}>
                          {label}
                        </span>
                        <span className="leading-snug">
                          <MathText text={String(row[key] ?? "")} />
                        </span>
                      </div>
                    );
                  })}
                </div>

                {row.explanation && (
                  <p className="text-xs text-slate-500 italic border-l-2 border-slate-700 pl-3">
                    <MathText text={String(row.explanation)} />
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Pagination + actions */}
        <div className="flex items-center justify-between p-5 border-t border-slate-700 flex-shrink-0 gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 0}
              className="px-3 py-1.5 rounded-lg text-sm border border-slate-700 text-slate-300 disabled:opacity-40 hover:bg-slate-800 transition-colors"
            >
              Previous
            </button>
            <span className="text-xs text-slate-500">
              {page + 1} / {totalPages} pages · {rows.length} total
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 rounded-lg text-sm border border-slate-700 text-slate-300 disabled:opacity-40 hover:bg-slate-800 transition-colors"
            >
              Next
            </button>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              disabled={uploading}
              className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={uploading}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 active:scale-95"
            >
              {uploading ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                  Uploading…
                </>
              ) : (
                <>Confirm & Upload {rows.length} Questions</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ImportsPage() {
  const [imports, setImports] = useState<ImportEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [loadError, setLoadError] = useState("");
  const limit = 20;

  // Publish state
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [publishResult, setPublishResult] = useState<{ id: string; success: boolean; message: string } | null>(null);

  async function handlePublish(imp: ImportEntry) {
    setPublishingId(imp.id);
    setPublishResult(null);
    try {
      const data = await apiClient<{ published: number }>(`/api/admin/imports/${imp.id}/publish`, { method: "POST" });
      setPublishResult({ id: imp.id, success: true, message: `${data.published} questions published.` });
      loadImports(page);
    } catch (e) {
      setPublishResult({ id: imp.id, success: false, message: (e as Error).message });
    } finally {
      setPublishingId(null);
    }
  }

  // Upload state
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ success: boolean; message: string; details?: string } | null>(null);

  // Preview state
  const [previewRows, setPreviewRows] = useState<ParsedRow[] | null>(null);
  const [previewFilename, setPreviewFilename] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [fileLabel, setFileLabel] = useState("Click to choose CSV or JSON file");

  function loadImports(p = 0) {
    setLoading(true);
    apiClient<{ imports: ImportEntry[]; total: number }>(`/api/admin/imports?limit=${limit}&offset=${p * limit}`)
      .then((data) => {
        setImports(data.imports ?? []);
        setTotal(data.total ?? 0);
      })
      .catch((err) => {
        console.error("Failed to load imports", err);
        setLoadError("Failed to load import history. Please refresh.");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadImports(page); }, [page]);

  const totalPages = Math.ceil(total / limit);

  async function handleFileChange() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setFileLabel(file.name);
    setUploadResult(null);
    setParseError(null);

    try {
      const text = await file.text();
      const rows = parseFile(file, text);
      if (!Array.isArray(rows) || rows.length === 0) {
        setParseError("File parsed to an empty list. Check the format.");
        return;
      }
      setPreviewRows(rows);
      setPreviewFilename(file.name);
    } catch (e) {
      setParseError(`Failed to parse file: ${(e as Error).message}`);
    }
  }

  async function handleConfirmUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file || !previewRows) return;

    setUploading(true);

    try {
      const data = await apiClient<{ created: number; totalRows: number; errors?: string[] }>("/api/admin/imports", {
        method: "POST",
        body: JSON.stringify({ filename: file.name, rows: previewRows }),
      });

      setPreviewRows(null);
      setUploadResult({
        success: true,
        message: `✅ Import complete: ${data.created} questions created from ${data.totalRows} rows.`,
        details: data.errors?.length > 0 ? `${data.errors.length} rows had errors and were skipped.` : undefined,
      });
      if (fileRef.current) fileRef.current.value = "";
      setFileLabel("Click to choose CSV or JSON file");
      loadImports(0);
      setPage(0);
    } catch (e) {
      setPreviewRows(null);
      const msg = e instanceof ApiError ? e.message : (e as Error).message;
      setUploadResult({ success: false, message: `❌ ${msg}` });
    } finally {
      setUploading(false);
    }
  }

  function downloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "acadmate_questions_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-8">
      {previewRows && (
        <PreviewModal
          rows={previewRows}
          filename={previewFilename}
          onConfirm={handleConfirmUpload}
          onCancel={() => setPreviewRows(null)}
          uploading={uploading}
        />
      )}

      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Imports</h1>
        <p className="text-slate-400">Upload question banks via CSV or JSON.</p>
      </div>

      {/* Upload Section */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Upload Questions</h2>
          <button
            onClick={downloadTemplate}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
            Download Template
          </button>
        </div>

        <div className="text-xs text-slate-400 space-y-1">
          <p>Required CSV columns: <code className="bg-slate-700 px-1 rounded">subject, text, optionA, optionB, optionC, optionD, correctOption</code></p>
          <p>Optional: <code className="bg-slate-700 px-1 rounded">topic, year, difficulty (EASY/MEDIUM/HARD), explanation</code></p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <label className="flex-1 flex items-center gap-3 px-4 py-3 border-2 border-dashed border-slate-600 hover:border-indigo-500 rounded-xl cursor-pointer transition-colors min-h-[52px]">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 flex-shrink-0"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
            <span className="text-sm text-slate-400 truncate">{fileLabel}</span>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.json"
              className="sr-only"
              onChange={handleFileChange}
            />
          </label>
          <button
            onClick={() => fileRef.current?.click()}
            className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            Preview & Upload
          </button>
        </div>

        {parseError && (
          <div className="px-4 py-3 rounded-xl text-sm bg-red-900/30 border border-red-700 text-red-400">
            {parseError}
          </div>
        )}

        {uploadResult && (
          <div className={`px-4 py-3 rounded-xl text-sm ${uploadResult.success ? "bg-emerald-900/30 border border-emerald-700 text-emerald-400" : "bg-red-900/30 border border-red-700 text-red-400"}`}>
            <p>{uploadResult.message}</p>
            {uploadResult.details && <p className="mt-1 text-xs opacity-80">{uploadResult.details}</p>}
          </div>
        )}
      </div>

      {/* History Table */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
        <h2 className="text-lg font-bold text-white mb-4">Import History</h2>
        {loadError && <p className="text-red-500 text-sm mb-4">{loadError}</p>}
        {loading ? (
          <p className="text-slate-400 text-sm py-8 text-center">Loading…</p>
        ) : imports.length === 0 ? (
          <p className="text-slate-400 text-sm py-8 text-center">No imports yet.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400">
                    <th className="pb-3 font-medium">File</th>
                    <th className="pb-3 font-medium">Date</th>
                    <th className="pb-3 font-medium">Rows</th>
                    <th className="pb-3 font-medium">Valid</th>
                    <th className="pb-3 font-medium">Errors</th>
                    <th className="pb-3 font-medium">Published</th>
                    <th className="pb-3 font-medium text-right">Status / Action</th>
                  </tr>
                </thead>
                <tbody>
                  {imports.map((imp, i) => {
                    const isFullyPublished = imp.publishedRows >= imp.validRows && imp.validRows > 0;
                    const isPublishing = publishingId === imp.id;
                    const canPublish = imp.status === "DONE" && !isFullyPublished;
                    const thisResult = publishResult?.id === imp.id ? publishResult : null;
                    return (
                    <tr
                      key={imp.id}
                      className={`${i < imports.length - 1 ? "border-b border-slate-800" : ""} hover:bg-slate-800/50 transition-colors`}
                    >
                      <td className="py-3">
                        <p className="font-medium text-white">{imp.filename}</p>
                        <p className="text-xs text-slate-500">{imp.uploadedBy.name ?? imp.uploadedBy.email}</p>
                        {thisResult && (
                          <p className={`text-xs mt-0.5 ${thisResult.success ? "text-emerald-400" : "text-red-400"}`}>
                            {thisResult.message}
                          </p>
                        )}
                      </td>
                      <td className="py-3 text-slate-400">{formatDate(imp.createdAt)}</td>
                      <td className="py-3 text-slate-300">{imp.totalRows}</td>
                      <td className="py-3 text-emerald-400">{imp.validRows}</td>
                      <td className="py-3 text-red-400">{imp.invalidRows}</td>
                      <td className="py-3 text-slate-300">
                        {imp.publishedRows > 0 ? (
                          <span className={isFullyPublished ? "text-emerald-400" : "text-amber-400"}>
                            {imp.publishedRows}/{imp.validRows}
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[imp.status] ?? "bg-slate-700 text-slate-400"}`}>
                            {imp.status}
                          </span>
                          {canPublish && (
                            <button
                              onClick={() => handlePublish(imp)}
                              disabled={isPublishing}
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isPublishing ? (
                                <>
                                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                                  Publishing…
                                </>
                              ) : "Publish"}
                            </button>
                          )}
                          {isFullyPublished && (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-medium">
                              <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                              Live
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-700">
                <p className="text-sm text-slate-400">
                  {page * limit + 1}–{Math.min((page + 1) * limit, total)} of {total}
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
