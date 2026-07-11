import { useLocation } from 'preact-iso';
import { clsx } from 'clsx';
import { SECTIONS, sectionByPath, type Section } from '../nav';
import s from './shell.module.css';

function NavLink({ section, activeId }: { section: Section; activeId?: string }) {
  const Icon = section.icon;
  return (
    <a
      href={section.path}
      class={clsx(s.navItem, activeId === section.id && s.navActive)}
      aria-current={activeId === section.id ? 'page' : undefined}
    >
      <Icon size={17} />
      <span>{section.label}</span>
    </a>
  );
}

export function Sidebar() {
  const { path } = useLocation();
  const activeId = sectionByPath(path)?.id;
  const workspace = SECTIONS.filter((x) => x.group === 'workspace');
  const system = SECTIONS.filter((x) => x.group === 'system');

  return (
    <aside class={s.sidebar}>
      <a href="/" class={s.brand} aria-label="Alayra Nexus — Overview">
        <img class={s.brandMark} src="/logo.svg" width="26" height="26" alt="" />
        <span>
          <div class={s.brandText}>Alayra Nexus</div>
          <div class={s.brandBy}>by Alayra Systems</div>
        </span>
      </a>

      <nav class={s.navGroup} aria-label="Primary">
        {workspace.map((sec) => <NavLink key={sec.id} section={sec} activeId={activeId} />)}
      </nav>

      <div class={s.navDivider} />

      <nav class={s.navGroup} aria-label="System">
        {system.map((sec) => <NavLink key={sec.id} section={sec} activeId={activeId} />)}
      </nav>

      <div class={s.navSpacer} />
      <div class={s.navFoot}>Alayra Nexus™ · v1.2.0</div>
    </aside>
  );
}
