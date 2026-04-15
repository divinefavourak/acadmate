"use client";

import "katex/dist/katex.min.css";
import { InlineMath, BlockMath } from "react-katex";

export default function MathText({ text, className }: { text: string; className?: string }) {
  if (!text) return null;

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
