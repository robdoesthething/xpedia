'use client';

import { useLayoutEffect } from 'react';

/**
 * Applies the saved theme class to <html> before the first paint.
 * useLayoutEffect runs synchronously after DOM mutations, before the browser
 * paints, so dark-mode users see the correct theme immediately.
 * The 0.15s transition on body smooths any brief light→dark shift on load.
 */
export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  useLayoutEffect(() => {
    const saved = localStorage.getItem('xpedia-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (saved === 'dark' || (saved === null && prefersDark)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  return <>{children}</>;
}
