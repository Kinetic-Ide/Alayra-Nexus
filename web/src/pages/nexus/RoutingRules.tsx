import { Card, Badge } from '../../ui';
import type { NexusOverview } from '../../api';
import s from '../pages.module.css';

// An honest description of how routing actually behaves (audited P7.3). It states the real
// algorithm the gateway runs — nothing aspirational — and is explicit that per-team tier
// assignment is captured but not yet enforced, so the operator is never misled.
export function RoutingRules({ costWeight }: { costWeight: NexusOverview['routing']['costWeight'] }) {
  const costPct = Math.round(costWeight * 100);
  const bias =
    costWeight <= 0.05 ? 'Speed — first available key wins' :
    costWeight >= 0.95 ? 'Cost — cheapest eligible model wins' :
    `Balanced — ${costPct}% weight on cost`;

  return (
    <Card heading="How requests are routed">
      <ol class={s.rules}>
        <li><b>Tier order.</b> The gateway tries pools best-first: <b>premium → standard → fast</b>, dropping to the next tier only when the one above has no key with headroom.</li>
        <li><b>Within a tier.</b> Models are ordered by priority, then by price according to the cost weight below.</li>
        <li><b>Session affinity.</b> A continuing conversation sticks to the key that last served it, so the provider’s prompt cache keeps paying off.</li>
        <li><b>Team isolation (BYOK).</b> A team’s own keys are tried first; the shared pool is used only if that team permits fall-back — otherwise it stays hard-isolated.</li>
      </ol>

      <div class={s.rulesMeta}>
        <span class={s.rulesMetaLabel}>Cost-vs-speed weight</span>
        <Badge tone="violet">{bias}</Badge>
        <span class={s.rulesMetaHint}>Adjust in Settings → Routing.</span>
      </div>

      <div class={s.rulesNote}>
        <b>Note.</b> A team’s assigned tier is recorded but not yet enforced by routing — every team
        currently routes across all tiers. Per-team tier pinning arrives with the Teams update.
      </div>
    </Card>
  );
}
