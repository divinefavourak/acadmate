export type ForumCategory =
  | "GENERAL"
  | "UTME"
  | "POST_UTME"
  | "JAMB"
  | "SCHOLARSHIPS"
  | "STUDY_TIPS"
  | "SCHOOL_NEWS";

export interface ForumAuthor {
  id: string;
  name: string | null;
}

export interface ForumThread {
  id: string;
  title: string;
  body: string;
  category: ForumCategory;
  author: ForumAuthor;
  replyCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ForumReply {
  id: string;
  body: string;
  author: ForumAuthor;
  createdAt: string;
}

export interface ThreadListResponse {
  threads: ForumThread[];
  total: number;
  limit: number;
  offset: number;
}

export interface ThreadDetailResponse {
  thread: ForumThread;
  replies: ForumReply[];
}
