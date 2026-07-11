import { useEffect, useState } from 'preact/hooks';

// Theme is stored on <html data-theme>, set before first paint by a tiny inline script in
// index.html (so there is no flash). This module is the single place that reads and writes it,
// with a subscribe seam so any component re-renders when it changes.

export type Theme = 'dark' | 'light';
const STORAGE_KEY = 'nx_theme';
type Listener = (t: Theme) => void;
const listeners = new Set<Listener>();

export function getTheme(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

export function setTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
  try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* private mode */ }
  for (const l of listeners) l(theme);
}

export function toggleTheme(): void {
  setTheme(getTheme() === 'dark' ? 'light' : 'dark');
}

function subscribe(l: Listener): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

/** Reactive theme access for components: the current theme plus a toggle. */
export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setLocal] = useState<Theme>(getTheme());
  useEffect(() => subscribe(setLocal), []);
  return { theme, toggle: toggleTheme };
}
