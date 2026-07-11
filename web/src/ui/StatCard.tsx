import { clsx } from 'clsx';
import type { ComponentChildren } from 'preact';
import { ArrowUpRight } from 'lucide-preact';
import s from './ui.module.css';

interface Props {
  label: string;
  value: ComponentChildren;
  sub?: ComponentChildren;
  icon?: ComponentChildren;
  /** Making a card clickable deep-links it to its section (the Overview brief). */
  href?: string;
  onClick?: () => void;
}

export function StatCard({ label, value, sub, icon, href, onClick }: Props) {
  const clickable = !!(href || onClick);
  const body = (
    <>
      <div class={s.statLabel}>{icon && <span class={s.statIcon}>{icon}</span>}{label}</div>
      <div class={s.statValue}>{value}</div>
      {sub && <div class={s.statSub}>{sub}</div>}
      {clickable && <span class={s.statArrow}><ArrowUpRight size={15} /></span>}
    </>
  );
  const cls = clsx(s.stat, clickable && s.statClickable);
  if (href) return <a class={cls} href={href}>{body}</a>;
  if (onClick) return <button type="button" class={cls} onClick={onClick}>{body}</button>;
  return <div class={cls}>{body}</div>;
}
