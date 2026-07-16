import { useState } from 'preact/hooks';
import { PageHeader, Tabs, type TabItem } from '../ui';
import { TeamsList } from './teams/TeamsList';
import { TeamKeys } from './teams/TeamKeys';
import { TeamStats } from './teams/TeamStats';
import s from './pages.module.css';

// The Teams section. A team is a group that carries its own budget cap, a preferred routing tier
// (honoured on the request path since P7.8), a configurable over-budget action (P7.10), and the scoped
// access keys its members present. Three sub-tabs (P7.10): Overview manages the teams themselves;
// Access keys manages the credentials assigned to them; Team stats drills into one team's spend and
// per-member usage. Every endpoint has existed since Phase 5 (Team stats since P7.10).
const TABS: TabItem[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'keys',     label: 'Access keys' },
  { id: 'stats',    label: 'Team stats' },
];

export function Teams() {
  const [tab, setTab] = useState('overview');

  return (
    <>
      <PageHeader title="Teams" subtitle="Groups with their own budget, routing tier, and scoped access keys" />
      <div class={s.setTabs}>
        <Tabs items={TABS} active={tab} onChange={setTab} />
      </div>
      {tab === 'overview' ? <TeamsList /> : tab === 'keys' ? <TeamKeys /> : <TeamStats />}
    </>
  );
}
