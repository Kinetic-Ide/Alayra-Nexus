import { Sun, Moon } from 'lucide-preact';
import { useTheme } from '../theme';
import s from './shell.module.css';

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const dark = theme === 'dark';
  return (
    <button
      type="button"
      class={s.iconChip}
      onClick={toggle}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={dark ? 'Light theme' : 'Dark theme'}
    >
      {dark ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}
