import { getSetting, setSetting } from './settings.service';
import { compileRules, type GuardrailRule, type CompiledRule } from '../lib/guardrails';

// Live guardrail configuration, resolved from dashboard-editable settings with an
// environment seed. Off by default: a fresh deployment filters nothing until an
// operator explicitly enables it. Settings are Redis-cached in settings.service,
// so reading the config on the request path is a cached lookup.
//
//   GUARDRAILS_ENABLED        — 'true' to activate filtering
//   GUARDRAILS_RULES          — JSON array of GuardrailRule
//   GUARDRAILS_BUFFERED_SAFE  — 'true' to allow buffered output filtering on streams

export const SETTING_ENABLED       = 'GUARDRAILS_ENABLED';
export const SETTING_RULES         = 'GUARDRAILS_RULES';
export const SETTING_BUFFERED_SAFE = 'GUARDRAILS_BUFFERED_SAFE';

export interface GuardrailConfig {
  enabled:      boolean;
  bufferedSafe: boolean;
  rules:        GuardrailRule[];
  compiled:     CompiledRule[];
}

function truthy(v: string | null | undefined): boolean {
  return /^(1|true|yes|on)$/i.test((v ?? '').trim());
}

function parseRules(raw: string | null | undefined): GuardrailRule[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as GuardrailRule[]) : [];
  } catch { return []; }
}

export async function getGuardrailConfig(): Promise<GuardrailConfig> {
  const [enabledS, rulesS, bufferedS] = await Promise.all([
    getSetting(SETTING_ENABLED),
    getSetting(SETTING_RULES),
    getSetting(SETTING_BUFFERED_SAFE),
  ]);

  const enabled      = enabledS === null ? truthy(process.env[SETTING_ENABLED]) : truthy(enabledS);
  const bufferedSafe = bufferedS === null ? truthy(process.env[SETTING_BUFFERED_SAFE]) : truthy(bufferedS);
  const rules        = rulesS === null ? parseRules(process.env[SETTING_RULES]) : parseRules(rulesS);

  return { enabled, bufferedSafe, rules, compiled: compileRules(rules) };
}

export async function getGuardrailConfigForUI(): Promise<{ enabled: boolean; bufferedSafe: boolean; rules: GuardrailRule[] }> {
  const cfg = await getGuardrailConfig();
  return { enabled: cfg.enabled, bufferedSafe: cfg.bufferedSafe, rules: cfg.rules };
}

export async function setGuardrailConfig(enabled: boolean, bufferedSafe: boolean, rules: GuardrailRule[]): Promise<void> {
  await Promise.all([
    setSetting(SETTING_ENABLED, enabled ? 'true' : 'false'),
    setSetting(SETTING_BUFFERED_SAFE, bufferedSafe ? 'true' : 'false'),
    setSetting(SETTING_RULES, JSON.stringify(rules ?? [])),
  ]);
}
