import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import ForumListContent from "./components/ForumListContent";
import type { ForumThread } from "@/features/forum/types";

// ─── ISR ─────────────────────────────────────────────────────────────────────

export const revalidate = 300;

// ─── Metadata ────────────────────────────────────────────────────────────────

export const metadata: Metadata = buildMetadata({
  title: "Community Forum – Ask Questions & Discuss JAMB, UTME & Scholarships",
  description:
    "Join the Acadmate community forum. Ask questions about JAMB, UTME, Post-UTME, scholarships, study tips, and Nigerian university admissions. Get answers from fellow students.",
  path: "/forum",
});

// ─── Data fetching ────────────────────────────────────────────────────────────

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

async function getInitialThreads(): Promise<{
  threads: ForumThread[];
  total: number;
}> {
  if (!API_URL) return { threads: [], total: 0 };
  try {
    const res = await fetch(`${API_URL}/api/forum?limit=20&offset=0`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return { threads: [], total: 0 };
    const data = (await res.json()) as {
      threads?: ForumThread[];
      total?: number;
    };
    return { threads: data.threads ?? [], total: data.total ?? 0 };
  } catch {
    return { threads: [], total: 0 };
  }
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function ForumPage() {
  const { threads, total } = await getInitialThreads();

  return (
    <div className="space-y-8">
      {/* Heading — server-rendered for crawlers */}
      <div className="space-y-3 max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-400">
          Community Forum
        </p>
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight leading-tight">
          Ask, discuss, and help each other.
        </h1>
        <p className="text-slate-600 dark:text-slate-400 md:text-lg">
          Questions about UTME, Post-UTME, JAMB, scholarships — all welcome.
        </p>
      </div>

      <ForumListContent initialThreads={threads} initialTotal={total} />
    </div>
  );
}
