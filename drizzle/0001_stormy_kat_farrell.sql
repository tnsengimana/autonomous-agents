ALTER TABLE "briefings" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "briefings" CASCADE;--> statement-breakpoint
ALTER TABLE "inbox_items" DROP COLUMN "briefing_id";--> statement-breakpoint
ALTER TABLE "inbox_items" DROP COLUMN "type";