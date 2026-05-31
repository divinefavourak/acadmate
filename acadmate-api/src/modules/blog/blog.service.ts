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
import { CacheService } from '../../cache/cache.service';

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

// Public blog content is cached for 5 minutes. Any admin write (publish,
// unpublish, update, delete) immediately wipes all blog:public:* keys.
const PUBLIC_CACHE_TTL = 300; // 5 min
const PUBLIC_CACHE_PREFIX = 'blog:public:';

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
    private readonly cache: CacheService,
  ) {}

  // ── Public ────────────────────────────────────────────────────────────────

  async listPublic(opts: {
    limit: number;
    offset: number;
    category?: BlogCategory;
  }) {
    const KEY = `${PUBLIC_CACHE_PREFIX}list:${opts.limit}:${opts.offset}:${opts.category ?? 'all'}`;

    type ListResult = {
      posts: {
        id: string; slug: string; title: string; excerpt: string;
        coverImageUrl: string | null; category: BlogCategory;
        publishedAt: Date | null; author: { name: string | null };
      }[];
      total: number;
      limit: number;
      offset: number;
    };

    const cached = await this.cache.get<ListResult>(KEY);
    if (cached) return cached;

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

    const data = { posts, total, limit: opts.limit, offset: opts.offset };
    void this.cache.set(KEY, data, PUBLIC_CACHE_TTL);
    return data;
  }

  async getPublicBySlug(slug: string) {
    const KEY = `${PUBLIC_CACHE_PREFIX}post:${slug}`;

    type PostResult = {
      id: string; slug: string; title: string; excerpt: string;
      body: string; coverImageUrl: string | null; category: BlogCategory;
      publishedAt: Date | null; author: { name: string | null };
    };

    const cached = await this.cache.get<PostResult>(KEY);
    if (cached) {
      void this.prisma.blogPost.update({ where: { slug }, data: { viewCount: { increment: 1 } } }).catch(() => null);
      return cached;
    }

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
        viewCount: true,
        author: { select: { name: true } },
      },
    });
    if (!post) throw new NotFoundException('Post not found');

    void this.cache.set(KEY, post, PUBLIC_CACHE_TTL);
    void this.prisma.blogPost.update({ where: { id: post.id }, data: { viewCount: { increment: 1 } } }).catch(() => null);
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
          viewCount: true,
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

    const result = await this.prisma.blogPost.update({
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

    await this.cache.delByPrefix(PUBLIC_CACHE_PREFIX);
    return result;
  }

  async delete(id: string) {
    await this.prisma.blogPost
      .delete({ where: { id } })
      .catch(() => {
        throw new NotFoundException('Post not found');
      });
    await this.cache.delByPrefix(PUBLIC_CACHE_PREFIX);
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

    await this.cache.delByPrefix(PUBLIC_CACHE_PREFIX);

    if (!post.notifiedAt) {
      this.logger.log(
        `Publishing post ${id} ("${updated.title}") — dispatching premium email blast`,
      );
      // Fire-and-forget so the publish response isn't blocked by SMTP latency.
      void this.notifyPremiumUsers(updated.id).catch((err) =>
        this.logger.error(`Blog notification batch failed for post ${updated.id}`, err),
      );
    } else {
      this.logger.log(
        `Publishing post ${id} ("${updated.title}") — email blast skipped, notifiedAt already set at ${post.notifiedAt.toISOString()}`,
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
    const result = await this.prisma.blogPost.update({
      where: { id },
      data: { publishedAt: null },
    });
    await this.cache.delByPrefix(PUBLIC_CACHE_PREFIX);
    return result;
  }

  // Manually trigger the premium email blast for a published post. Unlike the
  // automatic publish-time blast, this always re-sends (bypasses the
  // notifiedAt guard) so admins can recover from SMTP failures or send to
  // newly-added premium users.
  async notify(id: string) {
    const post = await this.prisma.blogPost.findUnique({
      where: { id },
      select: { id: true, publishedAt: true, title: true },
    });
    if (!post) throw new NotFoundException('Post not found');
    if (!post.publishedAt) {
      throw new BadRequestException('Post must be published before sending email');
    }

    this.logger.log(`Manual email blast requested for post ${id} ("${post.title}")`);
    const result = await this.notifyPremiumUsers(id);
    return result;
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

  private async notifyPremiumUsers(
    postId: string,
  ): Promise<{ recipients: number; successes: number; failures: number }> {
    const post = await this.prisma.blogPost.findUnique({ where: { id: postId } });
    if (!post) {
      this.logger.warn(`notifyPremiumUsers: post ${postId} not found, skipping`);
      return { recipients: 0, successes: 0, failures: 0 };
    }
    if (!post.publishedAt) {
      this.logger.warn(
        `notifyPremiumUsers: post ${postId} has no publishedAt, skipping`,
      );
      return { recipients: 0, successes: 0, failures: 0 };
    }

    const recipients = await this.prisma.user.findMany({
      where: { plan: 'PREMIUM', email: { not: '' } },
      select: { email: true, name: true },
    });

    this.logger.log(
      `notifyPremiumUsers: found ${recipients.length} premium recipient(s) for post "${post.title}"`,
    );

    if (recipients.length === 0) {
      // Leave notifiedAt null so a future publish (once PREMIUM users exist)
      // can still trigger the blast. Marking it here would permanently lock
      // the post out of email notifications.
      this.logger.warn(
        `notifyPremiumUsers: no PREMIUM users in database — nothing to send for post ${postId}`,
      );
      return { recipients: 0, successes: 0, failures: 0 };
    }

    this.logger.log(
      `Dispatching ${recipients.length} blog notification email(s) for post ${postId}...`,
    );

    const results = await Promise.allSettled(
      recipients.map((r) =>
        this.mailService.sendBlogNotification(r.email, r.name, post),
      ),
    );

    const failures = results.filter((r) => r.status === 'rejected').length;
    const successes = results.length - failures;

    this.logger.log(
      `Blog notify result for post ${postId}: ${successes} sent, ${failures} failed (of ${recipients.length})`,
    );

    // Only mark notified if at least one email went out successfully.
    // If all failed (e.g. SMTP misconfigured), leave notifiedAt null so the
    // next publish attempt retries the blast.
    if (successes > 0) {
      await this.prisma.blogPost.update({
        where: { id: postId },
        data: { notifiedAt: new Date() },
      });
      this.logger.log(`Marked post ${postId} as notified (notifiedAt set)`);
    }

    return { recipients: recipients.length, successes, failures };
  }
}
