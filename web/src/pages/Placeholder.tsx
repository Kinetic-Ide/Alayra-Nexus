import { Construction } from 'lucide-preact';
import type { Section } from '../nav';
import { PageHeader, Card } from '../ui';
import s from './pages.module.css';

const PHASE: Record<string, string> = {
  nexus: 'P7.3', models: 'P7.3', connect: 'P7.3', analytics: 'P7.4',
  security: 'P7.5', logs: 'P7.5', settings: 'P7.6', caching: 'P7.6',
  teams: 'P7.8', enterprise: 'P7.8', admin: 'P7.9',
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
