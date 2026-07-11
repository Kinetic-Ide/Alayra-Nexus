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

// ── Operator notifications: the pure core (Phase 6.4) ─────────────────────────
// Alerts an operator when the gateway is degrading or under attack, so they do not
// have to watch a dashboard to find out. This module is the decision half — the event
// catalogue, the config shape and its normalization, the human-readable message per
// event, and the coalescing key — all pure and unit-tested. The side effects (reading
// config, sending email/webhooks, the once-per-window guard in Redis) live in
// notifications.service. The delivery discipline is fire-and-forget: an email outage
// must never slow or fail a proxied request, so nothing here is ever on the request path.

/** The events an operator can be alerted on. Each is a rare failure or security signal
 *  tapped in the service layer, never on the per-request success path. Threshold events
 *  that must be detected on the request path (tier-exhausted 503, budget %) arrive in a
 *  follow-up so the hot path is instrumented deliberately rather than piecemeal. */
export const NOTIFY_EVENTS = ['keyBanned', 'breakerOpened', 'adminLockout'] as const;
export type NotifyEventType = (typeof NOTIFY_EVENTS)[number];

/** A fully-formed alert, ready to coalesce and deliver. `dedupeKey` identifies the
 *  logical occurrence so a flapping source produces one message per window, not a flood. */
export interface NotifyMessage {
  type:      NotifyEventType;
  dedupeKey: string;
  title:     string;
  body:      string;
}

export interface NotificationConfig {
  enabled:      boolean;                        // master switch — off by default
  resendApiKey: string;                         // ciphertext at rest ('' = unset); never plaintext
  from:         string;                         // verified Resend sender, e.g. alerts@yourdomain
  to:           string[];                       // recipient addresses
  webhookUrl:   string;                         // generic POST target (Slack/Discord/PagerDuty)
  events:       Record<NotifyEventType, boolean>;
  windowSeconds: number;                        // coalescing window
}

// A minute is the floor for the coalescing window: shorter and a genuinely flapping key
// would still spam. An hour is the default — long enough to be quiet, short enough that a
// recurring problem re-alerts within a shift.
export const MIN_WINDOW_SECONDS = 60;
export const DEFAULT_WINDOW_SECONDS = 3600;

export const DEFAULT_NOTIFICATION_CONFIG: NotificationConfig = {
  enabled:      false,
  resendApiKey: '',
  from:         '',
  to:           [],
  webhookUrl:   '',
  events:       { keyBanned: true, breakerOpened: true, adminLockout: true },
  windowSeconds: DEFAULT_WINDOW_SECONDS,
};

function asString(v: unknown): string { return typeof v === 'string' ? v : ''; }

/** Coerce a stored/posted blob into a well-formed config. The setting is schemaless JSON,
 *  so a value written by an older version (or a partial PUT) can be missing fields; every
 *  one is defaulted, every event flag is present, and the window is clamped to a sane floor. */
export function normalizeNotificationConfig(raw: unknown): NotificationConfig {
  const r = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {};
  const eventsRaw = (r.events && typeof r.events === 'object') ? r.events as Record<string, unknown> : {};
  const events = {} as Record<NotifyEventType, boolean>;
  for (const e of NOTIFY_EVENTS) {
    // Default a missing flag to on, so upgrading to a new event type does not require a
    // re-save to start receiving it — the master switch still gates everything.
    events[e] = eventsRaw[e] === undefined ? true : eventsRaw[e] === true;
  }
  const to = Array.isArray(r.to)
    ? r.to.map(asString).map((s) => s.trim()).filter(Boolean)
    : [];
  const window = typeof r.windowSeconds === 'number' && Number.isFinite(r.windowSeconds)
    ? Math.max(MIN_WINDOW_SECONDS, Math.floor(r.windowSeconds))
    : DEFAULT_WINDOW_SECONDS;

  return {
    enabled:      r.enabled === true,
    resendApiKey: asString(r.resendApiKey),
    from:         asString(r.from).trim(),
    to,
    webhookUrl:   asString(r.webhookUrl).trim(),
    events,
    windowSeconds: window,
  };
}

// ── Message builders. Pure; each yields a stable dedupeKey scoped to the occurrence. ──

export function keyBannedMessage(provider: string, maskedKey: string): NotifyMessage {
  return {
    type: 'keyBanned',
    dedupeKey: `keyBanned:${provider}:${maskedKey}`,
    title: `Alayra Nexus: a ${provider} key was auto-banned`,
    body: `A provider key for "${provider}" (${maskedKey}) was automatically banned after repeated authentication failures. That credential is dead — traffic is silently degrading until you replace it in the Pools tab.`,
  };
}

export function breakerOpenedMessage(provider: string, maskedKey: string, cooldownSeconds: number): NotifyMessage {
  return {
    type: 'breakerOpened',
    dedupeKey: `breakerOpened:${provider}:${maskedKey}`,
    title: `Alayra Nexus: circuit breaker opened for ${provider}`,
    body: `The circuit breaker opened for a "${provider}" key (${maskedKey}) after repeated server-side failures. It will be skipped for about ${cooldownSeconds}s while it cools down. If this recurs, the upstream is likely having an outage.`,
  };
}

export function adminLockoutMessage(source: string): NotifyMessage {
  return {
    type: 'adminLockout',
    dedupeKey: `adminLockout:${source}`,
    title: 'Alayra Nexus: admin login locked out',
    body: `Admin sign-in was locked out after repeated failed attempts from "${source}". If that was not you, someone is trying to guess the admin password.`,
  };
}

/** Redis key for the once-per-window send guard. */
export function coalesceRedisKey(dedupeKey: string): string {
  return `nexus:notify:sent:${dedupeKey}`;
}
