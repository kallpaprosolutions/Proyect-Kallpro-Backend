import { useState, useEffect } from 'react';

type Theme = 'light' | 'dark';

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem('kallpa-theme') as Theme | null;
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem('kallpa-theme', theme);
  }, [theme]);

  // Apply on mount (handles SSR/HMR edge cases)
  useEffect(() => {
    applyTheme(theme);
  }, []);

  const toggle = () => setThemeState(t => t === 'light' ? 'dark' : 'light');
  const setTheme = (t: Theme) => setThemeState(t);

  return { theme, toggle, setTheme, isDark: theme === 'dark' };
}
