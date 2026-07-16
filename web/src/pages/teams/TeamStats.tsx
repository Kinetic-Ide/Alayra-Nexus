import { useState, useEffect } from 'preact/hooks';
import { Activity, CheckCircle2, Coins, DollarSign, Timer } from 'lucide-preact';
import { Card, StatCard, Spinner, Button, Tabs, ChartCard, Input, Select, Badge, EmptyState, type TabItem } from '../../ui';
import { useApi } from '../../hooks/useApi';
import { compactNumber, currency, shortDate } from '../../lib/format';
import type { TeamRow, TeamStats as TeamStatsData, TeamStatsPeriod, TeamPeriod, TeamOverBudgetAction } from '../../api';
import { ByModel } from '../analytics/Breakdowns';
import { TeamMembers } from './TeamMembers';
import s from '../pages.module.css';
import t from './teams.module.css';

// Team stats (P7.10): the Analytics page answers "how is the gateway doing"; this answers it for one
// team, and adds the thing only a team has — a per-member breakdown of who spent the budget.
//
// Two windows coexist on purpose and are labelled as such: the period tabs pick the *viewing* window
// (today/7d/30d/90d), while the budget card reports the team's *current budget window* (its own
// daily/weekly/monthly cycle), read exactly the way admission reads it. Blurring the two would show a
// 7-day spend against a monthly cap and quietly misstate how much budget is left.

const PERIODS: TabItem[] = [
  { id: 'today', label: 'Today' },
  { id: '7d',    label: '7 days' },
  { id: '30d',   label: '30 days' },
  { id: '90d',   label: '90 days' },
];

const PERIOD_WORD: Record<TeamPeriod, string> = { daily: 'day', weekly: 'week', monthly: 'month' };
const ACTION_LABEL: Record<TeamOverBudgetAction, string> = {
  block:     'blocks new requests at the cap',
  notify:    'soft cap — alerts but never blocks',
  downgrade: 'downgrades to the fast tier at the cap',
};

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const ms  = (v: number) => (v > 0 ? `${compactNumber(v)} ms` : '—');

export function TeamStats() {
  const teamsApi = useApi<{ teams: TeamRow[] }>('/admin/teams');
  const [teamId, setTeamId] = useState('');
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState<TeamStatsPeriod>('7d');

  const all   = teamsApi.data?.teams ?? [];
  const q     = search.trim().toLowerCase();
  const shown = q ? all.filter((x) => x.name.toLowerCase().includes(q)) : all;

  // Keep the selection valid: pick the first team once they load, and follow the search when it
  // narrows past the current pick — otherwise the panel would show a team the list no longer offers.
  // `shown` is derived fresh each render, so the effect depends on the fetched data and the search
  // that filters it rather than on the array identity.
  useEffect(() => {
    if (!shown.length) return;
    if (!shown.some((x) => x.id === teamId)) setTeamId(shown[0].id);
  }, [teamsApi.data, search, teamId]);

  if (teamsApi.loading && !teamsApi.data) {
    return <div class={s.centered}><Spinner /> <span>Loading teams…</span></div>;
  }
  if (teamsApi.error && !teamsApi.data) {
    return (
      <div class={s.errBody}>
        <p>Couldn’t load teams — {teamsApi.error}.</p>
        <Button size="sm" onClick={teamsApi.reload}>Retry</Button>
      </div>
    );
  }
  if (!all.length) {
    return <Card><EmptyState>No teams yet. Create one in the Overview tab to see its stats here.</EmptyState></Card>;
  }

  return (
    <>
      <Card heading="Team">
        <div class={t.selectorRow}>
          <Input value={search} placeholder="Search teams…" aria-label="Search teams"
            onInput={(e) => setSearch((e.target as HTMLInputElement).value)} />
          <Select value={teamId} aria-label="Team" onChange={(e) => setTeamId((e.target as HTMLSelectElement).value)}>
            {shown.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </Select>
          <Tabs items={PERIODS} active={period} onChange={(id) => setPeriod(id as TeamStatsPeriod)} />
        </div>
        {!shown.length && <p class={s.setDesc} style={{ marginTop: '10px' }}>No team matches “{search}”.</p>}
      </Card>

      {teamId && <div class={s.section}><TeamStatsPanel teamId={teamId} period={period} /></div>}
    </>
  );
}

// Its own component so the stats fetch is unconditional: mounting only once a team is chosen keeps
// the hook order stable without a "no team" branch inside a hook.
function TeamStatsPanel({ teamId, period }: { teamId: string; period: TeamStatsPeriod }) {
  const { data, loading, error, reload } = useApi<TeamStatsData>(`/admin/teams/${teamId}/stats?period=${period}`);

  if (loading && !data) return <div class={s.centered}><Spinner /> <span>Loading team stats…</span></div>;
  if (error || !data) {
    return (
      <div class={s.errBody}>
        <Activity size={22} class={s.errIcon} />
        <p>Couldn’t load team stats{error ? ` — ${error}` : ''}.</p>
        <Button size="sm" onClick={reload}>Retry</Button>
      </div>
    );
  }

  const { team, totals, byDay, byModel, members } = data;
  const dates = byDay.map((d) => shortDate(d.date));

  return (
    <>
      <div class={`${s.grid} ${s.cols4}`}>
        <StatCard label="Spend"        value={currency(totals.estimatedUsd)}     icon={<DollarSign size={14} />}   tone="var(--green)"  sub="in this window" />
        <StatCard label="Requests"     value={compactNumber(totals.requests)}    icon={<Activity size={14} />}     tone="var(--blue)"   sub="every attempt" />
        <StatCard label="Success rate" value={totals.requests ? pct(totals.successRate) : '—'} icon={<CheckCircle2 size={14} />} tone="var(--green)" sub={`${compactNumber(totals.successes)} served`} />
        <StatCard label="Tokens"       value={compactNumber(totals.totalTokens)} icon={<Coins size={14} />}        tone="var(--accent)" sub="input + output" />
      </div>

      <div class={s.section}><TeamBudget team={team} /></div>

      {totals.requests === 0 ? (
        <Card class={s.section}>
          <EmptyState>No requests from this team in this window. Its keys have sent no traffic yet.</EmptyState>
        </Card>
      ) : (
        <>
          <div class={`${s.grid} ${s.cols2} ${s.section}`}>
            <ChartCard title={`Cost · ${period}`}     big={currency(byDay.reduce((a, d) => a + d.usd, 0))}          data={byDay.map((d) => d.usd)}      labels={dates} format={currency}      accent="var(--green)" ariaLabel="Team cost per day" />
            <ChartCard title={`Requests · ${period}`} big={compactNumber(byDay.reduce((a, d) => a + d.requests, 0))} data={byDay.map((d) => d.requests)} labels={dates} format={compactNumber} accent="var(--blue)"  ariaLabel="Team requests per day" />
          </div>
          <div class={s.section}>
            <StatCard label="Avg latency" value={ms(totals.avgLatencyMs)} icon={<Timer size={14} />} tone="var(--accent)" sub="end to end, this team" />
          </div>
        </>
      )}

      <div class={s.section}><TeamMembers members={members} totalUsd={totals.estimatedUsd} /></div>

      <div class={s.section}><ByModel rows={byModel} /></div>
    </>
  );
}

// Budget health for the team's *own* cycle — the figure the gateway enforces against, not the
// viewing window above.
function TeamBudget({ team }: { team: TeamStatsData['team'] }) {
  const word = PERIOD_WORD[team.budgetPeriod];

  if (team.budgetUsd == null) {
    return (
      <Card heading="Budget">
        <div class={t.budgetTop}>
          <span class={t.budgetFigure}>{currency(team.budgetSpendUsd)}</span>
          <span class={t.budgetSub}>spent this {word} · no cap set</span>
        </div>
        <p class={s.setDesc}>
          This team has no budget cap, so nothing is enforced. Set one on the team in the Overview tab
          to cap or downgrade its spend.
        </p>
      </Card>
    );
  }

  const ratio = team.budgetSpendUsd / team.budgetUsd;
  const over  = ratio >= 1;
  const warn  = !over && ratio >= 0.8;
  const fill  = over ? t.budgetFillOver : warn ? t.budgetFillWarn : '';

  return (
    <Card heading="Budget">
      <div class={t.budgetTop}>
        <span class={t.budgetFigure} style={over ? { color: 'var(--red)' } : undefined}>
          {currency(team.budgetSpendUsd)} / {currency(team.budgetUsd)}
        </span>
        <span class={t.budgetSub}>
          {pct(Math.min(ratio, 1))} of this {word}’s cap · <Badge tone={over ? 'red' : warn ? 'yellow' : 'green'}>{ACTION_LABEL[team.overBudgetAction]}</Badge>
        </span>
      </div>
      <div class={t.budgetTrack}>
        <span class={`${t.budgetFill} ${fill}`} style={{ width: `${Math.min(Math.round(ratio * 100), 100)}%` }} />
      </div>
      <p class={s.setDesc} style={{ marginTop: '10px' }}>
        Spend in the team’s current {word}ly window — the figure the gateway enforces against, which is
        why it can differ from the spend shown above for the selected period.
        {over && team.overBudgetAction === 'block'     && ' This team is over its cap and is being refused until the window resets.'}
        {over && team.overBudgetAction === 'downgrade' && ' This team is over its cap and is being served on the fast tier.'}
        {over && team.overBudgetAction === 'notify'    && ' This team is over its cap, but the soft cap means it keeps being served.'}
      </p>
    </Card>
  );
}
