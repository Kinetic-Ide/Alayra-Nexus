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

// ── Roles (Phase 7.13a) ───────────────────────────────────────────────────────
//
// Three levels, added because two could not express delegation: with only owner and viewer, giving
// someone operational control also gave them the power to remove you.
//
//   viewer — reads. Every mutation is refused.
//   admin  — the day-to-day operator: pools, keys, models, teams, cache, settings, guardrails.
//   owner  — an admin, plus the things that decide who the gateway belongs to: people, invites,
//            SSO, compliance/retention, the master API key, and the reset-wipe.
//
// Pure module, no imports: the guard runs this on every admin request, and it is the kind of logic
// that must be readable and testable on its own rather than buried in a middleware.

export type AdminRole = 'owner' | 'admin' | 'viewer';

/** Least privilege first. Index = authority; compared numerically by `roleAtLeast`. */
const ORDER: AdminRole[] = ['viewer', 'admin', 'owner'];

/**
 * Read a role off a database row, a Redis session, or a claim.
 *
 * Anything unrecognised resolves to OWNER, which looks backwards for a security function and is
 * deliberate: before Phase 6.5 a session was the literal string '1' and every credential was an
 * owner, so an unrecognised value is an old owner credential, not an attacker's guess. Failing
 * closed here would silently demote existing operators on upgrade. Nothing here is a trust
 * decision — the value has already been authenticated by the time it reaches this function.
 *
 * New records never rely on this: `AdminUser.role` and `AdminInvite.role` default to 'viewer' in
 * the schema, so a create path that forgets to set a role fails closed where it matters.
 */
export function asRole(v: string | null | undefined): AdminRole {
  if (v === 'viewer') return 'viewer';
  if (v === 'admin') return 'admin';
  return 'owner';
}

/** True when `role` carries at least the authority of `minimum`. */
export function roleAtLeast(role: AdminRole, minimum: AdminRole): boolean {
  return ORDER.indexOf(role) >= ORDER.indexOf(minimum);
}

/** True when the role may change state — i.e. anything but a viewer. */
export function canWrite(role: AdminRole): boolean {
  return roleAtLeast(role, 'admin');
}

/** How a role is named to a person, and what it means. Single source for UI copy and API docs. */
export const ROLE_LABELS: Record<AdminRole, { label: string; description: string }> = {
  owner: {
    label: 'Owner',
    description: 'Full control, including managing people, single sign-on, compliance, and the master API key.',
  },
  admin: {
    label: 'Admin',
    description: 'Runs the gateway day to day — pools, keys, models, teams, caching and settings — but cannot manage people or the gateway itself.',
  },
  viewer: {
    label: 'Viewer',
    description: 'Read-only. Can see every section but change nothing.',
  },
};
