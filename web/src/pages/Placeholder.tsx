import { Construction } from 'lucide-preact';
import type { Section } from '../nav';
import { PageHeader, Card } from '../ui';
import s from './pages.module.css';

const PHASE: Record<string, string> = {
  teams: 'P7.8', enterprise: 'P7.8', admin: 'P7.13',
};

/** Every not-yet-built section renders here — the shell and navigation are real, the content
 *  is a signpost to the phase that fills it. Replaced section-by-section per the plan. */
export function Placeholder({ section }: { section: Section }) {
  return (
    <>
      <PageHeader title={section.label} subtitle={`The ${section.label} workspace`} />
      <Card>
        <div class={s.scaffold}>
          <Construction size={18} />
          <span>This section is built in <code>{PHASE[section.id] ?? 'a later phase'}</code>. The shell, theme, and navigation around it are live now.</span>
        </div>
      </Card>
    </>
  );
}
