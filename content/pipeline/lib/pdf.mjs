// Split a PDF into overlapping page chunks small enough to send as one document block each.
import fs from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import { PDF_CHUNK_STRIDE, PDF_PAGES_PER_CHUNK } from '../config.mjs';

/** Page ranges (0-based, end exclusive) for a document of `pageCount` pages. */
export function chunkRanges(pageCount) {
  const ranges = [];
  for (let start = 0; start < pageCount; start += PDF_CHUNK_STRIDE) {
    const end = Math.min(start + PDF_PAGES_PER_CHUNK, pageCount);
    ranges.push({ start, end });
    if (end === pageCount) break;
  }
  return ranges;
}

export async function loadPdf(file) {
  return PDFDocument.load(fs.readFileSync(file), { ignoreEncryption: true });
}

/** Base64 of a new PDF holding pages [start, end) of `doc`. */
export async function sliceBase64(doc, start, end) {
  const out = await PDFDocument.create();
  const pages = await out.copyPages(doc, Array.from({ length: end - start }, (_, i) => start + i));
  for (const p of pages) out.addPage(p);
  return Buffer.from(await out.save()).toString('base64');
}
