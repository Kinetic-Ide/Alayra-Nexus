-- Configurable over-budget action per team (Phase 7.10).
-- Additive with a default of 'block', which is the exact behaviour every team had before this column
-- existed (a hard 429 once the period cap is reached), so no existing row changes meaning. The other
-- values are 'notify' (soft cap: alert only, never block) and 'downgrade' (keep serving on the fast
-- tier once over budget).
ALTER TABLE "Team" ADD COLUMN "overBudgetAction" TEXT NOT NULL DEFAULT 'block';
