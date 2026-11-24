"use client";

import { createContext, useCallback, useContext, useSyncExternalStore } from "react";

type Theme = "dark" | "light";

const ThemeCtx = createContext<{ theme: Theme; toggle: () => void }>({
  theme: "dark",
  toggle: () => {},
});

export function useTheme() {
  return useContext(ThemeCtx);
}

// The source of truth is the `dark` class on <html>. an inline script in app/layout.tsx
// sets it before first paint (from localStorage, else the OS preference), so React only
// has to read it, and every toggle on the page stays in sync with the class.
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

const getSnapshot = (): Theme =>
  document.documentElement.classList.contains("dark") ? "dark" : "light";

// The server can't know the visitor's theme. React renders this during hydration,
// then re-renders with the real value, so the toggle icon never mismatches.
const getServerSnapshot = (): Theme => "dark";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = useCallback(() => {
    const next: Theme = getSnapshot() === "dark" ? "light" : "dark";
    try {
      localStorage.setItem("acadmate-theme", next);
    } catch {
      // Private mode or blocked storage: the choice lasts for this page only.
    }
    document.documentElement.classList.toggle("dark", next === "dark");
  }, []);

  return <ThemeCtx.Provider value={{ theme, toggle }}>{children}</ThemeCtx.Provider>;
}
