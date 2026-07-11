import { clsx } from 'clsx';
import type { ComponentChildren, JSX } from 'preact';
import s from './ui.module.css';

interface Props extends JSX.HTMLAttributes<HTMLDivElement> {
  heading?: string;
  children?: ComponentChildren;
}

/** A glass panel. `heading` renders the small uppercase card title. */
export function Card({ heading, class: cls, children, ...rest }: Props) {
  return (
    <div class={clsx(s.card, cls)} {...rest}>
      {heading && <div class={s.cardTitle}>{heading}</div>}
      {children}
    </div>
  );
}
