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

import { describe, it, expect, vi } from 'vitest';
import type { FastifyRequest, FastifyReply } from 'fastify';

// guard.ts imports the auth middleware (which reaches Redis at import); stub it so the
// role gate can be unit-tested in isolation.
vi.mock('../../middleware/auth.middleware', () => ({ verifyAdminPassword: vi.fn() }));

import { requireOwner, adminOwnerGuard, adminGuard } from './guard';

function fakeReply() {
  const state = { status: 0 as number, sent: undefined as unknown };
  const reply = {
    code(c: number) { state.status = c; return reply; },
    send(b: unknown) { state.sent = b; return reply; },
  };
  return { reply: reply as unknown as FastifyReply, state };
}

describe('requireOwner (Phase 6.5 RBAC)', () => {
  it('lets an owner through untouched', async () => {
    const { reply, state } = fakeReply();
    await requireOwner({ adminRole: 'owner' } as FastifyRequest, reply);
    expect(state.status).toBe(0); // no reply sent — the request proceeds
  });

  it('refuses a viewer with a 403', async () => {
    const { reply, state } = fakeReply();
    await requireOwner({ adminRole: 'viewer' } as FastifyRequest, reply);
    expect(state.status).toBe(403);
    expect(String((state.sent as { error: string }).error)).toContain('owner');
  });

  it('refuses a caller with no role attached', async () => {
    const { reply, state } = fakeReply();
    await requireOwner({} as FastifyRequest, reply);
    expect(state.status).toBe(403);
  });

  it('adminOwnerGuard runs auth then the owner check; adminGuard is auth only', () => {
    expect(adminOwnerGuard.preHandler).toHaveLength(2);
    expect(adminOwnerGuard.preHandler[1]).toBe(requireOwner);
    expect(adminGuard.preHandler).toHaveLength(1);
  });
});
