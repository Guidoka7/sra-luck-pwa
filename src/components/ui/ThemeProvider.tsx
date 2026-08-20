"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

type Theme = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const STORAGE_KEY = "sra-luck-theme";

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");

  // A preferência vale durante a sessão atual, inclusive ao trocar de rota.
  // Uma nova sessão começa em modo claro, como definido pelo produto.
  useEffect(() => {
    let next: Theme = "light";
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved === "dark" || saved === "light") next = saved;
    } catch {}

    setThemeState(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    document.documentElement.style.colorScheme = next;
  }, []);

  function setTheme(next: Theme) {
    setThemeState(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    document.documentElement.style.colorScheme = next;
    try {
      sessionStorage.setItem(STORAGE_KEY, next);
    } catch {}
  }

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme: () => setTheme(theme === "dark" ? "light" : "dark"),
    }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
}
