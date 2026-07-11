import { describe, it, expect, beforeEach } from 'vitest';
import { getTheme, setTheme, toggleTheme } from './theme';

describe('theme', () => {
  beforeEach(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.clear();
  });

  it('defaults to dark', () => {
    expect(getTheme()).toBe('dark');
  });

  it('setTheme updates the document attribute and persists it', () => {
    setTheme('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem('nx_theme')).toBe('light');
  });

  it('toggle flips between dark and light', () => {
    setTheme('dark');
    toggleTheme();
    expect(getTheme()).toBe('light');
    toggleTheme();
    expect(getTheme()).toBe('dark');
  });
});
