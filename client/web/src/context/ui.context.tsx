/**
 * UI Context
 * 
 * Manages theme state and provides useTheme hook
 * Replaces the old ThemeProvider component
 */

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light" | "system";

type UIContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const UIContext = createContext<UIContextValue | undefined>(undefined);

type UIProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

export function UIProvider({
  children,
  defaultTheme = "system",
  storageKey = "vite-ui-theme",
}: UIProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") {
      return defaultTheme;
    }

    try {
      const stored = localStorage.getItem(storageKey);
      return (stored as Theme) || defaultTheme;
    } catch {
      return defaultTheme;
    }
  });

  // Update DOM when theme changes
  useEffect(() => {
    const root = window.document.documentElement;

    root.classList.remove("light", "dark");

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";

      root.classList.add(systemTheme);
      return;
    }

    root.classList.add(theme);
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(storageKey, newTheme);
      } catch {
        // ignore
      }
    }

    setThemeState(newTheme);
  };

  const value: UIContextValue = {
    theme,
    setTheme,
  };

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

/**
 * Hook to consume UI context
 */
export function useTheme(): UIContextValue {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error("useTheme must be used within UIProvider");
  }
  return context;
}
