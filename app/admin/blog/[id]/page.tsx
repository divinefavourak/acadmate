"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiClient, ApiError } from "@/lib/api/client";
import Loader from "@/app/components/Loader";
import BlogEditor from "../components/BlogEditor";
import type { BlogCategory } from "@/app/blog/categories";

interface AdminBlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  coverImageUrl: string | null;
  category: BlogCategory;
  publishedAt: string | null;
  notifiedAt: string | null;
}

export default function AdminBlogEditPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [post, setPost] = useState<AdminBlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    apiClient<AdminBlogPost>(`/api/admin/blog/${id}`)
      .then((data) => setPost(data))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load post."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Loader className="py-24" />;
  if (error || !post) {
    return (
      <div className="text-center py-16 space-y-3">
        <p className="text-red-300">{error || "Post not found"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Edit post</h1>
      <BlogEditor
        mode="edit"
        initial={{
          id: post.id,
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt,
          body: post.body,
          coverImageUrl: post.coverImageUrl,
          category: post.category,
          publishedAt: post.publishedAt,
          notifiedAt: post.notifiedAt,
        }}
      />
    </div>
  );
}
