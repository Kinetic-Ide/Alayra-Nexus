import type { ComponentChildren } from 'preact';
import s from './ui.module.css';

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ComponentChildren }) {
  return (
    <div class={s.pageHeader}>
      <div>
        <h1 class={s.pageTitle}>{title}</h1>
        {subtitle && <p class={s.pageSub}>{subtitle}</p>}
      </div>
      {actions && <div>{actions}</div>}
    </div>
  );
}
