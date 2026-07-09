import { getSetting, setSetting } from './settings.service';
import { clampCostWeight } from '../lib/routing';

// Live routing configuration, resolved from a dashboard-editable setting with an
// environment seed. Cost-aware routing is OFF by default (weight 0) so existing
// deployments keep their current provider ordering until an operator opts in.
//
//   ROUTING_COST_WEIGHT — 0..1; 0 ignores cost, 1 is strict cheapest-first.

export const SETTING_COST_WEIGHT = 'ROUTING_COST_WEIGHT';

export async function getCostWeight(): Promise<number> {
  const setting = await getSetting(SETTING_COST_WEIGHT);
  const raw = setting === null ? process.env[SETTING_COST_WEIGHT] : setting;
  return clampCostWeight(raw ?? 0);
}

export async function getRoutingConfigForUI(): Promise<{ costWeight: number }> {
  return { costWeight: await getCostWeight() };
}

export async function setCostWeight(weight: number): Promise<void> {
  await setSetting(SETTING_COST_WEIGHT, String(clampCostWeight(weight)));
}
