import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Prisma, BlogCategory } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../auth/mail.service';

const VALID_CATEGORIES: BlogCategory[] = [
  'UTME',
  'POST_UTME',
  'JAMB',
  'SCHOOL_NEWS',
  'STUDY_TIPS',
  'SCHOLARSHIPS',
  'CAREER',
  'ANNOUNCEMENT',
  'GENERAL',
];

export type CreateBlogPostInput = {
  title: string;
  slug?: string;
  excerpt: string;
  body: string;
  coverImageUrl?: string | null;
  category: BlogCategory;
};

export type UpdateBlogPostInput = Partial<CreateBlogPostInput>;

// Slugify: lowercase, replace non-alphanumerics with dashes, collapse consecutive dashes.
function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
}

@Injectable()
export class BlogService {
  private readonly logger = new Logger(BlogService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  // ── Public ────────────────────────────────────────────────────────────────

  async listPublic(opts: {
    limit: number;
    offset: number;
    category?: BlogCategory;
  }) {
    const where: Prisma.BlogPostWhereInput = {
      publishedAt: { not: null, lte: new Date() },
      ...(opts.category ? { category: opts.category } : {}),
    };

    const [posts, total] = await Promise.all([
      this.prisma.blogPost.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        take: opts.limit,
        skip: opts.offset,
        select: {
          id: true,
          slug: true,
          title: true,
          excerpt: true,
          coverImageUrl: true,
          category: true,
          publishedAt: true,
          author: { select: { name: true } },
        },
      }),
      this.prisma.blogPost.count({ where }),
    ]);

    return { posts, total, limit: opts.limit, offset: opts.offset };
  }

  async getPublicBySlug(slug: string) {
    const post = await this.prisma.blogPost.findFirst({
      where: { slug, publishedAt: { not: null, lte: new Date() } },
      select: {
        id: true,
        slug: true,
        title: true,
        excerpt: true,
        body: true,
        coverImageUrl: true,
        category: true,
        publishedAt: true,
        author: { select: { name: true } },
      },
    });
    if (!post) throw new NotFoundException('Post not found');
    return post;
  }

  // ── Admin ─────────────────────────────────────────────────────────────────

  async listAdmin(opts: { limit: number; offset: number }) {
    const [posts, total] = await Promise.all([
      this.prisma.blogPost.findMany({
        orderBy: { createdAt: 'desc' },
        take: opts.limit,
        skip: opts.offset,
        select: {
          id: true,
          slug: true,
          title: true,
          category: true,
          publishedAt: true,
          notifiedAt: true,
          updatedAt: true,
          author: { select: { name: true } },
        },
      }),
      this.prisma.blogPost.count(),
    ]);
    return { posts, total, limit: opts.limit, offset: opts.offset };
  }

  async getAdminById(id: string) {
    const post = await this.prisma.blogPost.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('Post not found');
    return post;
  }

  async create(authorId: string, dto: CreateBlogPostInput) {
    this.validateCategory(dto.category);

    const baseSlug = dto.slug?.trim() ? slugify(dto.slug) : slugify(dto.title);
    if (!baseSlug) {
      throw new BadRequestException('Could not derive slug from title — please provide one explicitly.');
    }

    const slug = await this.ensureUniqueSlug(baseSlug);

    return this.prisma.blogPost.create({
      data: {
        title: dto.title.trim(),
        slug,
        excerpt: dto.excerpt.trim(),
        body: dto.body,
        coverImageUrl: dto.coverImageUrl ?? null,
        category: dto.category,
        authorId,
      },
    });
  }

  async update(id: string, dto: UpdateBlogPostInput) {
    const existing = await this.prisma.blogPost.findUnique({
      where: { id },
      select: { id: true, slug: true },
    });
    if (!existing) throw new NotFoundException('Post not found');

    if (dto.category !== undefined) this.validateCategory(dto.category);

    let nextSlug = existing.slug;
    if (dto.slug && dto.slug.trim()) {
      const candidate = slugify(dto.slug);
      if (candidate && candidate !== existing.slug) {
        nextSlug = await this.ensureUniqueSlug(candidate, id);
      }
    }

    return this.prisma.blogPost.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        slug: nextSlug,
        excerpt: dto.excerpt?.trim(),
        body: dto.body,
        coverImageUrl: dto.coverImageUrl,
        category: dto.category,
      },
    });
  }

  async delete(id: string) {
    await this.prisma.blogPost
      .delete({ where: { id } })
      .catch(() => {
        throw new NotFoundException('Post not found');
      });
    return { deleted: true };
  }

  // Publish flips publishedAt (idempotent — re-publish is a no-op for the
  // timestamp) and dispatches the Premium email blast exactly once via
  // notifiedAt.
  async publish(id: string) {
    const post = await this.prisma.blogPost.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('Post not found');

    const updated = await this.prisma.blogPost.update({
      where: { id },
      data: { publishedAt: post.publishedAt ?? new Date() },
    });

    if (!post.notifiedAt) {
      // Fire-and-forget so the publish response isn't blocked by SMTP latency.
      void this.notifyPremiumUsers(updated.id).catch((err) =>
        this.logger.error(`Blog notification batch failed for post ${updated.id}`, err),
      );
    }

    return updated;
  }

  async unpublish(id: string) {
    const post = await this.prisma.blogPost.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!post) throw new NotFoundException('Post not found');
    return this.prisma.blogPost.update({
      where: { id },
      data: { publishedAt: null },
    });
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private validateCategory(category: BlogCategory) {
    if (!VALID_CATEGORIES.includes(category)) {
      throw new BadRequestException(`Invalid category: ${category}`);
    }
  }

  private async ensureUniqueSlug(base: string, ignoreId?: string): Promise<string> {
    let candidate = base;
    let suffix = 2;
    // 10 tries is plenty — if you collide more than that you've got bigger problems.
    for (let i = 0; i < 10; i++) {
      const clash = await this.prisma.blogPost.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      if (!clash || clash.id === ignoreId) return candidate;
      candidate = `${base}-${suffix++}`;
    }
    throw new ConflictException('Could not generate a unique slug — please pick one manually.');
  }

  private async notifyPremiumUsers(postId: string) {
    const post = await this.prisma.blogPost.findUnique({ where: { id: postId } });
    if (!post || !post.publishedAt) return;

    const recipients = await this.prisma.user.findMany({
      where: { plan: 'PREMIUM', email: { not: '' } },
      select: { email: true, name: true },
    });

    if (recipients.length === 0) {
      // No premium users yet — still mark notified so we don't try every publish.
      await this.prisma.blogPost.update({
        where: { id: postId },
        data: { notifiedAt: new Date() },
      });
      return;
    }

    const results = await Promise.allSettled(
      recipients.map((r) =>
        this.mailService.sendBlogNotification(r.email, r.name, post),
      ),
    );

    const failures = results.filter((r) => r.status === 'rejected').length;
    if (failures > 0) {
      this.logger.warn(
        `Blog notify for post ${postId}: ${failures}/${recipients.length} sends failed`,
      );
    }

    await this.prisma.blogPost.update({
      where: { id: postId },
      data: { notifiedAt: new Date() },
    });
  }
}
