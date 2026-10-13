'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { resolveThemePreference, type Theme } from '@/lib/theme-preference';

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  resetTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const storageKey = 'nora-theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');
  const [initializedTheme, setInitializedTheme] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      let savedTheme: string | null = null;
      try {
        savedTheme = window.localStorage.getItem(storageKey);
      } catch {
        // Storage may be disabled; the default remains light.
      }
      setTheme(resolveThemePreference(savedTheme));
      setInitializedTheme(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!initializedTheme) return;
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
    try {
      window.localStorage.setItem(storageKey, theme);
    } catch {
      // Theme switching still works without persistent browser storage.
    }
  }, [theme, initializedTheme]);

  const value = useMemo(
    () => ({
      theme,
      resetTheme: () => setTheme('light'),
      toggleTheme: () =>
        setTheme((current) => (current === 'light' ? 'dark' : 'light')),
    }),
    [theme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
