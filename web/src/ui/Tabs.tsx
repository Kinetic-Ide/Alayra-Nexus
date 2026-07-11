import { clsx } from 'clsx';
import s from './ui.module.css';

export interface TabItem { id: string; label: string; }

export function Tabs({ items, active, onChange }: { items: TabItem[]; active: string; onChange: (id: string) => void }) {
  return (
    <div class={s.tabs} role="tablist">
      {items.map((t) => (
        <button
          key={t.id}
          role="tab"
          type="button"
          aria-selected={active === t.id}
          class={clsx(s.tab, active === t.id && s.tabActive)}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
