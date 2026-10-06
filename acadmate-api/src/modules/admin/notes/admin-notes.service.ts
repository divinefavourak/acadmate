import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { NotesAccess } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

export type ImportRowReport = {
  row: number;
  subject: string;
  topic: string;
  status: 'ok' | 'error';
  sections: number;
  message?: string;
};

type ValidImportRow = {
  topicId: string;
  access?: NotesAccess;
  sections: { title: string; body: string }[];
};

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

// Same cap the single-section endpoints enforce through their DTOs.
const TITLE_MAX = 160;

@Injectable()
export class AdminNotesService {
  constructor(private readonly prisma: PrismaService) {}

  private async requireTopic(topicId: string) {
    const topic = await this.prisma.topic.findUnique({ where: { id: topicId }, select: { id: true } });
    if (!topic) throw new NotFoundException('Topic not found');
  }

  // ─── GET /admin/notes/overview?subjectId= ─────────────────────────────────
  async overview(subjectId: string) {
    const topics = await this.prisma.topic.findMany({
      where: { subjectId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        isActive: true,
        notesAccess: true,
        notes: { select: { isPublished: true } },
      },
    });
    return {
      topics: topics.map(({ notes, ...t }) => ({
        ...t,
        totalNotes: notes.length,
        publishedNotes: notes.filter((n) => n.isPublished).length,
      })),
    };
  }

  // ─── GET /admin/topics/:topicId/notes ─────────────────────────────────────
  async listNotes(topicId: string) {
    const topic = await this.prisma.topic.findUnique({
      where: { id: topicId },
      select: {
        id: true,
        name: true,
        notesAccess: true,
        subject: { select: { id: true, name: true } },
        notes: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          select: { id: true, title: true, body: true, sortOrder: true, isPublished: true, updatedAt: true },
        },
      },
    });
    if (!topic) throw new NotFoundException('Topic not found');
    const { notes, ...rest } = topic;
    return { topic: rest, notes };
  }

  async createNote(topicId: string, dto: { title: string; body: string; isPublished?: boolean }) {
    await this.requireTopic(topicId);
    const last = await this.prisma.topicNote.aggregate({ where: { topicId }, _max: { sortOrder: true } });
    return this.prisma.topicNote.create({
      data: {
        topicId,
        title: dto.title.trim(),
        body: dto.body,
        isPublished: dto.isPublished ?? false,
        sortOrder: (last._max.sortOrder ?? -1) + 1,
      },
    });
  }

  async updateNote(id: string, dto: { title?: string; body?: string; isPublished?: boolean }) {
    const note = await this.prisma.topicNote.findUnique({ where: { id }, select: { id: true } });
    if (!note) throw new NotFoundException('Note not found');
    return this.prisma.topicNote.update({
      where: { id },
      data: { ...dto, ...(dto.title !== undefined && { title: dto.title.trim() }) },
    });
  }

  async deleteNote(id: string) {
    const note = await this.prisma.topicNote.findUnique({ where: { id }, select: { id: true } });
    if (!note) throw new NotFoundException('Note not found');
    await this.prisma.topicNote.delete({ where: { id } });
    return { deleted: true };
  }

  // ─── PUT /admin/topics/:topicId/notes/order ───────────────────────────────
  async reorder(topicId: string, ids: string[]) {
    const existing = await this.prisma.topicNote.findMany({ where: { topicId }, select: { id: true } });
    const known = new Set(existing.map((n) => n.id));
    if (ids.length !== known.size || new Set(ids).size !== ids.length || !ids.every((id) => known.has(id))) {
      throw new BadRequestException('Order must list every section of this topic exactly once.');
    }
    await this.prisma.$transaction(
      ids.map((id, sortOrder) => this.prisma.topicNote.update({ where: { id }, data: { sortOrder } })),
    );
    return { reordered: ids.length };
  }

  // ─── PATCH /admin/topics/:topicId/notes-settings ──────────────────────────
  async updateSettings(topicId: string, dto: { notesAccess?: NotesAccess; publishAll?: boolean }) {
    await this.requireTopic(topicId);
    if (dto.notesAccess) {
      await this.prisma.topic.update({ where: { id: topicId }, data: { notesAccess: dto.notesAccess } });
    }
    if (dto.publishAll !== undefined) {
      await this.prisma.topicNote.updateMany({ where: { topicId }, data: { isPublished: dto.publishAll } });
    }
    return { updated: true };
  }

  // ─── POST /admin/notes/import ─────────────────────────────────────────────
  /**
   * Bulk import. Each item is `{ subject, topic, access?, sections: [{ title, body }] }`.
   * Subjects match on name or code and topics on name, ignoring case. Rows are
   * validated one by one so the admin gets a report instead of one opaque 400.
   * Nothing is written on a dry run or when any row is invalid. Imported
   * sections are drafts, added after any sections the topic already has.
   */
  async importNotes(items: unknown[], dryRun: boolean) {
    const subjects = await this.prisma.subject.findMany({
      select: { id: true, name: true, code: true, topics: { select: { id: true, name: true } } },
    });
    const subjectByKey = new Map<string, (typeof subjects)[number]>();
    for (const s of subjects) {
      subjectByKey.set(s.name.toLowerCase(), s);
      subjectByKey.set(s.code.toLowerCase(), s);
    }

    const report: ImportRowReport[] = [];
    const valid: ValidImportRow[] = [];

    items.forEach((raw, i) => {
      const item = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
      const subjectName = text(item.subject);
      const topicName = text(item.topic);
      const sectionsRaw = Array.isArray(item.sections) ? item.sections : [];
      const row = { row: i + 1, subject: subjectName, topic: topicName, sections: sectionsRaw.length };
      const fail = (message: string) => report.push({ ...row, status: 'error', message });

      if (!subjectName || !topicName) return fail('Each item needs a "subject" and a "topic".');
      const subject = subjectByKey.get(subjectName.toLowerCase());
      if (!subject) return fail(`Unknown subject "${subjectName}".`);
      const topic = subject.topics.find((t) => t.name.toLowerCase() === topicName.toLowerCase());
      if (!topic) return fail(`No topic "${topicName}" in ${subject.name}. Create it under Subjects first.`);

      const access = text(item.access).toUpperCase();
      if (access && access !== 'FREE' && access !== 'PREMIUM') return fail('"access" must be FREE or PREMIUM.');
      if (sectionsRaw.length === 0) return fail('"sections" must be a non-empty list.');

      const sections: ValidImportRow['sections'] = [];
      for (const [j, sRaw] of sectionsRaw.entries()) {
        const s = (sRaw && typeof sRaw === 'object' ? sRaw : {}) as Record<string, unknown>;
        const title = text(s.title);
        const body = text(s.body);
        if (!title || !body) return fail(`Section ${j + 1} needs a "title" and a "body".`);
        if (title.length > TITLE_MAX) return fail(`Section ${j + 1}'s title is over ${TITLE_MAX} characters.`);
        sections.push({ title, body });
      }

      valid.push({ topicId: topic.id, access: (access || undefined) as NotesAccess | undefined, sections });
      report.push({ ...row, status: 'ok' });
    });

    const errors = report.filter((r) => r.status === 'error').length;
    if (dryRun || errors > 0) return { dryRun: true, imported: 0, errors, report };

    let imported = 0;
    await this.prisma.$transaction(async (tx) => {
      // Several rows may target one topic, so track the next position per topic.
      const nextOrder = new Map<string, number>();
      for (const row of valid) {
        if (!nextOrder.has(row.topicId)) {
          const last = await tx.topicNote.aggregate({ where: { topicId: row.topicId }, _max: { sortOrder: true } });
          nextOrder.set(row.topicId, (last._max.sortOrder ?? -1) + 1);
        }
        const start = nextOrder.get(row.topicId)!;
        await tx.topicNote.createMany({
          data: row.sections.map((s, k) => ({ topicId: row.topicId, title: s.title, body: s.body, sortOrder: start + k })),
        });
        nextOrder.set(row.topicId, start + row.sections.length);
        if (row.access) {
          await tx.topic.update({ where: { id: row.topicId }, data: { notesAccess: row.access } });
        }
        imported += row.sections.length;
      }
    });

    return { dryRun: false, imported, errors: 0, report };
  }
}
