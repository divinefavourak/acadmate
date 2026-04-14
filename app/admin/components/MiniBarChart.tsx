"use client";

type DataPoint = Record<string, string | number>;

interface MiniBarChartProps {
  data: DataPoint[];
  valueKey: string;
  labelKey?: string;
  color?: "indigo" | "emerald" | "violet" | "amber";
  emptyMessage?: string;
  className?: string;
}

const COLOR_MAP = {
  indigo: "bg-indigo-500 dark:bg-indigo-400",
  emerald: "bg-emerald-500 dark:bg-emerald-400",
  violet: "bg-violet-500 dark:bg-violet-400",
  amber: "bg-amber-500 dark:bg-amber-400",
};

const HOVER_MAP = {
  indigo: "hover:bg-indigo-400 dark:hover:bg-indigo-300",
  emerald: "hover:bg-emerald-400 dark:hover:bg-emerald-300",
  violet: "hover:bg-violet-400 dark:hover:bg-violet-300",
  amber: "hover:bg-amber-400 dark:hover:bg-amber-300",
};

export default function MiniBarChart({
  data,
  valueKey,
  labelKey = "label",
  color = "indigo",
  emptyMessage = "No data yet",
  className = "",
}: MiniBarChartProps) {
  const values = data.map((d) => Number(d[valueKey]) || 0);
  const max = Math.max(...values, 1);
  const isEmpty = values.every((v) => v === 0);

  if (isEmpty) {
    return (
      <div className={`flex items-center justify-center h-64 text-sm text-slate-400 dark:text-slate-500 ${className}`}>
        {emptyMessage}
      </div>
    );
  }

  const barColor = `${COLOR_MAP[color]} ${HOVER_MAP[color]}`;

  return (
    <div className={`flex flex-col gap-2 h-64 ${className}`}>
      {/* Y-axis labels + bars */}
      <div className="flex-1 flex items-end gap-1 relative">
        {/* Horizontal grid lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-0">
          {[100, 75, 50, 25, 0].map((pct) => (
            <div key={pct} className="flex items-center gap-1 w-full">
              <span className="text-[10px] text-slate-400 dark:text-slate-500 w-7 text-right shrink-0">
                {pct === 0 ? "" : Math.round((pct / 100) * max)}
              </span>
              <div className="flex-1 border-t border-dashed border-slate-100 dark:border-slate-800" />
            </div>
          ))}
        </div>

        {/* Bars */}
        <div className="flex-1 flex items-end gap-[2px] pl-8 h-full">
          {data.map((d, i) => {
            const val = values[i];
            const pct = (val / max) * 100;
            return (
              <div
                key={i}
                className="flex-1 flex flex-col items-center justify-end h-full group"
                title={`${d[labelKey]}: ${val}`}
              >
                <div
                  className={`w-full rounded-t-sm transition-all duration-300 ${barColor} cursor-default`}
                  style={{ height: `${pct}%`, minHeight: val > 0 ? "4px" : "0" }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* X-axis labels */}
      <div className="flex pl-8 gap-[2px]">
        {data.map((d, i) => (
          <div key={i} className="flex-1 text-center">
            <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate block leading-tight">
              {String(d[labelKey] ?? "")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
