import { apiClient } from "@/lib/api/client";
import type {
  ForumCategory,
  ThreadListResponse,
  ThreadDetailResponse,
  ForumThread,
  ForumReply,
} from "./types";

export function listThreads(opts: {
  category?: ForumCategory;
  limit?: number;
  offset?: number;
}): Promise<ThreadListResponse> {
  const qs = new URLSearchParams();
  if (opts.category) qs.set("category", opts.category);
  qs.set("limit", String(opts.limit ?? 20));
  qs.set("offset", String(opts.offset ?? 0));
  return apiClient<ThreadListResponse>(`/api/forum?${qs}`, { skipAuth: true });
}

export function getThread(id: string): Promise<ThreadDetailResponse> {
  return apiClient<ThreadDetailResponse>(`/api/forum/${id}`, { skipAuth: true });
}

export function createThread(data: {
  title: string;
  body: string;
  category: ForumCategory;
}): Promise<{ thread: ForumThread }> {
  return apiClient<{ thread: ForumThread }>("/api/forum", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function createReply(
  threadId: string,
  body: string,
): Promise<{ reply: ForumReply }> {
  return apiClient<{ reply: ForumReply }>(`/api/forum/${threadId}/replies`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}
