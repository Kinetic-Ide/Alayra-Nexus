import { useState } from 'preact/hooks';
import { PageHeader, Tabs, type TabItem } from '../ui';
import { TeamsList } from './teams/TeamsList';
import { TeamKeys } from './teams/TeamKeys';
import s from './pages.module.css';

// P7.8: the Teams section — the last parity blocker before cutover. A team is a group that carries its
// own budget cap, a preferred routing tier (now actually honoured on the request path — it used to be
// stored and ignored), and the scoped access keys its members present. Two sub-tabs split the two
// things an operator edits here: the teams themselves, and the keys assigned to them. Every endpoint
// has existed since Phase 5; this page is the console that finally drives them.
const TABS: TabItem[] = [
  { id: 'teams', label: 'Teams' },
  { id: 'keys',  label: 'Access keys' },
];

export function Teams() {
  const [tab, setTab] = useState('teams');

  return (
    <>
      <PageHeader title="Teams" subtitle="Groups with their own budget, routing tier, and scoped access keys" />
      <div class={s.setTabs}>
        <Tabs items={TABS} active={tab} onChange={setTab} />
      </div>
      {tab === 'teams' ? <TeamsList /> : <TeamKeys />}
    </>
  );
}
