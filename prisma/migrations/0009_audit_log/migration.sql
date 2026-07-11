-- Audit & compliance logging (Phase 6.7): an append-only trail of admin actions.
-- Additive only. Rows are never updated after insert; the retention job is the only
-- deleter. `actorRole` attributes each action to a Phase 6.5 role.
CREATE TABLE "AuditLog" (
    "id"        TEXT NOT NULL,
    "action"    TEXT NOT NULL,
    "method"    TEXT NOT NULL DEFAULT '',
    "actorRole" TEXT NOT NULL DEFAULT 'system',
    "actor"     TEXT,
    "target"    TEXT,
    "ip"        TEXT,
    "status"    INTEGER NOT NULL DEFAULT 0,
    "detail"    TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");
