ALTER TABLE "agents" ADD COLUMN "backoff_next_run_at" timestamp;
ALTER TABLE "agents" ADD COLUMN "backoff_attempt_count" integer DEFAULT 0 NOT NULL;
CREATE INDEX "agents_backoff_next_run_at_idx" ON "agents" ("backoff_next_run_at");
UPDATE "agent_tasks" SET "status" = 'pending' WHERE "status" = 'in_progress';
