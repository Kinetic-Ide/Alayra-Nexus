import { useState } from 'preact/hooks';
import { ChevronRight } from 'lucide-preact';
import { Card, EmptyState } from '../../ui';
import { compactNumber, currency, relativeTime } from '../../lib/format';
import type { TeamStatsMember } from '../../api';
import s from '../pages.module.css';
import t from './teams.module.css';

// The per-member breakdown inside one team (P7.10) — the answer to "who is spending the budget".
//
// A "member" here is one of the team's access keys. The gateway has no separate user identity: a key
// is what a person or service presents, so a key *is* the seat. Calling it a member without inventing
// a user table keeps the number honest, and an idle key is still listed (with zeros) rather than
// dropped, because "nobody used this key" is exactly what an operator needs to see.
//
// Share is a proportion of the team's spend in this window, never an allocation: the budget cap lives
// on the team, and no per-member cap exists to report.

export function TeamMembers({ members, totalUsd }: { members: TeamStatsMember[]; totalUsd: number }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <Card heading="Members">
      <p class={s.setDesc}>
        Every access key in this team, and what it spent in this window. Select one to see its detail.
      </p>

      {members.length === 0 ? (
        <EmptyState>No access keys in this team yet. Create one in the Access keys tab.</EmptyState>
      ) : (
        <ul class={t.memberList}>
          {members.map((m) => {
            const open  = openId === m.id;
            const share = totalUsd > 0 ? m.usd / totalUsd : 0;
            // Cost per request is only meaningful once something ran.
            const perReq = m.requests > 0 ? m.usd / m.requests : 0;
            return (
              <li key={m.id} class={t.memberItem}>
                <button
                  class={t.memberRow}
                  onClick={() => setOpenId(open ? null : m.id)}
                  aria-expanded={open}
                  aria-label={`${m.name} — ${currency(m.usd)} spent`}
                >
                  <ChevronRight size={14} class={open ? t.chevOpen : t.chev} />
                  <span class={t.memberName}>{m.name}</span>
                  <code class={s.tokenMask}>{m.maskedKey}</code>
                  <span class={t.shareBar} title={`${(share * 100).toFixed(1)}% of team spend`}>
                    <span class={t.shareFill} style={{ width: `${Math.round(share * 100)}%` }} />
                  </span>
                  <span class={`${t.memberUsd} ${m.requests === 0 ? t.memberIdle : ''}`}>
                    {m.requests === 0 ? 'idle' : currency(m.usd)}
                  </span>
                </button>

                {open && (
                  <div class={t.memberDetail}>
                    <div class={t.factGrid}>
                      <span class={t.fact}>
                        <span class={t.factLabel}>Spend</span>
                        <span class={t.factValue}>{currency(m.usd)}</span>
                      </span>
                      <span class={t.fact}>
                        <span class={t.factLabel}>Share of team</span>
                        <span class={t.factValue}>{totalUsd > 0 ? `${(share * 100).toFixed(1)}%` : '—'}</span>
                      </span>
                      <span class={t.fact}>
                        <span class={t.factLabel}>Requests</span>
                        <span class={t.factValue}>{compactNumber(m.requests)}</span>
                      </span>
                      <span class={t.fact}>
                        <span class={t.factLabel}>Tokens</span>
                        <span class={t.factValue}>{compactNumber(m.tokens)}</span>
                      </span>
                      <span class={t.fact}>
                        <span class={t.factLabel}>Cost / request</span>
                        <span class={t.factValue}>{m.requests > 0 ? currency(perReq) : '—'}</span>
                      </span>
                      <span class={t.fact}>
                        <span class={t.factLabel}>Last active</span>
                        <span class={t.factValue}>{m.lastUsedAt ? relativeTime(m.lastUsedAt) : 'never'}</span>
                      </span>
                    </div>
                    <p class={t.detailNote}>
                      The budget cap belongs to the team, so this key has no separate allowance — the
                      share above is how much of the team’s spend it accounts for in this window.
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
