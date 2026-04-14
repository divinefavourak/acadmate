"use client";

import { useState } from "react";

interface CalculatorProps {
  onClose: () => void;
}

type ButtonStyle = "number" | "utility" | "operator" | "equals";

interface CalcButton {
  label: string;
  action: () => void;
  style: ButtonStyle;
  wide?: boolean;
}

function safeEval(expr: string): string {
  try {
    const sanitized = expr
      .replace(/×/g, "*")
      .replace(/÷/g, "/")
      // guard against empty or trailing operator
      .replace(/[+\-*/]$/, "");
    if (!sanitized) return "0";
    // eslint-disable-next-line no-new-func
    const result = new Function("return (" + sanitized + ")")();
    if (typeof result !== "number" || !isFinite(result)) return "Error";
    return parseFloat(result.toFixed(10)).toString();
  } catch {
    return "Error";
  }
}

export default function Calculator({ onClose }: CalculatorProps) {
  const [expr, setExpr] = useState("0");
  const [prevExpr, setPrevExpr] = useState("");
  const [justComputed, setJustComputed] = useState(false);

  const displayValue =
    expr.length > 12 ? parseFloat(parseFloat(expr).toPrecision(10)).toString() : expr;

  function appendChar(ch: string) {
    setExpr((prev) => {
      if (justComputed) {
        setJustComputed(false);
        // If starting a new number after result, replace; if operator, chain
        if (["+", "-", "×", "÷"].includes(ch)) return prev + ch;
        return ch === "0" ? "0" : ch;
      }
      // Prevent leading zeros (but allow "0.")
      if (prev === "0" && ch !== "." && !isNaN(Number(ch))) return ch;
      // Prevent double decimal in the current number
      const lastNum = prev.split(/[+\-×÷]/).pop() ?? "";
      if (ch === "." && lastNum.includes(".")) return prev;
      return prev + ch;
    });
  }

  function appendOperator(op: string) {
    setJustComputed(false);
    setExpr((prev) => {
      if (prev === "Error") return "0" + op;
      // Replace trailing operator if any
      return prev.replace(/[+\-×÷]$/, "") + op;
    });
  }

  function handleEquals() {
    const result = safeEval(expr);
    setPrevExpr(expr + " =");
    setExpr(result);
    setJustComputed(true);
  }

  function handleClear() {
    setExpr("0");
    setPrevExpr("");
    setJustComputed(false);
  }

  function handleBackspace() {
    if (justComputed) return;
    setExpr((prev) => {
      const next = prev.slice(0, -1);
      return next === "" || next === "-" ? "0" : next;
    });
  }

  function handlePercent() {
    const result = safeEval(expr);
    if (result === "Error") return;
    const pct = parseFloat(result) / 100;
    setExpr(parseFloat(pct.toFixed(10)).toString());
    setJustComputed(true);
  }

  function handleSign() {
    setExpr((prev) => {
      if (prev === "0" || prev === "Error") return prev;
      return prev.startsWith("-") ? prev.slice(1) : "-" + prev;
    });
  }

  const rows: CalcButton[][] = [
    [
      { label: "AC", action: handleClear, style: "utility" },
      { label: "+/-", action: handleSign, style: "utility" },
      { label: "%", action: handlePercent, style: "utility" },
      { label: "÷", action: () => appendOperator("÷"), style: "operator" },
    ],
    [
      { label: "7", action: () => appendChar("7"), style: "number" },
      { label: "8", action: () => appendChar("8"), style: "number" },
      { label: "9", action: () => appendChar("9"), style: "number" },
      { label: "×", action: () => appendOperator("×"), style: "operator" },
    ],
    [
      { label: "4", action: () => appendChar("4"), style: "number" },
      { label: "5", action: () => appendChar("5"), style: "number" },
      { label: "6", action: () => appendChar("6"), style: "number" },
      { label: "−", action: () => appendOperator("-"), style: "operator" },
    ],
    [
      { label: "1", action: () => appendChar("1"), style: "number" },
      { label: "2", action: () => appendChar("2"), style: "number" },
      { label: "3", action: () => appendChar("3"), style: "number" },
      { label: "+", action: () => appendOperator("+"), style: "operator" },
    ],
    [
      { label: "0", action: () => appendChar("0"), style: "number", wide: true },
      { label: ".", action: () => appendChar("."), style: "number" },
      { label: "=", action: handleEquals, style: "equals" },
    ],
  ];

  const styleMap: Record<ButtonStyle, string> = {
    utility: "bg-slate-500 hover:bg-slate-400 text-white",
    operator: "bg-amber-500 hover:bg-amber-400 text-white",
    equals: "bg-amber-500 hover:bg-amber-400 text-white",
    number: "bg-slate-700 hover:bg-slate-600 text-white",
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel — bottom sheet on mobile, centered card on sm+ */}
      <div className="fixed z-50 bottom-0 inset-x-0 sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-80 bg-[#1c1c1e] rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">
        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-slate-600" />
        </div>

        {/* Header row */}
        <div className="flex items-center justify-between px-4 pt-2 pb-1 sm:pt-4">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Calculator
          </span>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-slate-300 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        {/* Display */}
        <div className="px-5 pb-3 text-right min-h-[5rem] flex flex-col justify-end">
          <p className="text-slate-500 text-sm truncate h-5">
            {prevExpr}
          </p>
          <p className="text-white font-light text-5xl mt-1 truncate leading-tight">
            {displayValue}
          </p>
        </div>

        {/* Button grid */}
        <div className="px-3 pb-8 sm:pb-4 grid grid-cols-4 gap-2.5">
          {rows.flat().map((btn, i) => (
            <button
              key={i}
              onClick={btn.action}
              className={`
                ${styleMap[btn.style]}
                ${btn.wide ? "col-span-2 justify-start pl-7" : ""}
                rounded-full h-16 text-2xl font-medium
                flex items-center justify-center
                active:scale-95 transition-transform select-none
              `}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
