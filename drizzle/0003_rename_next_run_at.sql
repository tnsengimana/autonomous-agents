-- Rename nextRunAt to leadNextRunAt to make it explicit this is only for lead agents
ALTER TABLE "agents" RENAME COLUMN "next_run_at" TO "lead_next_run_at";
DROP INDEX IF EXISTS "agents_next_run_at_idx";
CREATE INDEX "agents_lead_next_run_at_idx" ON "agents" ("lead_next_run_at");
