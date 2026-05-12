"use client";

import BlogEditor from "../components/BlogEditor";

export default function AdminBlogNewPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">New post</h1>
      <BlogEditor mode="create" />
    </div>
  );
}
