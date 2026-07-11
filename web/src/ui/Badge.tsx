import { clsx } from 'clsx';
import type { ComponentChildren } from 'preact';
import s from './ui.module.css';

type Tone = 'green' | 'yellow' | 'red' | 'blue' | 'violet' | 'gray';

export function Badge({ tone = 'gray', dot = false, children }: { tone?: Tone; dot?: boolean; children: ComponentChildren }) {
  return (
    <span class={clsx(s.badge, s[tone])}>
      {dot && <span class={s.dot} />}
      {children}
    </span>
  );
}
