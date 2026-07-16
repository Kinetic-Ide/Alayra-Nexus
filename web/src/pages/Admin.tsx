import { useState } from 'preact/hooks';
import { PageHeader, Tabs, type TabItem } from '../ui';
import { People } from './admin/People';
import { MyAccount } from './admin/MyAccount';
import s from './pages.module.css';

// The Admin section (Phase 7.13a) — a Placeholder from the day the shell was built, because there
// was nothing to put in it: the gateway had no users. One shared ADMIN_PASSWORD in an environment
// variable authenticated everyone, so nobody could be added or removed, and the audit trail could
// only ever say "someone with the password".
//
// Two tabs. People is owner-managed; My account is each person's own.

const TABS: TabItem[] = [
  { id: 'people', label: 'People' },
  { id: 'me',     label: 'My account' },
];

export function Admin() {
  const [tab, setTab] = useState('people');

  return (
    <>
      <PageHeader
        title="Admin"
        subtitle="The people who administer this gateway, and your own account"
      />
      <div class={s.setTabs}>
        <Tabs items={TABS} active={tab} onChange={setTab} />
      </div>
      <div class={s.setPanel}>
        {tab === 'people' ? <People /> : <MyAccount />}
      </div>
    </>
  );
}
