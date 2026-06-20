"use client";

import "katex/dist/katex.min.css";
import { InlineMath, BlockMath } from "react-katex";
import { Fragment } from "react";

// Matches raw LaTeX commands (\frac, \sqrt, …) when no $ delimiters are present.
// Deliberately does NOT treat a lone ^ or _ as math: those collide with prose and
// with our _italic_ markdown, which would render whole English sentences as math.
const RAW_LATEX_RE = /\\[a-zA-Z]+/;

// Inline markdown patterns applied only to plain-text segments (never inside math)
const MARKDOWN_RE = /(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_|`[^`]+`)/g;

function renderMarkdown(text: string): React.ReactNode[] {
  const parts = text.split(MARKDOWN_RE);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*"))
      return <strong key={i}>{part.slice(1, -1)}</strong>;
    if (part.startsWith("_") && part.endsWith("_"))
      return <em key={i}>{part.slice(1, -1)}</em>;
    if (part.startsWith("`") && part.endsWith("`"))
      return <code key={i} className="bg-slate-800 px-1 rounded text-sm font-mono">{part.slice(1, -1)}</code>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}

export default function MathText({ text, className }: { text: string; className?: string }) {
  if (!text) return null;

  // If no $ delimiters but raw LaTeX commands present, render whole string as math
  if (!text.includes("$") && RAW_LATEX_RE.test(text)) {
    return (
      <span className={className} style={{ wordBreak: "break-word" }}>
        <InlineMath math={text} />
      </span>
    );
  }

  // Split on $$...$$ (block) and $...$ (inline)
  const regex = /(\$\$[\s\S]+?\$\$|\$(?!\$)[\s\S]+?\$)/g;
  const parts = text.split(regex);

  return (
    <span className={className} style={{ wordBreak: "break-word", whiteSpace: "pre-wrap" }}>
      {parts.map((part, i) => {
        if (part.startsWith("$$") && part.endsWith("$$"))
          return <BlockMath key={i} math={part.slice(2, -2)} />;
        if (part.startsWith("$") && part.endsWith("$"))
          return <InlineMath key={i} math={part.slice(1, -1)} />;
        // Plain text — apply markdown formatting
        return <Fragment key={i}>{renderMarkdown(part)}</Fragment>;
      })}
    </span>
  );
}
