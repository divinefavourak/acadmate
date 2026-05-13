import React from "react";

interface StatCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  trend?: "up" | "down" | "neutral";
}

export default function StatCard({ title, value, subtitle, icon, trend }: StatCardProps) {
  return (
    <div className="glass-panel p-4 sm:p-6 rounded-2xl flex flex-col min-w-0">
      <div className="flex items-center justify-between mb-3 sm:mb-4 gap-2">
        <h3 className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 truncate">{title}</h3>
        <div className="shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 scale-90 sm:scale-100">
          {icon}
        </div>
      </div>
      <div className="min-w-0">
        <div className="text-xl sm:text-3xl font-bold mb-1 truncate" title={value}>{value}</div>
        <p className={`text-xs sm:text-sm truncate ${trend === "up" ? "text-emerald-500" : trend === "down" ? "text-red-500" : "text-slate-500 dark:text-slate-400"}`}>
          {subtitle}
        </p>
      </div>
    </div>
  );
}
