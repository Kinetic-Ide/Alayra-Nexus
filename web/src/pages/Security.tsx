import { useState } from 'preact/hooks';
import { PageHeader, Tabs, type TabItem } from '../ui';
import { SigninSecurity } from './security/SigninSecurity';
import { ApiTokens } from './security/ApiTokens';
import { NetworkSummary } from './security/NetworkSummary';
import s from './pages.module.css';

// P7.7: the Security section — the operator's account defences in one place. Two sub-tabs cover the
// concerns that are edited here (the second factor, and API tokens); the network egress policy is
// edited in Settings → Network, so it appears below only as a read-only summary that links there.
// Nothing new was needed from the gateway — every endpoint has existed since Phase 6.
const TABS: TabItem[] = [
  { id: 'signin', label: 'Sign-in security' },
  { id: 'tokens', label: 'API tokens' },
];

export function Security() {
  const [tab, setTab] = useState('signin');

  return (
    <>
      <PageHeader title="Security" subtitle="How you sign in, and the tokens that sign in for you" />
      <div class={s.setTabs}>
        <Tabs items={TABS} active={tab} onChange={setTab} />
      </div>
      <div class={s.setPanel}>
        {tab === 'signin' ? <SigninSecurity /> : <ApiTokens />}
        <div class={s.section}><NetworkSummary /></div>
      </div>
    </>
  );
}
