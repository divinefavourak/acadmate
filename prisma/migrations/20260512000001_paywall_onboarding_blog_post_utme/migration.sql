-- Add paywall, onboarding, blog, and Post-UTME schema changes.

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'PREMIUM');

-- CreateEnum
CREATE TYPE "BlogCategory" AS ENUM (
    'UTME',
    'POST_UTME',
    'JAMB',
    'SCHOOL_NEWS',
    'STUDY_TIPS',
    'SCHOLARSHIPS',
    'CAREER',
    'ANNOUNCEMENT',
    'GENERAL'
);

-- CreateEnum
CREATE TYPE "ExamType" AS ENUM ('JAMB', 'WAEC', 'POST_UTME');

-- AlterEnum
ALTER TYPE "ExamMode" ADD VALUE 'POST_UTME';

-- AlterTable
ALTER TABLE "users" ADD COLUMN "plan" "Plan" NOT NULL DEFAULT 'FREE';
ALTER TABLE "users" ADD COLUMN "onboardedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "student_profiles" ADD COLUMN "age" INTEGER;
ALTER TABLE "student_profiles" ADD COLUMN "avatarConfig" JSONB;
ALTER TABLE "student_profiles" ADD COLUMN "avatarUrl" TEXT;

-- AlterTable
ALTER TABLE "questions" ADD COLUMN "school" TEXT;
ALTER TABLE "questions" ADD COLUMN "examType" "ExamType";

-- AlterTable
ALTER TABLE "results" ALTER COLUMN "subjectBreakdown" SET DEFAULT '{}';
ALTER TABLE "results" ALTER COLUMN "topicBreakdown" SET DEFAULT '{}';

-- CreateTable
CREATE TABLE "access_tokens" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "note" TEXT,
    "generatedById" TEXT NOT NULL,
    "usedById" TEXT,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_posts" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "coverImageUrl" TEXT,
    "category" "BlogCategory" NOT NULL DEFAULT 'GENERAL',
    "authorId" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "access_tokens_code_key" ON "access_tokens"("code");
CREATE UNIQUE INDEX "access_tokens_usedById_key" ON "access_tokens"("usedById");
CREATE INDEX "access_tokens_generatedById_idx" ON "access_tokens"("generatedById");

-- CreateIndex
CREATE INDEX "questions_school_idx" ON "questions"("school");
CREATE INDEX "questions_examType_idx" ON "questions"("examType");
CREATE INDEX "questions_school_examType_idx" ON "questions"("school", "examType");
CREATE INDEX "questions_school_examType_year_idx" ON "questions"("school", "examType", "year");

-- CreateIndex
CREATE UNIQUE INDEX "blog_posts_slug_key" ON "blog_posts"("slug");
CREATE INDEX "blog_posts_publishedAt_idx" ON "blog_posts"("publishedAt");
CREATE INDEX "blog_posts_category_publishedAt_idx" ON "blog_posts"("category", "publishedAt");

-- AddForeignKey
ALTER TABLE "access_tokens" ADD CONSTRAINT "access_tokens_generatedById_fkey"
    FOREIGN KEY ("generatedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_tokens" ADD CONSTRAINT "access_tokens_usedById_fkey"
    FOREIGN KEY ("usedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
