import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BlogPostContent, type BlogPostDetail } from "./BlogPostContent";
import {
  buildMetadata,
  articleSchema,
  breadcrumbSchema,
  SITE_URL,
} from "@/lib/seo";

// ─── ISR ─────────────────────────────────────────────────────────────────────

export const revalidate = 60;

// ─── Data fetching ────────────────────────────────────────────────────────────

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

async function getPost(slug: string): Promise<BlogPostDetail | null> {
  if (!API_URL) return null;
  try {
    const res = await fetch(
      `${API_URL}/api/blog/${encodeURIComponent(slug)}`,
      { next: { revalidate: 60 } },
    );
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
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: "Post Not Found | Acadmate Blog" };

  return {
    ...buildMetadata({
      title: post.title,
      description: post.excerpt,
      path: `/blog/${post.slug}`,
      ogImage: post.coverImageUrl ?? undefined,
      type: "article",
      article: {
        publishedTime: post.publishedAt,
        authors: [post.author?.name ?? "Acadmate Team"],
        tags: [post.category],
      },
    }),
  };
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function BlogDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  const jsonLd = [
    articleSchema({
      title: post.title,
      excerpt: post.excerpt,
      slug: post.slug,
      publishedAt: post.publishedAt,
      author: post.author,
      coverImageUrl: post.coverImageUrl,
      category: post.category,
    }),
    breadcrumbSchema([
      { name: "Home", url: SITE_URL },
      { name: "Blog", url: `${SITE_URL}/blog` },
      { name: post.title, url: `${SITE_URL}/blog/${post.slug}` },
    ]),
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <BlogPostContent post={post} />
    </>
  );
}
