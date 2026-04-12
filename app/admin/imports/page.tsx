"use client";

import { useEffect, useState, useRef } from "react";

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

export default function ImportsPage() {
  const [imports, setImports] = useState<ImportEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const limit = 20;

  // Upload state
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ success: boolean; message: string; details?: string } | null>(null);

  function loadImports(p = 0) {
    setLoading(true);
    fetch(`/api/admin/imports?limit=${limit}&offset=${p * limit}`)
      .then((r) => r.ok ? r.json() : { imports: [], total: 0 })
      .then((data) => {
        setImports(data.imports ?? []);
        setTotal(data.total ?? 0);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadImports(page); }, [page]);

  const totalPages = Math.ceil(total / limit);

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadResult(null);

    try {
      const text = await file.text();
      let rows: unknown[] = [];

      if (file.name.endsWith(".json")) {
        rows = JSON.parse(text);
      } else {
        // CSV parse
        const lines = text.trim().split("\n");
        const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
        rows = lines.slice(1).map((line) => {
          // Handle quoted CSV values
          const values: string[] = [];
          let current = "";
          let inQuotes = false;
          for (const ch of line) {
            if (ch === '"') { inQuotes = !inQuotes; }
            else if (ch === "," && !inQuotes) { values.push(current); current = ""; }
            else { current += ch; }
          }
          values.push(current);
          return Object.fromEntries(headers.map((h, i) => [h, values[i]?.trim() ?? ""]));
        });
      }

      const res = await fetch("/api/admin/imports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, rows }),
      });

      const data = await res.json();

      if (res.ok) {
        setUploadResult({
          success: true,
          message: `✅ Import complete: ${data.created} questions created from ${data.totalRows} rows.`,
          details: data.errors?.length > 0 ? `${data.errors.length} rows had errors and were skipped.` : undefined,
        });
        if (fileRef.current) fileRef.current.value = "";
        loadImports(0);
        setPage(0);
      } else {
        setUploadResult({ success: false, message: `❌ ${data.error ?? "Upload failed."}` });
      }
    } catch (e) {
      setUploadResult({ success: false, message: `❌ Failed to parse file: ${(e as Error).message}` });
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
            <span className="text-sm text-slate-400 truncate">
              {fileRef.current?.files?.[0]?.name ?? "Click to choose CSV or JSON file"}
            </span>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.json"
              className="sr-only"
              onChange={() => setUploadResult(null)}
            />
          </label>
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-95"
          >
            {uploading ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                Uploading…
              </>
            ) : (
              "Upload"
            )}
          </button>
        </div>

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
                    <th className="pb-3 font-medium text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {imports.map((imp, i) => (
                    <tr
                      key={imp.id}
                      className={`${i < imports.length - 1 ? "border-b border-slate-800" : ""} hover:bg-slate-800/50 transition-colors`}
                    >
                      <td className="py-3">
                        <p className="font-medium text-white">{imp.filename}</p>
                        <p className="text-xs text-slate-500">{imp.uploadedBy.name ?? imp.uploadedBy.email}</p>
                      </td>
                      <td className="py-3 text-slate-400">{formatDate(imp.createdAt)}</td>
                      <td className="py-3 text-slate-300">{imp.totalRows}</td>
                      <td className="py-3 text-emerald-400">{imp.validRows}</td>
                      <td className="py-3 text-red-400">{imp.invalidRows}</td>
                      <td className="py-3 text-right">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[imp.status] ?? "bg-slate-700 text-slate-400"}`}>
                          {imp.status}
                        </span>
                      </td>
                    </tr>
                  ))}
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
