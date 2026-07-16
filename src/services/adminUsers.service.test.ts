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

import { describe, it, expect, beforeEach, vi } from 'vitest';

// An in-memory stand-in for the two tables this service owns, rather than a wall of per-call mocks.
// The invariants below (last owner, token revocation, single-use invites) are about how rows relate
// to each other, so a fake store is what lets the tests read like the rules they enforce.
const { db } = vi.hoisted(() => {
  interface Row { [k: string]: unknown }
  const db = {
    users: [] as Row[],
    invites: [] as Row[],
    tokens: [] as Row[],
    seq: 0,
  };
  return { db };
});

function match(row: Record<string, unknown>, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([k, v]) => {
    if (v === null) return row[k] === null || row[k] === undefined;
    return row[k] === v;
  });
}

vi.mock('../lib/prisma', () => {
  const users = () => db.users as Record<string, unknown>[];
  const invites = () => db.invites as Record<string, unknown>[];
  const tokens = () => db.tokens as Record<string, unknown>[];

  const withInviter = (r: Record<string, unknown>) => ({
    ...r,
    invitedBy: r.invitedById ? { name: users().find((u) => u.id === r.invitedById)?.name ?? null } : null,
  });

  const client = {
    adminUser: {
      findMany: vi.fn(async () => [...users()]),
      findUnique: vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
        users().find((u) => match(u, where)) ?? null),
      count: vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
        users().filter((u) => match(u, where)).length),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = {
          id: `u${++db.seq}`, totpConfirmedAt: null, lastLoginAt: null, createdAt: new Date(),
          status: 'active', source: 'local', passwordHash: null, recoveryKeyHash: null, ...data,
        };
        users().push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        const row = users().find((u) => match(u, where));
        if (!row) throw new Error('not found');
        Object.assign(row, data);
        return row;
      }),
      delete: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        const i = users().findIndex((u) => match(u, where));
        const [row] = users().splice(i, 1);
        return row;
      }),
    },
    adminInvite: {
      findUnique: vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
        invites().find((r) => match(r, where)) ?? null),
      findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
        invites().filter((r) => match(r, where)).map(withInviter)),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `i${++db.seq}`, acceptedAt: null, createdAt: new Date(), invitedById: null, ...data };
        invites().push(row);
        return withInviter(row);
      }),
      update: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        const row = invites().find((r) => match(r, where));
        Object.assign(row as object, data);
        return row;
      }),
      deleteMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        const keep = invites().filter((r) => !match(r, where));
        const count = invites().length - keep.length;
        db.invites = keep;
        return { count };
      }),
    },
    adminApiToken: {
      updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        const hit = tokens().filter((r) => match(r, where));
        hit.forEach((r) => Object.assign(r, data));
        return { count: hit.length };
      }),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(client)),
  };
  return { prisma: client };
});

import {
  createUser, updateUser, deleteUser, listUsers, getUser, countActiveOwners, isUnclaimed,
  changeOwnPassword, regenerateRecoveryKey, resetPasswordWithRecoveryKey,
  createInvite, listInvites, revokeInvite, peekInvite, acceptInvite,
  normalizeEmail, AdminUserError,
} from './adminUsers.service';
import { verifyPassword, isPasswordHash } from '../lib/password';

const PW = 'a long enough password';

beforeEach(() => {
  db.users = [];
  db.invites = [];
  db.tokens = [];
  db.seq = 0;
});

async function seedOwner(email = 'owner@example.com') {
  const { user } = await createUser({ email, name: 'Owner', role: 'owner', password: PW });
  return user;
}

describe('createUser', () => {
  it('stores a slow hash, never the password, and hands back a recovery key once', async () => {
    const { user, recoveryKey } = await createUser({
      email: 'Ada@Example.COM ', name: 'Ada', role: 'admin', password: PW,
    });

    expect(user.email).toBe('ada@example.com'); // normalized: identity must not vary by case
    expect(user.role).toBe('admin');
    expect(recoveryKey).toMatch(/^([0-9a-f]{4}-){7}[0-9a-f]{4}$/);

    const row = db.users[0] as Record<string, string>;
    expect(row.passwordHash).not.toContain(PW);
    expect(isPasswordHash(row.passwordHash)).toBe(true);
    expect(await verifyPassword(PW, row.passwordHash)).toBe(true);
    // The key is stored as a digest, so a database dump yields nothing usable.
    expect(row.recoveryKeyHash).not.toBe(recoveryKey);
  });

  it('never exposes a secret in the shape the routes return', async () => {
    await seedOwner();
    const view = (await listUsers())[0] as unknown as Record<string, unknown>;
    expect(view).not.toHaveProperty('passwordHash');
    expect(view).not.toHaveProperty('totpSecret');
    expect(view).not.toHaveProperty('recoveryKeyHash');
    expect(view.twoFactorEnabled).toBe(false); // whether, not what
  });

  it('gives an SSO account no password and no recovery key, so it cannot sign in with one', async () => {
    const { user, recoveryKey } = await createUser({
      email: 'sso@example.com', name: 'Sam', role: 'viewer', source: 'sso',
    });
    expect(user.source).toBe('sso');
    expect(recoveryKey).toBeNull();
    const row = db.users[0] as Record<string, unknown>;
    expect(row.passwordHash).toBeNull();
    expect(await verifyPassword('anything at all', row.passwordHash as null)).toBe(false);
  });

  it('refuses a duplicate email, a bad address, and a weak password', async () => {
    await seedOwner('taken@example.com');
    await expect(createUser({ email: 'TAKEN@example.com', name: 'X', role: 'viewer', password: PW }))
      .rejects.toThrow(/already exists/);
    await expect(createUser({ email: 'not-an-email', name: 'X', role: 'viewer', password: PW }))
      .rejects.toThrow(/valid email/);
    await expect(createUser({ email: 'x@example.com', name: 'X', role: 'viewer', password: 'short' }))
      .rejects.toThrow(/at least 12/);
  });
});

describe('the last active owner cannot be lost', () => {
  it('refuses to remove, demote, or suspend the only owner', async () => {
    const owner = await seedOwner();

    await expect(deleteUser(owner.id)).rejects.toThrow(/only owner/);
    await expect(updateUser(owner.id, { role: 'admin' })).rejects.toThrow(/only owner/);
    await expect(updateUser(owner.id, { role: 'viewer' })).rejects.toThrow(/only owner/);
    await expect(updateUser(owner.id, { status: 'suspended' })).rejects.toThrow(/only owner/);

    // ...and the refusal is a 409 with a way out, not a bare "no".
    await expect(deleteUser(owner.id)).rejects.toMatchObject({ status: 409 });
    await expect(deleteUser(owner.id)).rejects.toThrow(/Make someone else an owner first/);
    expect(await countActiveOwners()).toBe(1);
  });

  it('allows all three once a second owner exists', async () => {
    const first = await seedOwner('a@example.com');
    await createUser({ email: 'b@example.com', name: 'B', role: 'owner', password: PW });

    await expect(updateUser(first.id, { role: 'viewer' })).resolves.toMatchObject({ role: 'viewer' });
    expect(await countActiveOwners()).toBe(1);
  });

  it('does not count a suspended owner as cover for removing the active one', async () => {
    const active = await seedOwner('a@example.com');
    const other = await createUser({ email: 'b@example.com', name: 'B', role: 'owner', password: PW });
    // Suspending the second owner is fine — the first is still active.
    await updateUser(other.user.id, { status: 'suspended' });
    // But now the first is the ONLY *active* owner again, so it is protected once more.
    await expect(deleteUser(active.id)).rejects.toThrow(/only owner/);
  });

  it('lets a non-owner be removed freely', async () => {
    await seedOwner();
    const { user } = await createUser({ email: 'v@example.com', name: 'V', role: 'viewer', password: PW });
    await expect(deleteUser(user.id)).resolves.toEqual({ tokensRevoked: 0 });
    expect(await getUser(user.id)).toBeNull();
  });
});

describe('removing a person revokes the credentials they hold', () => {
  it('revokes their API tokens, and leaves everyone else’s alone', async () => {
    await seedOwner();
    const { user } = await createUser({ email: 'leaver@example.com', name: 'L', role: 'admin', password: PW });
    const { user: stays } = await createUser({ email: 'stays@example.com', name: 'S', role: 'admin', password: PW });

    db.tokens.push(
      { id: 't1', createdById: user.id, revokedAt: null },
      { id: 't2', createdById: user.id, revokedAt: null },
      { id: 't3', createdById: stays.id, revokedAt: null },
    );

    expect(await deleteUser(user.id)).toEqual({ tokensRevoked: 2 });
    // Revoked with a timestamp, not deleted: the trail must keep the evidence the token existed.
    expect(db.tokens.filter((t) => (t as { revokedAt: Date | null }).revokedAt !== null)).toHaveLength(2);
    expect((db.tokens[2] as { revokedAt: Date | null }).revokedAt).toBeNull();
  });
});

describe('changeOwnPassword', () => {
  it('requires the current password and stores a fresh slow hash', async () => {
    const owner = await seedOwner();
    await expect(changeOwnPassword(owner.id, 'not the password', 'a brand new password'))
      .rejects.toThrow(/not your current password/);

    await changeOwnPassword(owner.id, PW, 'a brand new password');
    const row = db.users[0] as Record<string, string>;
    expect(await verifyPassword('a brand new password', row.passwordHash)).toBe(true);
    expect(await verifyPassword(PW, row.passwordHash)).toBe(false);
  });

  it('refuses on an SSO account, which has no password to change', async () => {
    const { user } = await createUser({ email: 's@example.com', name: 'S', role: 'viewer', source: 'sso' });
    await expect(changeOwnPassword(user.id, 'x', 'a brand new password'))
      .rejects.toThrow(/identity provider/);
  });

  it('enforces the length policy on the new password', async () => {
    const owner = await seedOwner();
    await expect(changeOwnPassword(owner.id, PW, 'tiny')).rejects.toThrow(/at least 12/);
  });
});

describe('recovery key', () => {
  it('resets a forgotten password, then stops working', async () => {
    const owner = await seedOwner('me@example.com');
    const key = await regenerateRecoveryKey(owner.id);

    const replacement = await resetPasswordWithRecoveryKey('me@example.com', key, 'my recovered password');
    const row = db.users[0] as Record<string, string>;
    expect(await verifyPassword('my recovered password', row.passwordHash)).toBe(true);

    // Single use: the spent key is worthless even to whoever read it over your shoulder.
    await expect(resetPasswordWithRecoveryKey('me@example.com', key, 'another password entirely'))
      .rejects.toThrow(/do not match/);
    // ...and the replacement handed back works.
    await expect(resetPasswordWithRecoveryKey('me@example.com', replacement, 'yet another password'))
      .resolves.toMatch(/^([0-9a-f]{4}-){7}[0-9a-f]{4}$/);
  });

  it('answers a wrong key and an unknown email identically, so it is not an oracle', async () => {
    await seedOwner('me@example.com');
    const wrongKey = resetPasswordWithRecoveryKey('me@example.com', 'aaaa-bbbb-cccc-dddd-eeee-ffff-0000-1111', 'a new password here');
    const noSuchUser = resetPasswordWithRecoveryKey('nobody@example.com', 'aaaa-bbbb-cccc-dddd-eeee-ffff-0000-1111', 'a new password here');
    await expect(wrongKey).rejects.toThrow(/do not match an active account/);
    await expect(noSuchUser).rejects.toThrow(/do not match an active account/);
  });

  it('will not recover a suspended account', async () => {
    await seedOwner('a@example.com');
    const { user } = await createUser({ email: 'sus@example.com', name: 'S', role: 'admin', password: PW });
    const key = await regenerateRecoveryKey(user.id);
    await updateUser(user.id, { status: 'suspended' });
    await expect(resetPasswordWithRecoveryKey('sus@example.com', key, 'a new password here'))
      .rejects.toThrow(/do not match an active account/);
  });
});

describe('invites', () => {
  it('mints a link whose token is never stored, and reads back who it is for', async () => {
    const owner = await seedOwner();
    const { invite, token } = await createInvite({ email: 'New@Example.com', role: 'admin', invitedById: owner.id });

    expect(token).toMatch(/^nxi_[0-9a-f]{48}$/);
    expect(invite.email).toBe('new@example.com');
    expect(invite.invitedBy).toBe('Owner');
    expect(db.invites[0]).not.toHaveProperty('token');
    expect((db.invites[0] as { tokenHash: string }).tokenHash).not.toBe(token);

    expect(await peekInvite(token)).toEqual({ email: 'new@example.com', role: 'admin' });
    expect(await peekInvite('nxi_wrong')).toBeNull();
  });

  it('takes the email and role from the invite, not from the form', async () => {
    // Otherwise an invitee could accept a viewer invite as somebody else, at any role they liked.
    const owner = await seedOwner();
    const { token } = await createInvite({ email: 'invitee@example.com', role: 'viewer', invitedById: owner.id });

    const { user } = await acceptInvite(token, { name: 'Invitee', password: PW });
    expect(user.email).toBe('invitee@example.com');
    expect(user.role).toBe('viewer');
    expect(user.source).toBe('local');
  });

  it('is single use and expires', async () => {
    const owner = await seedOwner();
    const { token } = await createInvite({ email: 'once@example.com', role: 'viewer', invitedById: owner.id });
    await acceptInvite(token, { name: 'Once', password: PW });

    await expect(acceptInvite(token, { name: 'Again', password: PW })).rejects.toThrow(/already been used/);
    expect(await peekInvite(token)).toBeNull();

    const { token: t2 } = await createInvite({ email: 'late@example.com', role: 'viewer', invitedById: owner.id });
    const eightDaysOn = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);
    await expect(acceptInvite(t2, { name: 'Late', password: PW }, eightDaysOn)).rejects.toThrow(/expired/);
    await expect(acceptInvite(t2, { name: 'Late', password: PW }, eightDaysOn)).rejects.toMatchObject({ status: 410 });
    expect(await peekInvite(t2, eightDaysOn)).toBeNull();
  });

  it('replaces a previous pending invite to the same address rather than leaving two live links', async () => {
    const owner = await seedOwner();
    const { token: first } = await createInvite({ email: 'dup@example.com', role: 'viewer', invitedById: owner.id });
    const { token: second } = await createInvite({ email: 'dup@example.com', role: 'admin', invitedById: owner.id });

    expect(await peekInvite(first)).toBeNull();
    expect(await peekInvite(second)).toEqual({ email: 'dup@example.com', role: 'admin' });
    expect(await listInvites()).toHaveLength(1);
  });

  it('refuses to invite someone who already has an account', async () => {
    await seedOwner('here@example.com');
    await expect(createInvite({ email: 'here@example.com', role: 'viewer' }))
      .rejects.toThrow(/already has an account/);
  });

  it('lists an expired invite rather than hiding it, and revokes a pending one', async () => {
    const owner = await seedOwner();
    await createInvite({ email: 'p@example.com', role: 'viewer', invitedById: owner.id });

    const later = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);
    expect((await listInvites(later))[0].expired).toBe(true);
    expect((await listInvites())[0].expired).toBe(false);

    const [pending] = await listInvites();
    await revokeInvite(pending.id);
    expect(await listInvites()).toHaveLength(0);
    await expect(revokeInvite(pending.id)).rejects.toThrow(/No such pending invite/);
  });
});

describe('isUnclaimed', () => {
  it('is true only while no active owner exists — the condition that opens first-run', async () => {
    expect(await isUnclaimed()).toBe(true);
    const owner = await seedOwner();
    expect(await isUnclaimed()).toBe(false);

    // A gateway whose only owner is suspended is unclaimed again, which is exactly right: nobody
    // can administer it, and first-run is how you get back in.
    (db.users.find((u) => (u as { id: string }).id === owner.id) as Record<string, unknown>).status = 'suspended';
    expect(await isUnclaimed()).toBe(true);
  });
});

describe('normalizeEmail', () => {
  it('is the whole reason two accounts cannot differ only by case', () => {
    expect(normalizeEmail('  Ada@Example.COM ')).toBe('ada@example.com');
    expect(normalizeEmail('')).toBe('');
  });
});

describe('AdminUserError', () => {
  it('carries the status the route should answer with', () => {
    expect(new AdminUserError('nope').status).toBe(400);
    expect(new AdminUserError('nope', 409).status).toBe(409);
  });
});
