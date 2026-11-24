"use client";

import { useTheme } from "./ThemeProvider";

const SunIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
  </svg>
);

const MoonIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
  </svg>
);

/**
 * Light/dark switch. Icon-only by default. With `label`, it also names the mode it
 * switches to, for menus and the expanded sidebar.
 */
export function ThemeToggle({ className = "", label = false }: { className?: string; label?: boolean }) {
  const { theme, toggle } = useTheme();
  const target = theme === "dark" ? "Light mode" : "Dark mode";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${target.toLowerCase()}`}
      title={label ? undefined : target}
      className={
        className ||
        "p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
      }
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
      {label && <span>{target}</span>}
    </button>
  );
}
