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
import { roleAtLeast, ROLE_LABELS, type AdminRole } from '../../lib/roles';

/**
 * Every admin route carries a guard. Kept in one place so a new sub-router cannot
 * accidentally register an unauthenticated endpoint under /admin.
 *
 * Three guards, matching the three roles (Phase 7.13a):
 *
 *   adminGuard      — any authenticated caller. Reads, and the few actions anyone may take on
 *                     their own session or account (logout, my profile, my second factor).
 *   adminWriteGuard — owner or admin. The default for a mutation: this is the gateway's day-to-day
 *                     operation, which is exactly what delegating to an admin is for.
 *   adminOwnerGuard — owner only. The short list of things that decide who the gateway belongs to:
 *                     people, invites, single sign-on, compliance/retention, the master API key,
 *                     and the reset-wipe. An admin who could do these could remove the owner.
 *
 * The server is the real boundary. The dashboard also hides what a caller cannot do, but that is
 * cosmetic — every rule here is enforced here.
 */
export const adminGuard = { preHandler: [verifyAdminPassword] };

/**
 * Refuse a caller who lacks the required authority, naming what they have and what is needed.
 *
 * The message matters: "403" on a button a person can see is a dead end, while "this needs owner
 * access, yours is admin" tells them exactly who to ask.
 */
function requireRole(minimum: AdminRole) {
  return async function guard(request: FastifyRequest, reply: FastifyReply) {
    const role = (request.adminRole ?? 'viewer') as AdminRole;
    if (roleAtLeast(role, minimum)) return;
    return reply.code(403).send({
      error: `This action needs ${ROLE_LABELS[minimum].label.toLowerCase()} access. Your account is ${ROLE_LABELS[role].label.toLowerCase()}.`,
      requiredRole: minimum,
      role,
    });
  };
}

/** Kept for the one thing it still names: owner-only. Exported because tests drive it directly. */
export const requireOwner = requireRole('owner');
/** Owner or admin — anything but a viewer. */
export const requireWrite = requireRole('admin');

export const adminOwnerGuard = { preHandler: [verifyAdminPassword, requireOwner] };
export const adminWriteGuard = { preHandler: [verifyAdminPassword, requireWrite] };
