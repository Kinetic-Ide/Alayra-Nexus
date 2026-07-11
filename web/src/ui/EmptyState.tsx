import type { ComponentChildren } from 'preact';
import s from './ui.module.css';

export function EmptyState({ icon, children }: { icon?: ComponentChildren; children: ComponentChildren }) {
  return (
    <div class={s.empty}>
      {icon && <div class={s.emptyIcon}>{icon}</div>}
      <p>{children}</p>
    </div>
  );
}
