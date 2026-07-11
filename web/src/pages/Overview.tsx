import { Activity, ArrowDownUp, KeyRound, Cpu, Users, DollarSign } from 'lucide-preact';
import { PageHeader, StatCard, Card, LineChart, Badge } from '../ui';
import s from './pages.module.css';

// P7.1 scaffold: the Overview layout and the clickable, deep-linking stat cards from the brief,
// rendered with placeholder zeros against the real design system. P7.2 wires these to the
// /admin/overview aggregate and the four live 7-day charts. Its job here is to prove the
// foundation — tokens, glass, kit, charts, theming — end to end.
export function Overview() {
  const spark = [4, 6, 5, 8, 7, 11, 9];

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle="Real-time gateway telemetry"
        actions={<Badge tone="violet" dot>P7.1 · foundation</Badge>}
      />

      <div class={`${s.grid} ${s.cols4}`}>
        <StatCard label="Total usage"   value="0"    icon={<Activity size={14} />}    sub="requests to date" href="/analytics" />
        <StatCard label="Input tokens"  value="0"    icon={<ArrowDownUp size={14} />} sub="last 7 days"       href="/analytics" />
        <StatCard label="Output tokens" value="0"    icon={<ArrowDownUp size={14} />} sub="last 7 days"       href="/analytics" />
        <StatCard label="Total cost"    value="$0"   icon={<DollarSign size={14} />}  sub="to date"           href="/analytics" />
        <StatCard label="Active keys"   value="0"    icon={<KeyRound size={14} />}    sub="across pools"      href="/nexus" />
        <StatCard label="Active models" value="0"    icon={<Cpu size={14} />}         sub="in the registry"  href="/models" />
        <StatCard label="Active teams"  value="0"    icon={<Users size={14} />}       sub="with access keys" href="/teams" />
        <StatCard label="Status"        value="Live" icon={<Activity size={14} />}    sub="all systems"      href="/security" />
      </div>

      <div class={`${s.grid} ${s.cols2} ${s.section}`}>
        <Card heading="Tokens · last 7 days" class={s.chartCard}>
          <div class={s.chartHead}><span class={s.chartBig}>0</span></div>
          <LineChart data={spark} height={130} ariaLabel="Tokens over the last 7 days" />
        </Card>
        <Card heading="Cost · last 7 days" class={s.chartCard}>
          <div class={s.chartHead}><span class={s.chartBig}>$0</span></div>
          <LineChart data={spark} height={130} ariaLabel="Cost over the last 7 days" />
        </Card>
      </div>
    </>
  );
}
