import { Cpu, Eye, Wrench } from 'lucide-preact';
import { PageHeader, StatCard, Card, Badge, Spinner, Button, Table, type Column } from '../ui';
import { useApi } from '../hooks/useApi';
import { compactNumber, currency } from '../lib/format';
import type { ModelsResponse, AiModel } from '../api';
import s from './pages.module.css';

const tierTone: Record<string, 'violet' | 'blue' | 'gray'> = { premium: 'violet', standard: 'blue', fast: 'gray' };
const statusTone: Record<string, 'green' | 'yellow' | 'gray'> = { active: 'green', paused: 'yellow', retired: 'gray' };

// How a model is priced, stated per modality so a non-token model reads honestly (Phase 6.3
// billing surfaced). Token models show input/output per 1M; image/speech/transcription models show
// their own unit price; a model with no price set reads as unpriced rather than "$0".
function pricing(m: AiModel): string {
  const parts: string[] = [];
  if (m.inputCostPer1M || m.outputCostPer1M) parts.push(`${currency(m.inputCostPer1M)} / ${currency(m.outputCostPer1M)} per 1M`);
  if (m.imagePrice)            parts.push(`${currency(m.imagePrice)} / image`);
  if (m.speechPricePer1MChars) parts.push(`${currency(m.speechPricePer1MChars)} / 1M chars`);
  if (m.transcriptionPrice)    parts.push(`${currency(m.transcriptionPrice)} / file`);
  return parts.length ? parts.join(' · ') : 'Unpriced';
}

const columns: Column<AiModel>[] = [
  {
    key: 'displayName', label: 'Model',
    render: (m) => (
      <div class={s.modelCell}>
        <span class={s.modelName}>{m.displayName || m.modelString}</span>
        {m.displayName && m.displayName !== m.modelString && <span class={s.modelId}>{m.modelString}</span>}
      </div>
    ),
  },
  { key: 'provider', label: 'Provider', render: (m) => <Badge tone="gray">{m.provider}</Badge> },
  { key: 'tier',     label: 'Tier',     render: (m) => <Badge tone={tierTone[m.tier] ?? 'gray'}>{m.tier}</Badge> },
  {
    key: 'capabilities', label: 'Capabilities',
    render: (m) => (
      <div class={s.caps}>
        {m.capabilities.map((c) => <span key={c} class={s.cap}>{c}</span>)}
        {m.hasVision && <span class={s.capIcon} title="Vision"><Eye size={12} /></span>}
        {m.hasToolCalling && <span class={s.capIcon} title="Tool calling"><Wrench size={12} /></span>}
      </div>
    ),
  },
  { key: 'pricing',       label: 'Pricing',  render: (m) => <span class={s.modelPrice}>{pricing(m)}</span> },
  { key: 'contextWindow', label: 'Context',  align: 'right', render: (m) => (m.contextWindow ? compactNumber(m.contextWindow) : '—') },
  { key: 'status',        label: 'Status',   render: (m) => <Badge tone={statusTone[m.status] ?? 'gray'}>{m.status}</Badge> },
];

// P7.3: the redesigned Models section — the routing registry with capabilities and honest
// per-modality pricing, so an operator can see exactly what each model can do and what it costs.
export function Models() {
  const { data, loading, error, reload } = useApi<ModelsResponse>('/admin/models');

  if (loading && !data) {
    return (
      <>
        <PageHeader title="Models" subtitle="The routing registry" />
        <div class={s.centered}><Spinner /> <span>Loading models…</span></div>
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        <PageHeader title="Models" subtitle="The routing registry" />
        <div class={s.errBody}>
          <Cpu size={22} class={s.errIcon} />
          <p>Couldn’t load models{error ? ` — ${error}` : ''}.</p>
          <Button size="sm" onClick={reload}>Retry</Button>
        </div>
      </>
    );
  }

  const models = data.models;
  const count = (tier: string) => models.filter((m) => m.tier === tier).length;

  return (
    <>
      <PageHeader title="Models" subtitle="The routing registry" />

      <div class={`${s.grid} ${s.cols4}`}>
        <StatCard label="Total models" value={compactNumber(models.length)} icon={<Cpu size={14} />} sub="in the registry" />
        <StatCard label="Premium"      value={compactNumber(count('premium'))}  sub="tried first" />
        <StatCard label="Standard"     value={compactNumber(count('standard'))} sub="mid tier" />
        <StatCard label="Fast"         value={compactNumber(count('fast'))}     sub="fallback tier" />
      </div>

      <div class={s.section}>
        <Card heading="Model registry">
          <Table columns={columns} rows={models} rowKey={(m) => m.id} empty="No models in the registry yet" />
        </Card>
      </div>
    </>
  );
}
