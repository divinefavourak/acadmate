import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  buildMetadata,
  discussionForumPostingSchema,
  breadcrumbSchema,
  SITE_URL,
} from "@/lib/seo";
import ThreadContent from "./components/ThreadContent";
import type { ForumThread, ForumReply } from "@/features/forum/types";

// ─── ISR ─────────────────────────────────────────────────────────────────────

export const revalidate = 60;

// ─── Data fetching ────────────────────────────────────────────────────────────

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

async function getThread(
  id: string,
): Promise<{ thread: ForumThread; replies: ForumReply[] } | null> {
  if (!API_URL) return null;
  try {
    const res = await fetch(`${API_URL}/api/forum/${encodeURIComponent(id)}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// ─── Metadata ────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ threadId: string }>;
}): Promise<Metadata> {
  const { threadId } = await params;
  const data = await getThread(threadId);
  if (!data) return { title: "Thread Not Found | Acadmate Forum" };

  const { thread } = data;
  const description = thread.body.slice(0, 155).replace(/\s+/g, " ").trim();

  return buildMetadata({
    title: thread.title,
    description: description + (thread.body.length > 155 ? "…" : ""),
    path: `/forum/${thread.id}`,
    type: "article",
    article: {
      publishedTime: thread.createdAt,
      modifiedTime: thread.updatedAt,
      authors: [thread.author.name ?? "Anonymous"],
    },
  });
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;
  const data = await getThread(threadId);
  if (!data) notFound();

  const { thread, replies } = data;

  const jsonLd = [
    discussionForumPostingSchema({
      id: thread.id,
      title: thread.title,
      body: thread.body,
      author: thread.author,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
    }),
    breadcrumbSchema([
      { name: "Home", url: SITE_URL },
      { name: "Forum", url: `${SITE_URL}/forum` },
      { name: thread.title, url: `${SITE_URL}/forum/${thread.id}` },
    ]),
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ThreadContent thread={thread} replies={replies} />
    </>
  );
}
