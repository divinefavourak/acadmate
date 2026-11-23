import { Injectable, Logger, NotFoundException, OnApplicationBootstrap } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../cache/cache.service';
import { buildQuestionSlug, slugify, snippet, toPlainText } from './question-slug';

/**
 * Public, unauthenticated past-question pages (SEO). Only real JAMB past
 * questions are served: published, not flagged, not AI-generated, with a year,
 * a slug and a marked answer, in an active subject. Post-UTME questions are
 * still published for the CBT, so the JAMB filter is what keeps them out.
 *
 * "AI-generated" is sourceType AI_ASSISTED, not the aiAssisted flag. The
 * content pipeline sets aiAssisted on every row whose explanation AI wrote,
 * which is every real booklet question too (content/pipeline/stages/emit.mjs).
 */
const NOT_AI_GENERATED = { sourceType: { not: 'AI_ASSISTED' } } satisfies Prisma.QuestionWhereInput;

const PUBLIC_WHERE = {
  isPublished: true,
  isFlagged: false,
  examType: 'JAMB',
  ...NOT_AI_GENERATED,
  year: { not: null },
  slug: { not: null },
  subject: { isActive: true },
  options: { some: { isCorrect: true } },
} satisfies Prisma.QuestionWhereInput;

/** Questions that get a slug. Wider than PUBLIC_WHERE, so a slug is already in place when a question is published or unflagged. */
const SLUGGABLE_WHERE = {
  examType: 'JAMB',
  ...NOT_AI_GENERATED,
  year: { not: null },
} satisfies Prisma.QuestionWhereInput;

export const YEAR_PAGE_SIZE = 20;
export const SITEMAP_PAGE_SIZE = 5000;

const CACHE_PREFIX = 'pq:';
const CACHE_TTL = 600; // 10 min; the Next.js pages add their own ISR window on top.
const SLUG_BATCH = 200;
const RELATED_COUNT = 6;

const QUESTION_SELECT = {
  id: true,
  slug: true,
  text: true,
  imageUrl: true,
  year: true,
  createdAt: true,
  topic: { select: { id: true, name: true } },
  proseText: { select: { title: true, author: true } },
  explanation: { select: { text: true } },
  options: {
    select: { label: true, text: true, isCorrect: true },
    orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
  },
} satisfies Prisma.QuestionSelect;

type QuestionRow = Prisma.QuestionGetPayload<{ select: typeof QUESTION_SELECT }>;

export interface PublicSubjectSummary {
  id: string;
  slug: string;
  name: string;
  code: string;
  total: number;
  years: { year: number; count: number }[];
}

export interface PublicQuestion {
  slug: string;
  number: number;
  text: string;
  /** The text without LaTeX or markdown, for titles, descriptions and JSON-LD. */
  plainText: string;
  imageUrl: string | null;
  year: number;
  topic: { id: string; name: string } | null;
  proseText: { title: string; author: string | null } | null;
  options: { label: string; text: string; plainText: string }[];
  answer: string;
  /** Worked explanation, shown when a student opens the solution on a year page or question page. */
  explanation: string | null;
}

export interface HubResult {
  exam: 'jamb';
  total: number;
  subjects: PublicSubjectSummary[];
}

@Injectable()
export class PastQuestionsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PastQuestionsService.name);
  private slugRun: Promise<number> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  /** Backfill on boot, without holding up startup. */
  onApplicationBootstrap() {
    void this.assignMissingSlugs().catch((err) =>
      this.logger.error('Slug backfill failed', err instanceof Error ? err.stack : String(err)),
    );
  }

  // ── Reads ──────────────────────────────────────────────────────────────────

  async getHub(): Promise<HubResult> {
    return this.cached('hub', async () => {
      const groups = await this.prisma.question.groupBy({
        by: ['subjectId', 'year'],
        where: PUBLIC_WHERE,
        _count: { _all: true },
      });
      const subjects = await this.prisma.subject.findMany({
        where: { id: { in: [...new Set(groups.map((g) => g.subjectId))] } },
        select: { id: true, name: true, code: true, sortOrder: true },
      });

      const summaries = subjects
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
        .map((s): PublicSubjectSummary => {
          const years = groups
            .filter((g) => g.subjectId === s.id && g.year != null)
            .map((g) => ({ year: g.year as number, count: g._count._all }))
            .sort((a, b) => b.year - a.year);
          return {
            id: s.id,
            slug: slugify(s.name),
            name: s.name,
            code: s.code,
            total: years.reduce((n, y) => n + y.count, 0),
            years,
          };
        });

      return {
        exam: 'jamb' as const,
        total: summaries.reduce((n, s) => n + s.total, 0),
        subjects: summaries,
      };
    });
  }

  async getSubject(subjectSlug: string) {
    const subject = await this.findSubject(subjectSlug);
    return this.cached(`subject:${subject.id}`, async () => {
      const groups = await this.prisma.question.groupBy({
        by: ['topicId'],
        where: { ...PUBLIC_WHERE, subjectId: subject.id },
        _count: { _all: true },
      });
      const topicIds = groups.map((g) => g.topicId).filter((id): id is string => id != null);
      const topics = await this.prisma.topic.findMany({
        where: { id: { in: topicIds } },
        select: { id: true, name: true },
      });
      const countById = new Map(groups.map((g) => [g.topicId, g._count._all]));

      return {
        subject,
        topics: topics
          .map((t) => ({ id: t.id, name: t.name, count: countById.get(t.id) ?? 0 }))
          .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
      };
    });
  }

  async getYear(subjectSlug: string, year: number, page: number) {
    const subject = await this.findSubject(subjectSlug);
    const entry = subject.years.find((y) => y.year === year);
    if (!entry) throw new NotFoundException('No past questions for that year');
    const totalPages = Math.ceil(entry.count / YEAR_PAGE_SIZE);
    if (page < 1 || page > totalPages) throw new NotFoundException('Page not found');

    return this.cached(`year:${subject.id}:${year}:${page}`, async () => {
      const skip = (page - 1) * YEAR_PAGE_SIZE;
      const rows = await this.prisma.question.findMany({
        where: { ...PUBLIC_WHERE, subjectId: subject.id, year },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        skip,
        take: YEAR_PAGE_SIZE,
        select: QUESTION_SELECT,
      });
      return {
        subject,
        year,
        page,
        pageSize: YEAR_PAGE_SIZE,
        total: entry.count,
        totalPages,
        questions: rows.map((q, i) => this.toPublic(q, skip + i + 1)),
      };
    });
  }

  async getQuestion(slug: string) {
    return this.cached(`question:${slug}`, async () => {
      const q = await this.prisma.question.findFirst({
        where: { ...PUBLIC_WHERE, slug },
        select: {
          ...QUESTION_SELECT,
          subjectId: true,
        },
      });
      if (!q) throw new NotFoundException('Question not found');

      const hub = await this.getHub();
      const subject = hub.subjects.find((s) => s.id === q.subjectId);
      if (!subject) throw new NotFoundException('Question not found');

      // Position within its year's paper, in the same order as the year pages.
      const paper = { ...PUBLIC_WHERE, subjectId: q.subjectId, year: q.year };
      const before: Prisma.QuestionWhereInput = {
        OR: [
          { createdAt: { lt: q.createdAt } },
          { createdAt: q.createdAt, id: { lt: q.id } },
        ],
      };
      const after: Prisma.QuestionWhereInput = {
        OR: [
          { createdAt: { gt: q.createdAt } },
          { createdAt: q.createdAt, id: { gt: q.id } },
        ],
      };
      const [precedingCount, prev, next, related] = await Promise.all([
        this.prisma.question.count({ where: { ...paper, ...before } }),
        this.prisma.question.findFirst({
          where: { ...paper, ...before },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          select: { slug: true },
        }),
        this.prisma.question.findFirst({
          where: { ...paper, ...after },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: { slug: true },
        }),
        this.findRelated(q.id, q.subjectId, q.topic?.id ?? null, q.year as number),
      ]);
      const number = precedingCount + 1;

      return {
        subject,
        question: {
          ...this.toPublic(q, number),
          explanationPlain: q.explanation ? toPlainText(q.explanation.text) : null,
        },
        yearPage: Math.ceil(number / YEAR_PAGE_SIZE),
        prev: prev?.slug ?? null,
        next: next?.slug ?? null,
        related,
      };
    });
  }

  async getSitemapPage(page: number) {
    return this.cached(`sitemap:${page}`, async () => {
      const [total, rows] = await Promise.all([
        this.prisma.question.count({ where: PUBLIC_WHERE }),
        this.prisma.question.findMany({
          where: PUBLIC_WHERE,
          orderBy: { id: 'asc' },
          skip: page * SITEMAP_PAGE_SIZE,
          take: SITEMAP_PAGE_SIZE,
          select: { slug: true, updatedAt: true },
        }),
      ]);
      return {
        total,
        pageSize: SITEMAP_PAGE_SIZE,
        pages: Math.max(1, Math.ceil(total / SITEMAP_PAGE_SIZE)),
        items: rows.map((r) => ({ slug: r.slug as string, updatedAt: r.updatedAt.toISOString() })),
      };
    });
  }

  // ── Slugs ──────────────────────────────────────────────────────────────────

  /**
   * Give every eligible JAMB question a permanent slug. Idempotent and cheap
   * when there's nothing to do, so it runs on boot and on a schedule, which
   * also covers questions imported or created later. Overlapping calls share
   * one run.
   */
  assignMissingSlugs(): Promise<number> {
    this.slugRun ??= this.runSlugAssignment().finally(() => {
      this.slugRun = null;
    });
    return this.slugRun;
  }

  private async runSlugAssignment(): Promise<number> {
    let assigned = 0;
    const failed: string[] = [];

    for (;;) {
      const batch = await this.prisma.question.findMany({
        where: { ...SLUGGABLE_WHERE, slug: null, id: { notIn: failed } },
        select: { id: true, text: true, year: true, subject: { select: { name: true } } },
        orderBy: { id: 'asc' },
        take: SLUG_BATCH,
      });
      if (batch.length === 0) break;

      const slugFor = (q: (typeof batch)[number], suffixLength?: number) =>
        buildQuestionSlug(
          { id: q.id, text: q.text, year: q.year as number, subjectName: q.subject.name },
          suffixLength,
        );

      try {
        await this.prisma.$transaction(
          batch.map((q) =>
            this.prisma.question.update({ where: { id: q.id }, data: { slug: slugFor(q) } }),
          ),
        );
        assigned += batch.length;
      } catch {
        // A rare suffix collision fails the whole batch; redo it row by row
        // and fall back to the full id, which is unique by construction.
        for (const q of batch) {
          try {
            await this.prisma.question.update({ where: { id: q.id }, data: { slug: slugFor(q) } });
            assigned++;
          } catch {
            try {
              await this.prisma.question.update({
                where: { id: q.id },
                data: { slug: slugFor(q, q.id.length) },
              });
              assigned++;
            } catch (err) {
              failed.push(q.id);
              this.logger.warn(`Could not assign a slug to question ${q.id}: ${(err as Error).message}`);
            }
          }
        }
      }
      if (batch.length < SLUG_BATCH) break;
    }

    if (assigned > 0) {
      this.logger.log(`Assigned ${assigned} past-question slug(s)`);
      await this.cache.delByPrefix(CACHE_PREFIX);
    }
    return assigned;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async findSubject(subjectSlug: string): Promise<PublicSubjectSummary> {
    const hub = await this.getHub();
    const subject = hub.subjects.find((s) => s.slug === subjectSlug);
    if (!subject) throw new NotFoundException('Subject not found');
    return subject;
  }

  /**
   * Neighbours in the same topic (or the same paper when there's no topic),
   * taken after this question and wrapping around. Every question then gets
   * linked from a few others, instead of all pages pointing at the same six.
   */
  private async findRelated(id: string, subjectId: string, topicId: string | null, year: number) {
    const scope: Prisma.QuestionWhereInput = {
      ...PUBLIC_WHERE,
      subjectId,
      ...(topicId ? { topicId } : { year }),
    };
    const select = { slug: true, text: true, year: true } as const;
    const following = await this.prisma.question.findMany({
      where: { ...scope, id: { gt: id } },
      orderBy: { id: 'asc' },
      take: RELATED_COUNT,
      select,
    });
    const wrapped =
      following.length < RELATED_COUNT
        ? await this.prisma.question.findMany({
            where: { ...scope, id: { lt: id } },
            orderBy: { id: 'asc' },
            take: RELATED_COUNT - following.length,
            select,
          })
        : [];
    return [...following, ...wrapped].map((r) => ({
      slug: r.slug as string,
      snippet: snippet(r.text, 140),
      year: r.year as number,
    }));
  }

  private toPublic(q: QuestionRow, number: number): PublicQuestion {
    return {
      slug: q.slug as string,
      number,
      text: q.text,
      plainText: toPlainText(q.text),
      imageUrl: q.imageUrl,
      year: q.year as number,
      topic: q.topic,
      proseText: q.proseText,
      options: q.options.map((o) => ({ label: o.label, text: o.text, plainText: toPlainText(o.text) })),
      answer: q.options.find((o) => o.isCorrect)?.label ?? '',
      explanation: q.explanation?.text ?? null,
    };
  }

  private async cached<T>(key: string, load: () => Promise<T>): Promise<T> {
    const fullKey = `${CACHE_PREFIX}${key}`;
    const hit = await this.cache.get<T>(fullKey);
    if (hit) return hit;
    const value = await load();
    void this.cache.set(fullKey, value, CACHE_TTL);
    return value;
  }
}
