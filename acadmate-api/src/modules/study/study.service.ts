import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

type TopicState = 'not_started' | 'in_progress' | 'done';

function stateOf(read: number, total: number): TopicState {
  if (read === 0) return 'not_started';
  return read >= total ? 'done' : 'in_progress';
}

@Injectable()
export class StudyService {
  constructor(private readonly prisma: PrismaService) {}

  /** Only topics with at least one published section are part of Study. */
  private readonly studyTopicWhere = {
    isActive: true,
    subject: { isActive: true },
    notes: { some: { isPublished: true } },
  };

  /** Premium topics are open to Premium students and to admins. */
  private async canReadPremium(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, role: true },
    });
    return user?.role === 'ADMIN' || (user != null && user.plan !== 'FREE');
  }

  private async readNoteIds(userId: string, topicIds?: string[]): Promise<Set<string>> {
    const reads = await this.prisma.topicNoteRead.findMany({
      where: {
        userId,
        note: { isPublished: true, ...(topicIds && { topicId: { in: topicIds } }) },
      },
      select: { noteId: true },
    });
    return new Set(reads.map((r) => r.noteId));
  }

  // ─── GET /study/subjects ──────────────────────────────────────────────────
  async listSubjects(userId: string) {
    const [subjects, topics, read] = await Promise.all([
      this.prisma.subject.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: { id: true, name: true, code: true },
      }),
      this.prisma.topic.findMany({
        where: this.studyTopicWhere,
        select: {
          subjectId: true,
          notes: { where: { isPublished: true }, select: { id: true } },
        },
      }),
      this.readNoteIds(userId),
    ]);

    const bySubject = new Map<string, { topicCount: number; completedTopics: number }>();
    for (const topic of topics) {
      const entry = bySubject.get(topic.subjectId) ?? { topicCount: 0, completedTopics: 0 };
      entry.topicCount++;
      if (topic.notes.every((n) => read.has(n.id))) entry.completedTopics++;
      bySubject.set(topic.subjectId, entry);
    }

    return {
      subjects: subjects.map((s) => ({
        ...s,
        ...(bySubject.get(s.id) ?? { topicCount: 0, completedTopics: 0 }),
      })),
    };
  }

  // ─── GET /study/subjects/:id ──────────────────────────────────────────────
  async getSubject(userId: string, subjectId: string) {
    const subject = await this.prisma.subject.findFirst({
      where: { id: subjectId, isActive: true },
      select: { id: true, name: true, code: true, description: true },
    });
    if (!subject) throw new NotFoundException('Subject not found');

    const [topics, premiumOk] = await Promise.all([
      this.prisma.topic.findMany({
        where: { ...this.studyTopicWhere, subjectId },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          description: true,
          notesAccess: true,
          notes: { where: { isPublished: true }, select: { id: true } },
        },
      }),
      this.canReadPremium(userId),
    ]);
    const read = await this.readNoteIds(userId, topics.map((t) => t.id));

    // The first topic the student can open and hasn't finished is the next step on the map.
    let recommendedId: string | null = null;
    const rows = topics.map((t) => {
      const readNotes = t.notes.filter((n) => read.has(n.id)).length;
      const state = stateOf(readNotes, t.notes.length);
      const locked = t.notesAccess === 'PREMIUM' && !premiumOk;
      if (recommendedId === null && state !== 'done' && !locked) recommendedId = t.id;
      return {
        id: t.id,
        name: t.name,
        description: t.description,
        notesAccess: t.notesAccess,
        totalNotes: t.notes.length,
        readNotes,
        state,
        locked,
      };
    });

    return {
      subject,
      topics: rows.map((t) => ({ ...t, recommended: t.id === recommendedId })),
    };
  }

  // ─── GET /study/topics/:id ────────────────────────────────────────────────
  async getTopic(userId: string, topicId: string) {
    const topic = await this.prisma.topic.findFirst({
      where: { ...this.studyTopicWhere, id: topicId },
      select: {
        id: true,
        name: true,
        description: true,
        notesAccess: true,
        subject: { select: { id: true, name: true } },
        notes: {
          where: { isPublished: true },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          select: { id: true, title: true, body: true },
        },
      },
    });
    if (!topic) throw new NotFoundException('Topic not found');

    const [premiumOk, read] = await Promise.all([
      this.canReadPremium(userId),
      this.readNoteIds(userId, [topicId]),
    ]);
    const locked = topic.notesAccess === 'PREMIUM' && !premiumOk;

    return {
      topic: {
        id: topic.id,
        name: topic.name,
        description: topic.description,
        notesAccess: topic.notesAccess,
        subject: topic.subject,
      },
      locked,
      // A locked topic still shows its outline and first section as a preview.
      notes: topic.notes.map((n, i) => ({
        id: n.id,
        title: n.title,
        body: locked && i > 0 ? null : n.body,
        read: read.has(n.id),
      })),
    };
  }

  // ─── POST /study/notes/:id/read ───────────────────────────────────────────
  async markRead(userId: string, noteId: string) {
    const note = await this.prisma.topicNote.findFirst({
      where: { id: noteId, isPublished: true, topic: this.studyTopicWhere },
      select: {
        id: true,
        topicId: true,
        topic: {
          select: {
            notesAccess: true,
            notes: {
              where: { isPublished: true },
              orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
              select: { id: true },
            },
          },
        },
      },
    });
    if (!note) throw new NotFoundException('Note not found');

    const isPreview = note.topic.notes[0]?.id === note.id;
    if (note.topic.notesAccess === 'PREMIUM' && !isPreview && !(await this.canReadPremium(userId))) {
      throw new ForbiddenException('These notes need a Premium plan.');
    }

    await this.prisma.topicNoteRead.upsert({
      where: { userId_noteId: { userId, noteId } },
      create: { userId, noteId },
      update: { readAt: new Date() },
    });

    const read = await this.readNoteIds(userId, [note.topicId]);
    const totalNotes = note.topic.notes.length;
    return { readNotes: read.size, totalNotes, topicCompleted: read.size >= totalNotes };
  }

  // ─── GET /study/continue ──────────────────────────────────────────────────
  /** The topic the student read most recently and hasn't finished, if any. */
  async getContinue(userId: string) {
    const recent = await this.prisma.topicNoteRead.findMany({
      where: { userId, note: { isPublished: true, topic: this.studyTopicWhere } },
      orderBy: { readAt: 'desc' },
      take: 30,
      select: { note: { select: { topicId: true } } },
    });
    const topicIds = [...new Set(recent.map((r) => r.note.topicId))];
    if (topicIds.length === 0) return { topic: null };

    const [topics, read] = await Promise.all([
      this.prisma.topic.findMany({
        where: { id: { in: topicIds } },
        select: {
          id: true,
          name: true,
          subject: { select: { id: true, name: true } },
          notes: { where: { isPublished: true }, select: { id: true } },
        },
      }),
      this.readNoteIds(userId, topicIds),
    ]);
    const byId = new Map(topics.map((t) => [t.id, t]));

    for (const id of topicIds) {
      const t = byId.get(id);
      if (!t) continue;
      const readNotes = t.notes.filter((n) => read.has(n.id)).length;
      if (readNotes < t.notes.length) {
        return {
          topic: { id: t.id, name: t.name, subject: t.subject, readNotes, totalNotes: t.notes.length },
        };
      }
    }
    return { topic: null };
  }

  // ─── GET /study/search?q= ─────────────────────────────────────────────────
  async search(q: string) {
    const term = q.trim();
    if (term.length < 2) return { topics: [] };

    const topics = await this.prisma.topic.findMany({
      where: { ...this.studyTopicWhere, name: { contains: term, mode: 'insensitive' } },
      orderBy: { name: 'asc' },
      take: 20,
      select: {
        id: true,
        name: true,
        notesAccess: true,
        subject: { select: { id: true, name: true } },
      },
    });
    return { topics };
  }
}
