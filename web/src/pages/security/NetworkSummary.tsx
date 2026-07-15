import { ShieldAlert, ShieldCheck, ArrowUpRight } from 'lucide-preact';
import { Card, Badge, Spinner } from '../../ui';
import { useApi } from '../../hooks/useApi';
import type { SsrfConfig } from '../../api';
import s from '../pages.module.css';

// A read-only glance at the network egress policy, so Security tells the whole security story in one
// place. The policy is edited in Settings → Network — there is deliberately one editor for it, and
// this card links there rather than duplicating the controls.
export function NetworkSummary() {
  const { data, loading } = useApi<SsrfConfig>('/admin/settings/ssrf');
  const hosts = data ? data.allowList.length + data.envAllowList.length : 0;

  return (
    <Card heading="Network egress">
      {loading && !data && <div class={s.centered}><Spinner /> <span>Loading…</span></div>}
      {data && (
        <>
          <div class={s.secStatus}>
            {data.allowPrivate
              ? <Badge tone="yellow"><ShieldAlert size={12} /> Private addresses allowed</Badge>
              : <Badge tone="green"><ShieldCheck size={12} /> Private addresses blocked</Badge>}
            <span>{hosts === 0 ? 'Only public addresses are reachable.' : `${hosts} host${hosts === 1 ? '' : 's'} explicitly allow-listed.`}</span>
          </div>
          {data.allowPrivate && (
            <p class={s.fieldWarn}>Private and internal addresses are reachable — a lowered defence. Review this if it wasn’t deliberate.</p>
          )}
          <a class={s.secLink} href="/settings">Manage in Settings → Network <ArrowUpRight size={13} /></a>
        </>
      )}
    </Card>
  );
}
