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

// Audit & compliance pure core (Phase 6.7): the decisions with no I/O — which requests are
// worth recording, the stable action slug a route maps to, the secret-field redaction that
// keeps a credential from ever reaching the log, and the anonymization helpers (IP truncation
// and identifier hashing) the compliance options apply. Unit-tested so the write path and the
// request hook stay thin and boring.

import { createHash } from 'crypto';

/** Retention is capped so a UI selector can offer a bounded set and a bad value can't linger. */
export const MAX_RETENTION_DAYS     = 90;
export const DEFAULT_RETENTION_DAYS = 90;

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** A request that changes state — the only kind the automatic hook records. */
export function isMutation(method: string): boolean {
  return MUTATING.has(method.toUpperCase());
}

// Auth and SSO routes are recorded explicitly by their handlers (with the outcome and role
// the hook cannot see), so the automatic hook skips them to avoid a thinner duplicate.
//
// The 7.13a additions are here for the same reason, and share a trait: none of them has a session
// behind it, so the hook could only ever record them as anonymous. The handler knows who was
// created or recovered; the hook does not.
const AUTO_EXCLUDE = new Set([
  '/admin/login',
  '/admin/logout',
  '/admin/sso/login',
  '/admin/sso/callback',
  '/admin/sso/enabled',
  '/admin/setup/claim',     // records whether the old second factor was carried over
  '/admin/auth/recover',    // no session: the recovery key is the credential
  '/admin/invites/accept',  // records the account that was just created, which the hook cannot see
  '/admin/me/password',     // recorded as auth.password.change, not the hook's `me.password.create`
]);

/**
 * Whether the automatic hook should record this response. Mutations only, excluding the
 * explicitly-handled auth routes, and dropping pure validation noise (400) while keeping
 * security-relevant denials (401/403) and every success.
 */
export function shouldAutoAudit(routeUrl: string, method: string, status: number): boolean {
  if (!isMutation(method)) return false;
  if (AUTO_EXCLUDE.has(routeUrl)) return false;
  if (status === 400) return false;
  return true;
}

const VERB_BY_METHOD: Record<string, string> = {
  POST: 'create', PUT: 'update', PATCH: 'update', DELETE: 'delete', GET: 'read',
};

/**
 * A stable, filterable action slug for a route. Path parameters are dropped, so the same
 * logical action collapses to one slug regardless of id: `DELETE /admin/keys/:id` →
 * `keys.delete`, `POST /admin/keys/:id/ban` → `keys.ban`, `PUT /admin/settings/notifications`
 * → `settings.notifications`.
 */
export function deriveAction(method: string, routeUrl: string): string {
  const segs = routeUrl.split('/').filter((s) => s && s !== 'admin' && !s.startsWith(':'));
  const resource = segs[0] ?? 'admin';
  const sub = segs.slice(1).join('.');
  if (sub) return `${resource}.${sub}`;
  const verb = VERB_BY_METHOD[method.toUpperCase()] ?? method.toLowerCase();
  return `${resource}.${verb}`;
}

// Anything whose key looks like a credential is never written to the audit detail, at any
// depth. Matched case-insensitively as a substring so `clientSecret`, `apiKey`,
// `authorization`, `totpCode`, and `recoveryCodes` are all caught.
const SECRET_KEY = /(pass|secret|token|api[-_]?key|\bkey\b|authorization|credential|code|otp)/i;

/**
 * Shallowly redact an object for safe storage: any key that looks like a secret is replaced
 * with a marker rather than dropped, so the log still shows that a field was set without ever
 * revealing it. Non-object input yields an empty object.
 */
export function redactDetail(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object') return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    out[k] = SECRET_KEY.test(k) ? '[redacted]' : (typeof v === 'object' && v !== null ? '[object]' : v);
  }
  return out;
}

/**
 * Truncate an IP so it can no longer identify a single machine: an IPv4 address loses its
 * last octet (`203.0.113.7` → `203.0.113.0`), an IPv6 address keeps only its network prefix
 * (first four hextets). Standard GDPR-friendly IP masking. Empty input yields null.
 */
export function anonymizeIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const v = ip.trim();
  if (v.includes(':')) {
    const groups = v.split(':').slice(0, 4).join(':');
    return `${groups}::`;
  }
  const octets = v.split('.');
  if (octets.length === 4) return `${octets[0]}.${octets[1]}.${octets[2]}.0`;
  return v; // unknown format — leave as-is rather than guess
}

/** A stable, non-reversible tag for an identifier (e.g. a usage session id) under anonymization. */
export function hashIdentifier(value: string): string {
  return 'anon_' + createHash('sha256').update(value).digest('hex').slice(0, 16);
}

/** Clamp a requested retention window to a whole number of days within [0, MAX]; 0 = keep forever. */
export function clampRetentionDays(value: unknown, max = MAX_RETENTION_DAYS): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(n, max);
}
