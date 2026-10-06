export type NotesAccess = "FREE" | "PREMIUM";
export type TopicState = "not_started" | "in_progress" | "done";

export interface StudySubject {
  id: string;
  name: string;
  code: string;
  topicCount: number;
  completedTopics: number;
}

export interface ContinueTopic {
  id: string;
  name: string;
  subject: { id: string; name: string };
  readNotes: number;
  totalNotes: number;
}

export interface MapTopic {
  id: string;
  name: string;
  description: string | null;
  notesAccess: NotesAccess;
  totalNotes: number;
  readNotes: number;
  state: TopicState;
  locked: boolean;
  recommended: boolean;
}

export interface SubjectMap {
  subject: { id: string; name: string; code: string; description: string | null };
  topics: MapTopic[];
}

export interface TopicNotes {
  topic: {
    id: string;
    name: string;
    description: string | null;
    notesAccess: NotesAccess;
    subject: { id: string; name: string };
  };
  locked: boolean;
  /** `body` is null for sections a locked topic does not preview. */
  notes: { id: string; title: string; body: string | null; read: boolean }[];
}

export interface SearchTopic {
  id: string;
  name: string;
  notesAccess: NotesAccess;
  subject: { id: string; name: string };
}
