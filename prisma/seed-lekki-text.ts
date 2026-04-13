/**
 * Seeds The Lekki Headmaster novel text as ProseSection chapters.
 *
 * Usage (set DATABASE_URL first):
 *   npx tsx prisma/seed-lekki-text.ts
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

if (!process.env.DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is not set.");
  process.exit(1);
}

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

const ORDINALS = [
  "One", "Two", "Three", "Four", "Five", "Six",
  "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve",
  "Thirteen", "Fourteen", "Fifteen", "Sixteen",
];

function cleanContent(text: string): string {
  return text
    // Remove page headers: "The Lekki Headmaster | 12" or "The Lekki Headmaster 15"
    .replace(/The Lekki Headmaster\s*[\|]?\s*\d+/gi, "")
    // Remove single-character drop-cap lines (OCR artifact at chapter starts)
    .replace(/^\s*[A-Z]\s*$/gm, "")
    // Collapse 3+ newlines to 2
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function main() {
  const txtPath = path.join(process.cwd(), "the-lekki-headmaster-mojecs-copy.txt");
  if (!fs.existsSync(txtPath)) {
    console.error("Text file not found:", txtPath);
    process.exit(1);
  }

  const raw = fs.readFileSync(txtPath, "utf-8").replace(/\r\n/g, "\n");
  const lines = raw.split("\n");

  // Find the prose record
  const prose = await prisma.proseText.findFirst({
    where: { title: { contains: "Lekki Headmaster" } },
  });
  if (!prose) {
    console.error("ProseText record not found. Run npm run db:seed first.");
    process.exit(1);
  }
  console.log(`Found prose: ${prose.title} (${prose.id})`);

  // Delete existing sections
  const deleted = await prisma.proseSection.deleteMany({ where: { proseTextId: prose.id } });
  console.log(`Deleted ${deleted.count} existing sections`);

  // Parse chapters
  // Pattern: line containing exactly an ordinal word (e.g. "One", "Two") is a chapter start
  const chapters: { number: string; title: string; content: string }[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (ORDINALS.includes(line)) {
      const chapterNum = line;
      // Next non-empty line is the subtitle
      let j = i + 1;
      while (j < lines.length && lines[j].trim() === "") j++;
      const subtitle = lines[j]?.trim() ?? "";

      // Content starts after subtitle
      const contentStart = j + 1;
      // Content ends at the next ordinal chapter start
      let contentEnd = lines.length;
      for (let k = contentStart; k < lines.length; k++) {
        if (ORDINALS.includes(lines[k].trim())) {
          // Also check prev line is a single letter (drop-cap) or empty
          const prevLine = lines[k - 1]?.trim() ?? "";
          if (prevLine.length <= 1 || prevLine === "") {
            contentEnd = k - (prevLine.length <= 1 ? 1 : 0);
            break;
          }
        }
      }

      const rawContent = lines.slice(contentStart, contentEnd).join("\n");
      chapters.push({
        number: chapterNum,
        title: subtitle || `Chapter ${chapterNum}`,
        content: cleanContent(rawContent),
      });
      i = contentEnd;
    } else {
      i++;
    }
  }

  console.log(`Parsed ${chapters.length} chapters`);

  for (let idx = 0; idx < chapters.length; idx++) {
    const ch = chapters[idx];
    const title = `Chapter ${ch.number}${ch.title && ch.title !== `Chapter ${ch.number}` ? ": " + ch.title : ""}`;
    await prisma.proseSection.create({
      data: {
        proseTextId: prose.id,
        title,
        content: ch.content,
        sortOrder: idx,
      },
    });
    console.log(`  Created: ${title} (${ch.content.length} chars)`);
  }

  console.log("\n✓ Done. Run the app to view the novel reader.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
