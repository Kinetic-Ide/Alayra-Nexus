-- Per-request outcome, latency, and response-cache savings (Phase 7.5).
-- All four columns are additive with defaults, so every existing row stays valid and reads as a
-- successful, uncached request with an unknown (0ms) latency — which is exactly what it was.
ALTER TABLE "TokenUsage" ADD COLUMN "outcome"   TEXT    NOT NULL DEFAULT 'success';
ALTER TABLE "TokenUsage" ADD COLUMN "latencyMs" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TokenUsage" ADD COLUMN "cached"    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TokenUsage" ADD COLUMN "savedUsd"  DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Error-rate and outcome-breakdown queries scan by outcome over a time window.
CREATE INDEX "TokenUsage_outcome_createdAt_idx" ON "TokenUsage"("outcome", "createdAt");
