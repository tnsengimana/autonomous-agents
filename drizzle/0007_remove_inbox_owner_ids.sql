DELETE FROM "inbox_items";
--> statement-breakpoint
ALTER TABLE "inbox_items" DROP CONSTRAINT IF EXISTS "inbox_items_owner_check";
--> statement-breakpoint
ALTER TABLE "inbox_items" DROP CONSTRAINT IF EXISTS "inbox_items_team_id_teams_id_fk";
--> statement-breakpoint
ALTER TABLE "inbox_items" DROP CONSTRAINT IF EXISTS "inbox_items_aide_id_aides_id_fk";
--> statement-breakpoint
ALTER TABLE "inbox_items" DROP COLUMN IF EXISTS "team_id";
--> statement-breakpoint
ALTER TABLE "inbox_items" DROP COLUMN IF EXISTS "aide_id";
