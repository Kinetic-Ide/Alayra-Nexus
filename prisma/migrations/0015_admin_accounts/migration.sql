-- Admin accounts (Phase 7.13a).
--
-- Until now the gateway had no users: one shared ADMIN_PASSWORD in an environment variable
-- authenticated everyone, so nobody could be added or removed, and the audit trail could only ever
-- say "someone with the password". This is the accounts primitive the rest of the phase stands on.
--
-- Entirely additive. No existing column changes type, no row is touched, and every new column is
-- nullable — so audit entries, API tokens, and recovery codes written before this migration stay
-- valid exactly as they are. The gateway behaves identically after it is applied: the change of
-- behaviour happens when the operator claims their owner account, not when the SQL runs.

-- A person who administers the gateway.
-- `passwordHash` is nullable because an SSO-provisioned account has no local password and must never
-- be able to sign in with one. `role` defaults to the LEAST privilege ("viewer"), never to owner:
-- a bug in a create path must fail closed. TOTP is per-user now (it used to be a single secret for
-- the whole gateway, shared by everyone who knew the password).
CREATE TABLE "AdminUser" (
    "id"              TEXT NOT NULL,
    "email"           TEXT NOT NULL,
    "name"            TEXT NOT NULL,
    "passwordHash"    TEXT,
    "role"            TEXT NOT NULL DEFAULT 'viewer',
    "status"          TEXT NOT NULL DEFAULT 'active',
    "source"          TEXT NOT NULL DEFAULT 'local',
    "totpSecret"      TEXT,
    "totpConfirmedAt" TIMESTAMP(3),
    "recoveryKeyHash" TEXT,
    "lastLoginAt"     TIMESTAMP(3),
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- Email is the sign-in identity, stored already lowercased by the service so this unique index is
-- the real guarantee that two accounts cannot differ only by case.
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");
-- The "last active owner" invariant counts owners by role+status on every demotion and removal.
CREATE INDEX "AdminUser_role_status_idx" ON "AdminUser"("role", "status");

-- A pending invitation. Only the hash of the invite token is stored: a stolen database cannot yield
-- a usable invite link, exactly as with recovery codes and API tokens. Invites are handed over as a
-- link (and emailed only when email happens to be configured) because email delivery is off by
-- default here — an email-only invite would be a flow that silently never works.
CREATE TABLE "AdminInvite" (
    "id"          TEXT NOT NULL,
    "email"       TEXT NOT NULL,
    "role"        TEXT NOT NULL DEFAULT 'viewer',
    "tokenHash"   TEXT NOT NULL,
    "expiresAt"   TIMESTAMP(3) NOT NULL,
    "acceptedAt"  TIMESTAMP(3),
    "invitedById" TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminInvite_tokenHash_key" ON "AdminInvite"("tokenHash");
-- Pending invites are listed per address and checked for a live one before a new invite is minted.
CREATE INDEX "AdminInvite_email_acceptedAt_idx" ON "AdminInvite"("email", "acceptedAt");

-- The inviter. SET NULL, not CASCADE: removing the person who sent an invite must not silently
-- withdraw an invitation the invitee may already be holding.
ALTER TABLE "AdminInvite" ADD CONSTRAINT "AdminInvite_invitedById_fkey"
    FOREIGN KEY ("invitedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Recovery codes become a person's, not the gateway's. NULL means a code issued before this
-- migration, which belongs to the pre-accounts singleton second factor; the claim flow adopts those
-- rows onto the first owner so an operator's existing codes keep working.
ALTER TABLE "AdminRecoveryCode" ADD COLUMN "userId" TEXT;

-- CASCADE: a person's recovery codes are meaningless once the person is gone, and leaving live
-- codes behind that unlock nothing is worse than deleting them.
ALTER TABLE "AdminRecoveryCode" ADD CONSTRAINT "AdminRecoveryCode_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "AdminRecoveryCode_userId_usedAt_idx" ON "AdminRecoveryCode"("userId", "usedAt");

-- Who minted an API token. Without this, removing a person left the tokens they created working
-- forever, attributed to nobody. SET NULL rather than CASCADE because the service revokes those
-- tokens explicitly (a timestamp, so the trail survives) — deleting the rows would erase the
-- evidence that the token ever existed.
ALTER TABLE "AdminApiToken" ADD COLUMN "createdById" TEXT;

ALTER TABLE "AdminApiToken" ADD CONSTRAINT "AdminApiToken_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "AdminApiToken_createdById_idx" ON "AdminApiToken"("createdById");

-- The audit trail finally names a person instead of just a role.
--
-- DELIBERATELY NO FOREIGN KEY, and `actorName` is denormalised on purpose. An audit record must
-- outlive the account it describes: the whole point of the trail is to answer "who did this" about
-- people who have since been removed. A foreign key would either block the removal or null the
-- actor, and a join would lose the name — each of which quietly destroys evidence.
ALTER TABLE "AuditLog" ADD COLUMN "actorId"   TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "actorName" TEXT;
