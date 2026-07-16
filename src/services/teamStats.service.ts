/*
 * Copyright (c) 2026 Alayra Systems Pvt. Limited (Pakistan)
 * & Alayra Systems LLC (USA).
 *
 * Alayra Nexus™ is a trademark of Alayra Systems. Use of the name or logo
 * is not granted by the software license below.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * A copy of the License is in the LICENSE file at the repository root,
 * or at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF
 * ANY KIND, either express or implied. See the License for details.
 */

// Per-team analytics (Phase 7.10): the read behind the Teams → Team Stats tab. The global Analytics
// page answers "how is the gateway doing"; this answers the same questions for one team, plus the one
// thing only a team has — a per-key ("member") breakdown, so an operator can see which key inside a
// team is spending the budget. Every figure is a Postgres aggregate over TokenUsage joined to the
// team's keys, so the result stays small no matter how many rows the window holds.
//
// Two windows coexist on purpose: `period` (today/7d/30d/90d) is the *viewing* window the operator
// picks; `budget` reports the team's *current budget window* spend vs cap (daily/weekly/monthly),
// read the same way admission reads it, so the number here matches what the gateway actually enforces.

import { prisma } from '../lib/prisma';
import { dateRange, fillSeries } from '../lib/series';
import { getCurrentSpend, type BudgetPeriod } from './budget.service';

export type TeamStatsPeriod = 'today' | '7d' | '30d' | '90d';

function sinceFor(period: TeamStatsPeriod): Date {
  if (period === 'today') return new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z');
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  return new Date(Date.now() - days * 86_400_000);
}

const num = (v: number | null | undefined): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export interface TeamStatsMember {
  id: string; name: string; maskedKey: string;
  requests: number; tokens: number; usd: number; lastUsedAt: string | null;
}

export interface TeamStats {
  team: {
    id: string; name: string; status: string;
    assignedTier: string | null; overBudgetAction: string;
    budgetUsd: number | null; budgetPeriod: string;
    /** Spend in the *current budget window* — the figure admission enforces against the cap. */
    budgetSpendUsd: number;
    keyCount: number;
  };
  period: TeamStatsPeriod;
  since:  string;
  until:  string;
  totals: {
    requests: number; successes: number; errors: number; successRate: number;
    totalTokens: number; estimatedUsd: number; avgLatencyMs: number;
  };
  byDay:    { date: string; requests: number; usd: number; tokens: number }[];
  byModel:  { model: string; requests: number; tokens: number; usd: number }[];
  members:  TeamStatsMember[];
}

type TotalsRow = {
  requests: number; successes: number;
  totalTokens: number | null; estimatedUsd: number | null; avgLatencyMs: number | null;
};
type DayRow    = { day: Date; requests: number; usd: number | null; tokens: number | null };
type ModelRow  = { model: string; requests: number; tokens: number | null; usd: number | null };
type MemberRow = { id: string; name: string; maskedKey: string; requests: number; tokens: number | null; usd: number | null; lastUsedAt: Date | null };

const TOP_MODELS = 8;

/** Per-team stats for the viewing window, or null when the team does not exist. */
export async function getTeamStats(teamId: string, period: TeamStatsPeriod = '7d'): Promise<TeamStats | null> {
  const team = await prisma.team.findUnique({
    where:   { id: teamId },
    include: { _count: { select: { teamKeys: true } } },
  });
  if (!team) return null;

  const since = sinceFor(period);
  const until = new Date();

  const [totalsRows, dayRows, modelRows, memberRows, budgetSpendUsd] = await Promise.all([
    prisma.$queryRaw<TotalsRow[]>`
      SELECT COUNT(*)::int                                            AS requests,
             COUNT(*) FILTER (WHERE tu."outcome" = 'success')::int    AS successes,
             SUM(tu."totalTokens")::float8                            AS "totalTokens",
             SUM(tu."estimatedUsd")::float8                           AS "estimatedUsd",
             AVG(tu."latencyMs") FILTER (WHERE tu."latencyMs" > 0)::float8 AS "avgLatencyMs"
      FROM "TokenUsage" tu
      JOIN "NexusTeamKey" tk ON tk."id" = tu."nexusTeamKeyId"
      WHERE tk."teamId" = ${teamId} AND tu."createdAt" >= ${since} AND tu."createdAt" <= ${until}`,

    prisma.$queryRaw<DayRow[]>`
      SELECT date_trunc('day', tu."createdAt")   AS day,
             COUNT(*)::int                       AS requests,
             SUM(tu."estimatedUsd")::float8      AS usd,
             SUM(tu."totalTokens")::float8       AS tokens
      FROM "TokenUsage" tu
      JOIN "NexusTeamKey" tk ON tk."id" = tu."nexusTeamKeyId"
      WHERE tk."teamId" = ${teamId} AND tu."createdAt" >= ${since} AND tu."createdAt" <= ${until}
      GROUP BY day ORDER BY day ASC`,

    prisma.$queryRaw<ModelRow[]>`
      SELECT tu."modelName"               AS model,
             COUNT(*)::int                AS requests,
             SUM(tu."totalTokens")::float8 AS tokens,
             SUM(tu."estimatedUsd")::float8 AS usd
      FROM "TokenUsage" tu
      JOIN "NexusTeamKey" tk ON tk."id" = tu."nexusTeamKeyId"
      WHERE tk."teamId" = ${teamId} AND tu."createdAt" >= ${since} AND tu."createdAt" <= ${until}
        AND tu."modelName" <> ''
      GROUP BY tu."modelName" ORDER BY requests DESC LIMIT ${TOP_MODELS}`,

    // Member breakdown. A LEFT JOIN from the team's keys so an idle key still appears (with zeros)
    // rather than vanishing — an operator wants to see every member, not only the busy ones.
    prisma.$queryRaw<MemberRow[]>`
      SELECT tk."id"                                    AS id,
             tk."name"                                  AS name,
             tk."maskedKey"                             AS "maskedKey",
             COUNT(tu."id")::int                        AS requests,
             COALESCE(SUM(tu."totalTokens"), 0)::float8 AS tokens,
             COALESCE(SUM(tu."estimatedUsd"), 0)::float8 AS usd,
             MAX(tu."createdAt")                        AS "lastUsedAt"
      FROM "NexusTeamKey" tk
      LEFT JOIN "TokenUsage" tu
        ON tu."nexusTeamKeyId" = tk."id" AND tu."createdAt" >= ${since} AND tu."createdAt" <= ${until}
      WHERE tk."teamId" = ${teamId}
      GROUP BY tk."id", tk."name", tk."maskedKey"
      ORDER BY usd DESC, requests DESC`,

    getCurrentSpend(teamId, team.budgetPeriod as BudgetPeriod),
  ]);

  const t         = totalsRows[0] ?? ({} as TotalsRow);
  const requests  = num(t.requests);
  const successes = num(t.successes);

  const byDay = fillSeries(
    dayRows.map((r) => ({
      date:     new Date(r.day).toISOString().slice(0, 10),
      requests: num(r.requests),
      usd:      num(r.usd),
      tokens:   num(r.tokens),
    })),
    dateRange(since, until),
    (date) => ({ date, requests: 0, usd: 0, tokens: 0 }),
  );

  return {
    team: {
      id:               team.id,
      name:             team.name,
      status:           team.status,
      assignedTier:     team.assignedTier,
      overBudgetAction: team.overBudgetAction,
      budgetUsd:        team.budgetUsd,
      budgetPeriod:     team.budgetPeriod,
      budgetSpendUsd:   num(budgetSpendUsd),
      keyCount:         team._count.teamKeys,
    },
    period,
    since: since.toISOString(),
    until: until.toISOString(),
    totals: {
      requests,
      successes,
      errors:       requests - successes,
      successRate:  requests > 0 ? successes / requests : 0,
      totalTokens:  num(t.totalTokens),
      estimatedUsd: num(t.estimatedUsd),
      avgLatencyMs: Math.round(num(t.avgLatencyMs)),
    },
    byDay,
    byModel: modelRows.map((r) => ({ model: r.model, requests: num(r.requests), tokens: num(r.tokens), usd: num(r.usd) })),
    members: memberRows.map((r) => ({
      id: r.id, name: r.name, maskedKey: r.maskedKey,
      requests: num(r.requests), tokens: num(r.tokens), usd: num(r.usd),
      lastUsedAt: r.lastUsedAt ? new Date(r.lastUsedAt).toISOString() : null,
    })),
  };
}
