-- Phase 5: Team entity + budget hierarchy.
-- A Team groups scoped access keys and carries a per-period USD budget cap that is
-- enforced on the admission path. NexusTeamKey.teamId is nullable so existing
-- standalone keys keep working unchanged.

CREATE TABLE "Team" (
  "id"           TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "name"         TEXT NOT NULL,
  "status"       TEXT NOT NULL DEFAULT 'active',
  "assignedTier" TEXT,
  "budgetUsd"    DOUBLE PRECISION,
  "budgetPeriod" TEXT NOT NULL DEFAULT 'monthly',
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "NexusTeamKey" ADD COLUMN "teamId" TEXT;

ALTER TABLE "NexusTeamKey"
  ADD CONSTRAINT "NexusTeamKey_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL;

CREATE INDEX "NexusTeamKey_teamId_idx" ON "NexusTeamKey"("teamId");
