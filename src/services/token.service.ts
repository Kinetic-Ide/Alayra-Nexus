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

import { prisma }          from '../lib/prisma';
import { randomUUID }      from 'crypto';
import { getModelRegistry } from './model.service';
import { emit }            from './usagePipeline';
import { addSpend, periodKey, type BudgetPeriod } from './budget.service';
import { notificationsArmed, notify } from './notifications.service';
import { budgetThresholdCrossed, budgetThresholdMessage } from '../lib/notify';

type Period = 'today' | '7d' | '30d' | '90d';

function getSince(period: Period): Date {
  if (period === 'today') {
    const d = new Date();
    return new Date(d.toISOString().slice(0, 10) + 'T00:00:00.000Z');
  }
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  return new Date(Date.now() - days * 86400000);
}

function resolveRange(period: Period, customSince?: Date, customUntil?: Date): { since: Date; until: Date } {
  return {
    since: customSince ?? getSince(period),
    until: customUntil ?? new Date(),
  };
}

// Handles both inputPricePer1k (old) and inputCostPer1M (new dashboard format)
function modelCost(m: Record<string, unknown>, input: number, output: number): number {
  const iPer1k = (m.inputPricePer1k  as number | undefined) ?? ((m.inputCostPer1M  as number | undefined) ?? 0) / 1000;
  const oPer1k = (m.outputPricePer1k as number | undefined) ?? ((m.outputCostPer1M as number | undefined) ?? 0) / 1000;
  return (input / 1000) * iPer1k + (output / 1000) * oPer1k;
}

// Per-modality cost (Phase 6.3b/6.3c). A non-token unit is priced from the model's
// per-unit price: images per image, synthesized speech per 1,000,000 characters (the
// unit TTS providers publish). Transcription joins in 6.3d. An unknown or unpriced unit
// costs 0 and never throws — accounting must never break a proxied request.
function unitCost(m: Record<string, unknown>, unit: string, quantity: number): number {
  const q = Math.max(0, quantity);
  if (unit === 'image')         return q * ((m.imagePrice as number | undefined) ?? 0);
  if (unit === 'character')     return (q / 1_000_000) * ((m.speechPricePer1MChars as number | undefined) ?? 0);
  if (unit === 'transcription') return q * ((m.transcriptionPrice as number | undefined) ?? 0);
  return 0;
}

export interface RecordTokenUsageParams {
  sessionId:       string;
  modelId:         string;
  modelName:       string;
  provider:        string;
  inputTokens:     number;
  outputTokens:    number;
  // Per-modality billing (Phase 6.3b). Omitted for token endpoints (defaults to
  // unit "token", quantity 0). An image request sets unit "image" and a quantity;
  // cost is then quantity × the model's per-unit price, not a token calculation.
  unit?:           string;
  quantity?:       number;
  nexusTeamKeyId?: string;
  // Team budget attribution: when set, this request's cost is added to the team's
  // current budget window as soon as it is known.
  teamId?:           string;
  teamBudgetPeriod?: string;
  // The team's spend cap for the window (Phase 6.4b). Threaded through so a threshold
  // crossing (80% / 100%) can be detected the moment this request's cost lands, without
  // a second budget read. null/undefined = no cap, so no threshold alert.
  teamBudgetUsd?:    number | null;
  // A response-cache hit: no provider was called, so it costs $0 and does not
  // consume budget. Still recorded (attributed to the team) so analytics are honest.
  cached?:           boolean;
}

export async function recordTokenUsage(p: RecordTokenUsageParams): Promise<void> {
  const unit     = p.unit ?? 'token';
  const quantity = p.quantity ?? 0;
  let estimatedUsd = 0;
  if (!p.cached) {
    try {
      const registry = await getModelRegistry();
      const m = registry.find(r => r.modelString === p.modelName || r.id === p.modelId) as Record<string, unknown> | undefined;
      if (m) estimatedUsd = unit === 'token'
        ? modelCost(m, p.inputTokens, p.outputTokens)
        : unitCost(m, unit, quantity);
    } catch { /* non-fatal — never block a proxy request */ }
  }

  // Record the request's real cost against the team's budget window (fire-and-
  // forget — budget accounting must never block or fail a proxied request). The new
  // running total addSpend returns lets us alert on an 80%/100% crossing (Phase 6.4b)
  // without a second read; still entirely off the request path.
  if (p.teamId && estimatedUsd > 0) {
    const period = (p.teamBudgetPeriod === 'daily' || p.teamBudgetPeriod === 'weekly' || p.teamBudgetPeriod === 'monthly')
      ? p.teamBudgetPeriod as BudgetPeriod : 'monthly';
    const teamId    = p.teamId;
    const budgetUsd = p.teamBudgetUsd ?? null;
    void addSpend(teamId, period, estimatedUsd)
      .then((newTotal) => {
        if (newTotal == null || budgetUsd == null) return;
        return alertBudgetThreshold(teamId, period, newTotal - estimatedUsd, newTotal, budgetUsd);
      })
      .catch(() => {});
  }

  // Hand off to the async pipeline instead of writing to Postgres inline: the
  // request path never waits on the analytics INSERT, and writes are batched.
  emit({
    id:             randomUUID(),
    sessionId:      p.sessionId,
    modelId:        p.modelId,
    modelName:      p.modelName,
    provider:       p.provider,
    inputTokens:    p.inputTokens,
    outputTokens:   p.outputTokens,
    totalTokens:    p.inputTokens + p.outputTokens,
    unit,
    quantity,
    estimatedUsd,
    nexusTeamKeyId: p.nexusTeamKeyId ?? null,
    createdAt:      new Date(),
  });
}

// Fire-and-forget operator alert (Phase 6.4b) when a team's spend crosses 80% or 100% of its
// budget for the window. The crossing test is pure and the armed check is a cheap cached read,
// so the team-name lookup only runs on the rare request that actually vaults a threshold and
// only when notifications are enabled. Never awaited by recordTokenUsage.
async function alertBudgetThreshold(
  teamId: string, period: BudgetPeriod, previous: number, next: number, budgetUsd: number,
): Promise<void> {
  const pct = budgetThresholdCrossed(previous, next, budgetUsd);
  if (!pct) return;
  if (!(await notificationsArmed('budgetThreshold'))) return;
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { name: true } });
  await notify(budgetThresholdMessage({
    teamId, teamName: team?.name ?? teamId, pct,
    spendUsd: next, budgetUsd, period, windowId: periodKey(period),
  }));
}

export async function getUsageSummary(period: Period = '30d', customSince?: Date, customUntil?: Date) {
  const { since, until } = resolveRange(period, customSince, customUntil);
  const rows  = await prisma.tokenUsage.findMany({ where: { createdAt: { gte: since, lte: until } } });

  const totals = { requests: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedUsd: 0 };
  const byModel:    Record<string, { inputTokens: number; outputTokens: number; tokens: number; usd: number; requests: number }> = {};
  const byProvider: Record<string, { tokens: number; usd: number; requests: number }> = {};
  const dayMap    = new Map<string, { tokens: number; requests: number; usd: number }>();

  for (const r of rows) {
    totals.requests     += 1;
    totals.inputTokens  += r.inputTokens;
    totals.outputTokens += r.outputTokens;
    totals.totalTokens  += r.totalTokens;
    totals.estimatedUsd += r.estimatedUsd;

    byModel[r.modelName] ??= { inputTokens: 0, outputTokens: 0, tokens: 0, usd: 0, requests: 0 };
    byModel[r.modelName].inputTokens  += r.inputTokens;
    byModel[r.modelName].outputTokens += r.outputTokens;
    byModel[r.modelName].tokens       += r.totalTokens;
    byModel[r.modelName].usd          += r.estimatedUsd;
    byModel[r.modelName].requests     += 1;

    byProvider[r.provider] ??= { tokens: 0, usd: 0, requests: 0 };
    byProvider[r.provider].tokens   += r.totalTokens;
    byProvider[r.provider].usd      += r.estimatedUsd;
    byProvider[r.provider].requests += 1;

    const day = r.createdAt.toISOString().slice(0, 10);
    const de  = dayMap.get(day) ?? { tokens: 0, requests: 0, usd: 0 };
    de.tokens   += r.totalTokens;
    de.requests += 1;
    de.usd      += r.estimatedUsd;
    dayMap.set(day, de);
  }

  const byDay = Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => ({ date, ...d }));

  return { period, since: since.toISOString(), totals, byModel, byProvider, byDay };
}

export async function getUsageByTeamKey(period: Period = '30d', customSince?: Date, customUntil?: Date) {
  const { since, until } = resolveRange(period, customSince, customUntil);
  const rows  = await prisma.tokenUsage.findMany({
    where:   { createdAt: { gte: since, lte: until }, nexusTeamKeyId: { not: null } },
    include: { teamKey: { select: { id: true, name: true } } },
  });

  const byKey: Record<string, { name: string; inputTokens: number; outputTokens: number; totalTokens: number; requests: number; estimatedUsd: number }> = {};
  for (const r of rows) {
    if (!r.teamKey) continue;
    const e = byKey[r.teamKey.id] ??= { name: r.teamKey.name, inputTokens: 0, outputTokens: 0, totalTokens: 0, requests: 0, estimatedUsd: 0 };
    e.inputTokens  += r.inputTokens;
    e.outputTokens += r.outputTokens;
    e.totalTokens  += r.totalTokens;
    e.requests     += 1;
    e.estimatedUsd += r.estimatedUsd;
  }

  return Object.entries(byKey)
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.totalTokens - a.totalTokens);
}

export async function getTimeSeriesByTeam(period: Period = '30d', customSince?: Date, customUntil?: Date) {
  const { since, until } = resolveRange(period, customSince, customUntil);
  const rows  = await prisma.tokenUsage.findMany({
    where:   { createdAt: { gte: since, lte: until }, nexusTeamKeyId: { not: null } },
    include: { teamKey: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  });

  const map = new Map<string, { date: string; teamId: string; teamName: string; requests: number; tokens: number }>();
  for (const r of rows) {
    if (!r.teamKey) continue;
    const date = r.createdAt.toISOString().slice(0, 10);
    const key  = `${date}::${r.teamKey.id}`;
    const e    = map.get(key) ?? { date, teamId: r.teamKey.id, teamName: r.teamKey.name, requests: 0, tokens: 0 };
    e.requests += 1;
    e.tokens   += r.totalTokens;
    map.set(key, e);
  }

  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export async function getTimeSeriesByModel(period: Period = '30d', customSince?: Date, customUntil?: Date) {
  const { since, until } = resolveRange(period, customSince, customUntil);
  const rows  = await prisma.tokenUsage.findMany({
    where:   { createdAt: { gte: since, lte: until } },
    orderBy: { createdAt: 'asc' },
    select:  { createdAt: true, modelName: true, totalTokens: true },
  });

  const map = new Map<string, { date: string; model: string; tokens: number }>();
  for (const r of rows) {
    const date = r.createdAt.toISOString().slice(0, 10);
    const key  = `${date}::${r.modelName}`;
    const e    = map.get(key) ?? { date, model: r.modelName, tokens: 0 };
    e.tokens += r.totalTokens;
    map.set(key, e);
  }

  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}
