import type { Metadata } from "next";

// ─── Site constants ──────────────────────────────────────────────────────────

export const SITE_NAME = "Acadmate";
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://acadmate.com.ng";
export const SITE_DESCRIPTION =
  "Free JAMB CBT practice and Post-UTME past questions for Nigerian students. " +
  "8,600+ questions across 11 subjects. Practice online, track your progress, and ace your exams.";

// Default OG fallback — replace with a proper 1200×630 branded image.
export const DEFAULT_OG_IMAGE =
  "/images/520596414_739489019062965_5923685459460735498_n.jpg";

// ─── URL helpers ─────────────────────────────────────────────────────────────

export function canonicalUrl(path: string): string {
  const base = SITE_URL.replace(/\/$/, "");
  return `${base}${path}`;
}

// ─── Metadata builder ────────────────────────────────────────────────────────

/**
 * Build a full Next.js Metadata object.
 * Sets canonical, OpenGraph, Twitter cards and robots in one call.
 */
export function buildMetadata({
  title,
  titleTemplate = true,
  description,
  path,
  ogImage,
  noindex = false,
  type = "website",
  article,
}: {
  title: string;
  titleTemplate?: boolean;
  description: string;
  path: string;
  ogImage?: string;
  noindex?: boolean;
  type?: "website" | "article";
  article?: {
    publishedTime: string;
    modifiedTime?: string;
    authors?: string[];
    tags?: string[];
  };
}): Metadata {
  const fullTitle = titleTemplate ? `${title} | ${SITE_NAME}` : title;
  const canonical = canonicalUrl(path);
  const image = ogImage ?? canonicalUrl(DEFAULT_OG_IMAGE);

  return {
    title: fullTitle,
    description,
    alternates: { canonical },
    robots: noindex
      ? { index: false, follow: false }
      : {
          index: true,
          follow: true,
          googleBot: { index: true, follow: true },
        },
    openGraph: {
      title: fullTitle,
      description,
      url: canonical,
      siteName: SITE_NAME,
      type,
      images: [{ url: image, width: 1200, height: 630, alt: fullTitle }],
      locale: "en_NG",
      ...(article && {
        publishedTime: article.publishedTime,
        ...(article.modifiedTime && { modifiedTime: article.modifiedTime }),
        ...(article.authors && { authors: article.authors }),
        ...(article.tags && { tags: article.tags }),
      }),
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [image],
    },
  };
}

// ─── JSON-LD schema builders ─────────────────────────────────────────────────

export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    "@id": `${SITE_URL}/#organization`,
    name: SITE_NAME,
    alternateName: "Acadmate Business Consult",
    url: SITE_URL,
    logo: {
      "@type": "ImageObject",
      url: canonicalUrl("/images/logo.jpg"),
      width: 192,
      height: 192,
    },
    description: SITE_DESCRIPTION,
    areaServed: "NG",
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      url: "https://wa.me/2349031843486",
      availableLanguage: "English",
    },
  };
}

export function webSiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    publisher: { "@id": `${SITE_URL}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/blog?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
    inLanguage: "en-NG",
  };
}

export function articleSchema(post: {
  title: string;
  excerpt: string;
  slug: string;
  publishedAt: string;
  updatedAt?: string;
  author?: { name: string | null } | null;
  coverImageUrl?: string | null;
  category?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": canonicalUrl(`/blog/${post.slug}`),
    headline: post.title,
    description: post.excerpt,
    url: canonicalUrl(`/blog/${post.slug}`),
    image: post.coverImageUrl
      ? [post.coverImageUrl]
      : [canonicalUrl(DEFAULT_OG_IMAGE)],
    datePublished: post.publishedAt,
    dateModified: post.updatedAt ?? post.publishedAt,
    author: {
      "@type": "Person",
      name: post.author?.name ?? "Acadmate Team",
    },
    publisher: { "@id": `${SITE_URL}/#organization` },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": canonicalUrl(`/blog/${post.slug}`),
    },
    articleSection: post.category ?? "General",
    inLanguage: "en-NG",
  };
}

export function breadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function discussionForumPostingSchema(thread: {
  id: string;
  title: string;
  body: string;
  author: { name: string | null };
  createdAt: string;
  updatedAt?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "DiscussionForumPosting",
    "@id": canonicalUrl(`/forum/${thread.id}`),
    headline: thread.title,
    text: thread.body.slice(0, 500),
    url: canonicalUrl(`/forum/${thread.id}`),
    datePublished: thread.createdAt,
    ...(thread.updatedAt && { dateModified: thread.updatedAt }),
    author: {
      "@type": "Person",
      name: thread.author.name ?? "Anonymous",
    },
    isPartOf: {
      "@type": "DiscussionForum",
      name: `${SITE_NAME} Community Forum`,
      url: canonicalUrl("/forum"),
    },
  };
}

export function webPageSchema(opts: {
  title: string;
  description: string;
  path: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": canonicalUrl(opts.path),
    name: opts.title,
    description: opts.description,
    url: canonicalUrl(opts.path),
    isPartOf: { "@id": `${SITE_URL}/#website` },
    inLanguage: "en-NG",
  };
}

/**
 * One multiple-choice past question as a schema.org Quiz (Google's
 * practice-problem shape). All text must already be plain, without LaTeX or markdown.
 */
export function quizSchema(q: {
  path: string;
  name: string;
  subject: string;
  topic?: string | null;
  text: string;
  options: { label: string; plainText: string }[];
  answer: string;
  explanation?: string | null;
}) {
  const answerText = (o: { label: string; plainText: string }) => `${o.label}. ${o.plainText}`;
  const correct = q.options.find((o) => o.label === q.answer);
  return {
    "@context": "https://schema.org",
    "@type": "Quiz",
    "@id": canonicalUrl(q.path),
    name: q.name,
    url: canonicalUrl(q.path),
    inLanguage: "en-NG",
    about: { "@type": "Thing", name: q.topic ?? q.subject },
    educationalLevel: "Senior secondary",
    educationalAlignment: [
      {
        "@type": "AlignmentObject",
        alignmentType: "educationalSubject",
        targetName: q.subject,
      },
    ],
    provider: { "@id": `${SITE_URL}/#organization` },
    hasPart: [
      {
        "@type": "Question",
        eduQuestionType: "Multiple choice",
        learningResourceType: "Practice problem",
        text: q.text,
        ...(correct && {
          acceptedAnswer: {
            "@type": "Answer",
            position: q.options.indexOf(correct),
            text: answerText(correct),
            ...(q.explanation && {
              answerExplanation: { "@type": "Comment", text: q.explanation },
            }),
          },
        }),
        suggestedAnswer: q.options
          .filter((o) => o !== correct)
          .map((o) => ({
            "@type": "Answer",
            position: q.options.indexOf(o),
            text: answerText(o),
          })),
      },
    ],
  };
}

/** Serialise JSON-LD for a <script> tag; escapes "<" so text can't close the tag. */
export function jsonLdHtml(data: unknown): { __html: string } {
  return { __html: JSON.stringify(data).replace(/</g, "\\u003c") };
}
