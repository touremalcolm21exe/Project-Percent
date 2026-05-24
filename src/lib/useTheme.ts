import { useEffect, useState } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'pp-theme';

function applyTheme(pref: ThemePreference) {
  const root = document.documentElement;
  const dark =
    pref === 'dark' ||
    (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  root.classList.toggle('dark', dark);
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemePreference>(() => {
    return (localStorage.getItem(STORAGE_KEY) as ThemePreference) ?? 'system';
  });

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Re-apply when OS preference changes (only matters when pref === 'system')
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if ((localStorage.getItem(STORAGE_KEY) ?? 'system') === 'system') {
        applyTheme('system');
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  function setTheme(pref: ThemePreference) {
    localStorage.setItem(STORAGE_KEY, pref);
    setThemeState(pref);
  }

  return { theme, setTheme };
}

// Call once at module load so the page doesn't flash wrong theme on init
applyTheme((localStorage.getItem(STORAGE_KEY) as ThemePreference) ?? 'system');
