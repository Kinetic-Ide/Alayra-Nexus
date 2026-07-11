import type { ComponentChildren } from 'preact';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import s from './shell.module.css';

/** The persistent frame: sidebar + top bar, with the routed page in the scrolling content area. */
export function AppShell({ children }: { children?: ComponentChildren }) {
  return (
    <div class={s.shell}>
      <Sidebar />
      <div class={s.main}>
        <Topbar />
        <main class={s.content}>
          <div class={s.contentInner}>{children}</div>
        </main>
      </div>
    </div>
  );
}
