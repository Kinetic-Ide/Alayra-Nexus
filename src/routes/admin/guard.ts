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

import { FastifyRequest, FastifyReply } from 'fastify';
import { verifyAdminPassword } from '../../middleware/auth.middleware';

/**
 * Every admin route carries a guard. Kept in one place so a new sub-router cannot
 * accidentally register an unauthenticated endpoint under /admin.
 *
 * `adminGuard` authenticates the caller (any role) — use it for reads (GET) and for the
 * few actions any signed-in caller may take on their own session (logout).
 * `adminOwnerGuard` additionally requires the owner role — use it for every mutation.
 */
export const adminGuard = { preHandler: [verifyAdminPassword] };

/**
 * Role gate (Phase 6.5). Runs after verifyAdminPassword, which has attached `adminRole`,
 * so a viewer (read-only) credential is refused with a clear 403 on any mutating route.
 * The server is the real boundary here — the dashboard also hides these actions, but that
 * is only cosmetic.
 */
export async function requireOwner(request: FastifyRequest, reply: FastifyReply) {
  if (request.adminRole !== 'owner') {
    return reply.code(403).send({ error: 'This action requires owner access. Your credential is read-only.' });
  }
}

export const adminOwnerGuard = { preHandler: [verifyAdminPassword, requireOwner] };
