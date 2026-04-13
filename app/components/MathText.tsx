"use client";

import katex from "katex";

type Part = { type: "text" | "block" | "inline"; content: string };

function parseMath(text: string): Part[] {
  const parts: Part[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    // Try display math $$...$$
    const displayIdx = remaining.indexOf("$$");
    // Try inline math $...$
    const inlineIdx = remaining.indexOf("$");

    if (displayIdx !== -1 && (inlineIdx === -1 || displayIdx <= inlineIdx)) {
      if (displayIdx > 0) parts.push({ type: "text", content: remaining.slice(0, displayIdx) });
      const end = remaining.indexOf("$$", displayIdx + 2);
      if (end === -1) { parts.push({ type: "text", content: remaining.slice(displayIdx) }); break; }
      parts.push({ type: "block", content: remaining.slice(displayIdx + 2, end) });
      remaining = remaining.slice(end + 2);
    } else if (inlineIdx !== -1) {
      if (inlineIdx > 0) parts.push({ type: "text", content: remaining.slice(0, inlineIdx) });
      const end = remaining.indexOf("$", inlineIdx + 1);
      if (end === -1) { parts.push({ type: "text", content: remaining.slice(inlineIdx) }); break; }
      parts.push({ type: "inline", content: remaining.slice(inlineIdx + 1, end) });
      remaining = remaining.slice(end + 1);
    } else {
      parts.push({ type: "text", content: remaining });
      break;
    }
  }
  return parts;
}

export default function MathText({ text, className }: { text: string; className?: string }) {
  const hasMath = text.includes("$");
  if (!hasMath) return <span className={className}>{text}</span>;

  const parts = parseMath(text);
  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (part.type === "text") return <span key={i}>{part.content}</span>;
        try {
          const html = katex.renderToString(part.content, {
            throwOnError: false,
            displayMode: part.type === "block",
          });
          return <span key={i} dangerouslySetInnerHTML={{ __html: html }} />;
        } catch {
          return <span key={i}>{part.content}</span>;
        }
      })}
    </span>
  );
}
