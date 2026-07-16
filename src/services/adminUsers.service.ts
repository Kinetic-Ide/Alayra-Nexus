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

import { createHash, randomBytes } from 'crypto';
import { prisma } from '../lib/prisma';
import { hashPassword, verifyPassword, generateRecoveryKey, passwordProblem } from '../lib/password';
import { asRole, type AdminRole } from '../lib/roles';

// ── Admin accounts (Phase 7.13a) ──────────────────────────────────────────────
//
// The people who administer the gateway. Before this there were none: one shared ADMIN_PASSWORD
// authenticated everyone, so nobody could be added or removed and the audit trail could only ever
// say "someone with the password".
//
// Two invariants live here, and they are the reason this is a service rather than CRUD in a route:
//
//   1. The last active owner cannot be removed, demoted, or suspended. Every other guarantee in the
//      product depends on there being someone who can still administer it; a gateway with no owner
//      is only recoverable by wiping it.
//   2. Removing a person revokes the API tokens they created. Otherwise offboarding is a fiction:
//      the person is gone from the list and their credentials still open every door.

/** A failure a caller can act on, carrying the status the route should answer with. */
export class AdminUserError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = 'AdminUserError';
  }
}

// sha256, not scrypt, for invite tokens and recovery keys: both are values WE generate at full
// entropy (192 and 128 bits), so they are unguessable regardless, and the fast digest is what makes
// verification an O(1) indexed lookup. Only the human-chosen password gets a slow hash — see
// lib/password.ts, which is the one place that belongs.
function sha256(v: string): string {
  return createHash('sha256').update(v).digest('hex');
}

/** Emails are the sign-in identity, so two accounts must never differ only by case or whitespace. */
export function normalizeEmail(email: string): string {
  return (email ?? '').trim().toLowerCase();
}

function assertEmail(email: string): string {
  const normalized = normalizeEmail(email);
  // Deliberately permissive. Address syntax is far stranger than any regex admits, and the operator
  // typing it knows their own directory better than we do; this only catches an obvious mistake.
  if (!normalized || normalized.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new AdminUserError('Enter a valid email address.');
  }
  return normalized;
}

function assertName(name: string): string {
  const normalized = (name ?? '').trim();
  if (normalized.length < 1 || normalized.length > 80) {
    throw new AdminUserError('Enter a name between 1 and 80 characters.');
  }
  return normalized;
}

// ── Reading ───────────────────────────────────────────────────────────────────

/**
 * What a user looks like to the rest of the product. Note what is absent: `passwordHash`,
 * `totpSecret` and `recoveryKeyHash` are never in this shape, so a route cannot leak one by
 * forgetting to strip it. Whether a second factor is on is a boolean, not the secret behind it.
 */
export interface AdminUserView {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  status: 'active' | 'suspended';
  source: 'local' | 'sso';
  twoFactorEnabled: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}

const VIEW_SELECT = {
  id: true, email: true, name: true, role: true, status: true, source: true,
  totpConfirmedAt: true, lastLoginAt: true, createdAt: true,
} as const;

type ViewRow = {
  id: string; email: string; name: string; role: string; status: string; source: string;
  totpConfirmedAt: Date | null; lastLoginAt: Date | null; createdAt: Date;
};

function toView(row: ViewRow): AdminUserView {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: asRole(row.role),
    status: row.status === 'suspended' ? 'suspended' : 'active',
    source: row.source === 'sso' ? 'sso' : 'local',
    twoFactorEnabled: !!row.totpConfirmedAt,
    lastLoginAt: row.lastLoginAt,
    createdAt: row.createdAt,
  };
}

export async function listUsers(): Promise<AdminUserView[]> {
  const rows = await prisma.adminUser.findMany({ orderBy: { createdAt: 'asc' }, select: VIEW_SELECT });
  return rows.map(toView);
}

export async function getUser(id: string): Promise<AdminUserView | null> {
  const row = await prisma.adminUser.findUnique({ where: { id }, select: VIEW_SELECT });
  return row ? toView(row) : null;
}

export async function findByEmail(email: string) {
  return prisma.adminUser.findUnique({ where: { email: normalizeEmail(email) } });
}

/** How many people can still administer the gateway. The last-owner invariant is counted from this. */
export async function countActiveOwners(): Promise<number> {
  return prisma.adminUser.count({ where: { role: 'owner', status: 'active' } });
}

/** True when nobody has claimed the gateway yet — the condition that opens the first-run flow. */
export async function isUnclaimed(): Promise<boolean> {
  return (await countActiveOwners()) === 0;
}

// ── The last-owner invariant ──────────────────────────────────────────────────

/**
 * Refuse a change that would leave the gateway with no one able to administer it.
 *
 * Checked for removal, demotion, and suspension alike, because all three end in the same place: an
 * owner-less gateway, recoverable only by wiping it. The message names the way out rather than just
 * saying no — an operator who wants to hand over ownership needs to know the order of operations.
 */
async function assertNotLastOwner(user: { id: string; role: string; status: string }, what: string): Promise<void> {
  const isActiveOwner = asRole(user.role) === 'owner' && user.status === 'active';
  if (!isActiveOwner) return;
  if ((await countActiveOwners()) > 1) return;
  throw new AdminUserError(
    `This is the only owner, so ${what} would leave the gateway with nobody able to administer it. Make someone else an owner first.`,
    409,
  );
}

// ── Writing ───────────────────────────────────────────────────────────────────

export interface CreateUserInput {
  email: string;
  name: string;
  role: AdminRole;
  /** Absent for an SSO-provisioned account, which must never be able to sign in with a password. */
  password?: string;
  source?: 'local' | 'sso';
}

/**
 * Create an account. Returns the view plus, for a local account, a recovery key shown exactly once —
 * the escape from a forgotten password, and the reason this returns something the caller must handle
 * rather than just an id.
 */
export async function createUser(input: CreateUserInput): Promise<{ user: AdminUserView; recoveryKey: string | null }> {
  const email = assertEmail(input.email);
  const name = assertName(input.name);
  const source = input.source ?? 'local';

  if (await prisma.adminUser.findUnique({ where: { email } })) {
    throw new AdminUserError('An account with that email already exists.', 409);
  }

  let passwordHash: string | null = null;
  let recoveryKey: string | null = null;
  let recoveryKeyHash: string | null = null;

  if (source === 'local') {
    const problem = passwordProblem(input.password ?? '');
    if (problem) throw new AdminUserError(problem);
    passwordHash = await hashPassword(input.password as string);
    recoveryKey = generateRecoveryKey();
    recoveryKeyHash = sha256(recoveryKey);
  }

  const row = await prisma.adminUser.create({
    data: { email, name, role: input.role, source, passwordHash, recoveryKeyHash },
    select: VIEW_SELECT,
  });
  return { user: toView(row), recoveryKey };
}

export interface UpdateUserInput {
  name?: string;
  role?: AdminRole;
  status?: 'active' | 'suspended';
}

export async function updateUser(id: string, input: UpdateUserInput): Promise<AdminUserView> {
  const user = await prisma.adminUser.findUnique({ where: { id } });
  if (!user) throw new AdminUserError('No such account.', 404);

  const demoting = input.role !== undefined && input.role !== 'owner';
  const suspending = input.status === 'suspended';
  if (demoting) await assertNotLastOwner(user, 'changing their role');
  if (suspending) await assertNotLastOwner(user, 'suspending them');

  const row = await prisma.adminUser.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: assertName(input.name) } : {}),
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    },
    select: VIEW_SELECT,
  });
  return toView(row);
}

/**
 * Remove a person, and with them the credentials they hold.
 *
 * Their API tokens are revoked in the same transaction, BEFORE the delete — the foreign key nulls
 * `createdById` on removal, so afterwards there would be no way to find them. Revoked, not deleted:
 * a revocation is a timestamp, so the audit trail keeps the evidence that the token existed.
 * Recovery codes cascade away with the row; the audit entries they authored do not, by design.
 */
export async function deleteUser(id: string): Promise<{ tokensRevoked: number }> {
  const user = await prisma.adminUser.findUnique({ where: { id } });
  if (!user) throw new AdminUserError('No such account.', 404);
  await assertNotLastOwner(user, 'removing them');

  return prisma.$transaction(async (tx) => {
    const { count } = await tx.adminApiToken.updateMany({
      where: { createdById: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await tx.adminUser.delete({ where: { id } });
    return { tokensRevoked: count };
  });
}

/**
 * Change a password. `currentPassword` is required when a person changes their own — knowing the old
 * one is what proves it is them at the keyboard and not a borrowed, unlocked session.
 *
 * Deliberately not available to an owner for someone else's account: an owner who could set another
 * person's password could sign in as them and act under their name, which would quietly undo the
 * attribution this whole phase exists to create. An owner resets someone else by re-inviting them.
 */
export async function changeOwnPassword(id: string, currentPassword: string, newPassword: string): Promise<void> {
  const user = await prisma.adminUser.findUnique({ where: { id } });
  if (!user) throw new AdminUserError('No such account.', 404);
  if (!user.passwordHash) {
    throw new AdminUserError('This account signs in through your identity provider, so it has no password to change.', 400);
  }
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new AdminUserError('That is not your current password.', 401);
  }
  const problem = passwordProblem(newPassword);
  if (problem) throw new AdminUserError(problem);

  await prisma.adminUser.update({ where: { id }, data: { passwordHash: await hashPassword(newPassword) } });
}

// ── Recovery key (a forgotten password) ───────────────────────────────────────
//
// Distinct from the recovery CODES in adminAuth.service, which substitute for a lost AUTHENTICATOR.
// Different losses need different escapes, and conflating them would mean losing your phone and your
// password were the same event. Lose both, and the documented way back is the reset-wipe.

/** Issue a fresh key, invalidating any previous one. Returned once; only its hash is stored. */
export async function regenerateRecoveryKey(id: string): Promise<string> {
  const user = await prisma.adminUser.findUnique({ where: { id } });
  if (!user) throw new AdminUserError('No such account.', 404);
  if (!user.passwordHash) {
    throw new AdminUserError('This account signs in through your identity provider, so it has no password to recover.', 400);
  }
  const key = generateRecoveryKey();
  await prisma.adminUser.update({ where: { id }, data: { recoveryKeyHash: sha256(key) } });
  return key;
}

/**
 * Spend a recovery key to set a new password, and issue a replacement key.
 *
 * Single use: the old key stops working the moment it succeeds, so a key read over someone's
 * shoulder is worth nothing once used. A wrong email and a wrong key fail identically — the reply
 * must not become an oracle for which addresses have accounts.
 *
 * The second factor is NOT bypassed here: this restores the password only, and a user with TOTP
 * confirmed still has to present a code at sign-in. Recovering a password should not also disarm the
 * defence that exists for the case where the password is already known to someone else.
 */
export async function resetPasswordWithRecoveryKey(
  email: string,
  recoveryKey: string,
  newPassword: string,
): Promise<string> {
  const problem = passwordProblem(newPassword);
  if (problem) throw new AdminUserError(problem);

  const user = await prisma.adminUser.findUnique({ where: { email: normalizeEmail(email) } });
  const normalizedKey = (recoveryKey ?? '').trim().toLowerCase();
  const matches = !!user?.recoveryKeyHash && !!normalizedKey && user.recoveryKeyHash === sha256(normalizedKey);
  if (!user || !matches || user.status !== 'active') {
    throw new AdminUserError('That email and recovery key do not match an active account.', 401);
  }

  const replacement = generateRecoveryKey();
  await prisma.adminUser.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(newPassword), recoveryKeyHash: sha256(replacement) },
  });
  return replacement;
}

// ── SSO provisioning (Phase 7.13a) ────────────────────────────────────────────

/**
 * Match or create the account behind a verified single sign-on. Returns null when the account is
 * suspended — an offboarded person must not walk back in through the identity provider.
 *
 * The claim decides the role only when the account is NEW. For an account that already exists, what
 * an owner set in the Users tab wins. Otherwise the Users tab would be lying: an owner could set
 * someone to viewer, and their next SSO sign-in would silently restore what the identity provider's
 * groups happened to say — including escalating a viewer to owner without anyone deciding to.
 *
 * The display name IS taken from the provider each time: it is the directory's to know, it carries
 * no authority, and letting a rename go stale would put an out-of-date name in the audit trail.
 */
export async function provisionSsoUser(
  email: string,
  name: string,
  roleIfNew: AdminRole,
  now = new Date(),
): Promise<AdminUserView | null> {
  const normalized = assertEmail(email);
  const existing = await prisma.adminUser.findUnique({ where: { email: normalized } });

  if (existing) {
    if (existing.status !== 'active') return null;
    const row = await prisma.adminUser.update({
      where: { id: existing.id },
      data: { lastLoginAt: now, ...(name.trim() && name.trim() !== existing.name ? { name: assertName(name) } : {}) },
      select: VIEW_SELECT,
    });
    return toView(row);
  }

  const row = await prisma.adminUser.create({
    data: {
      email: normalized,
      // A provider that sends no name leaves the address as the label — honest, and better than
      // inventing one or refusing the sign-in over a cosmetic field.
      name: (name ?? '').trim().slice(0, 80) || normalized,
      role: roleIfNew,
      source: 'sso',
      passwordHash: null, // no local password: this account can only ever come in through the IdP
      lastLoginAt: now,
    },
    select: VIEW_SELECT,
  });
  return toView(row);
}

// ── Invites ───────────────────────────────────────────────────────────────────
//
// An invite is a link, not an email. Email delivery is off by default in this gateway, so an
// invite that could only arrive by email would be a flow that silently never works — the same trap
// P7.11 found in the alert feed. The owner is handed the link and passes it on however they like;
// when email happens to be configured, it is also sent.
//
// The invitee sets their own password on acceptance. The owner never knows it, so an account is
// never born already compromised by the person who created it.

const INVITE_PREFIX = 'nxi_';
export const INVITE_TTL_DAYS = 7;

export interface AdminInviteView {
  id: string;
  email: string;
  role: AdminRole;
  expiresAt: Date;
  expired: boolean;
  invitedBy: string | null;
  createdAt: Date;
}

export async function createInvite(
  input: { email: string; role: AdminRole; invitedById?: string | null },
  now = new Date(),
): Promise<{ invite: AdminInviteView; token: string }> {
  const email = assertEmail(input.email);

  if (await prisma.adminUser.findUnique({ where: { email } })) {
    throw new AdminUserError('That person already has an account.', 409);
  }
  // Replace rather than refuse: an operator re-inviting someone almost always means "the last link
  // went astray", and leaving two live links to one address is worse than the mild surprise of the
  // first one dying.
  await prisma.adminInvite.deleteMany({ where: { email, acceptedAt: null } });

  const token = INVITE_PREFIX + randomBytes(24).toString('hex');
  const expiresAt = new Date(now.getTime() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
  const row = await prisma.adminInvite.create({
    data: { email, role: input.role, tokenHash: sha256(token), expiresAt, invitedById: input.invitedById ?? null },
    include: { invitedBy: { select: { name: true } } },
  });

  return {
    token,
    invite: {
      id: row.id, email: row.email, role: asRole(row.role), expiresAt: row.expiresAt,
      expired: false, invitedBy: row.invitedBy?.name ?? null, createdAt: row.createdAt,
    },
  };
}

export async function listInvites(now = new Date()): Promise<AdminInviteView[]> {
  const rows = await prisma.adminInvite.findMany({
    where: { acceptedAt: null },
    orderBy: { createdAt: 'desc' },
    include: { invitedBy: { select: { name: true } } },
  });
  // An expired invite is listed, not hidden: an operator wondering why someone never got in deserves
  // to see that the link ran out rather than find an empty list.
  return rows.map((r) => ({
    id: r.id, email: r.email, role: asRole(r.role), expiresAt: r.expiresAt,
    expired: r.expiresAt.getTime() <= now.getTime(),
    invitedBy: r.invitedBy?.name ?? null, createdAt: r.createdAt,
  }));
}

export async function revokeInvite(id: string): Promise<void> {
  const { count } = await prisma.adminInvite.deleteMany({ where: { id, acceptedAt: null } });
  if (count === 0) throw new AdminUserError('No such pending invite.', 404);
}

/** Read an invite without spending it, so the acceptance screen can say who it is for. */
export async function peekInvite(token: string, now = new Date()): Promise<{ email: string; role: AdminRole } | null> {
  const row = await prisma.adminInvite.findUnique({ where: { tokenHash: sha256(token ?? '') } });
  if (!row || row.acceptedAt || row.expiresAt.getTime() <= now.getTime()) return null;
  return { email: row.email, role: asRole(row.role) };
}

/**
 * Spend an invite and create the account it was for.
 *
 * The email comes from the invite, never from the form: an invitee who could choose their own
 * address could accept a viewer invite as somebody else entirely. The role likewise — it was decided
 * by the owner who sent it.
 *
 * Stamped rather than deleted, so the trail of who was invited by whom survives acceptance.
 */
export async function acceptInvite(
  token: string,
  input: { name: string; password: string },
  now = new Date(),
): Promise<{ user: AdminUserView; recoveryKey: string | null }> {
  const row = await prisma.adminInvite.findUnique({ where: { tokenHash: sha256(token ?? '') } });
  if (!row) throw new AdminUserError('That invite link is not valid.', 404);
  if (row.acceptedAt) throw new AdminUserError('That invite has already been used.', 409);
  if (row.expiresAt.getTime() <= now.getTime()) {
    throw new AdminUserError('That invite has expired. Ask an owner to send a new one.', 410);
  }

  const created = await createUser({
    email: row.email,
    name: input.name,
    password: input.password,
    role: asRole(row.role),
    source: 'local',
  });
  await prisma.adminInvite.update({ where: { id: row.id }, data: { acceptedAt: now } });
  return created;
}
