"use client";

import "katex/dist/katex.min.css";
import { InlineMath, BlockMath } from "react-katex";

// Matches LaTeX commands like \frac, \sqrt, \int, \sum, ^ or _ used in expressions.
const RAW_LATEX_RE = /\\[a-zA-Z]+|(?<![a-zA-Z0-9])\^|(?<![a-zA-Z0-9])_/;

export default function MathText({ text, className }: { text: string; className?: string }) {
  if (!text) return null;

  // If there are no $ delimiters but raw LaTeX commands are present, render
  // the whole string as inline math (covers AI-extracted questions that omit $ wrapping).
  if (!text.includes("$") && RAW_LATEX_RE.test(text)) {
    return (
      <span className={className} style={{ wordBreak: "break-word" }}>
        <InlineMath math={text} />
      </span>
    );
  }

  // Split on $$...$$ (block) and $...$ (inline), capturing the delimiters
  const regex = /(\$\$[\s\S]+?\$\$|\$(?!\$)[\s\S]+?\$)/g;
  const parts = text.split(regex);

  return (
    <span className={className} style={{ wordBreak: "break-word", whiteSpace: "pre-wrap" }}>
      {parts.map((part, i) => {
        if (part.startsWith("$$") && part.endsWith("$$")) {
          return <BlockMath key={i} math={part.slice(2, -2)} />;
        }
        if (part.startsWith("$") && part.endsWith("$")) {
          return <InlineMath key={i} math={part.slice(1, -1)} />;
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}
