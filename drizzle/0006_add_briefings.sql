DELETE FROM "inbox_items" WHERE "type" = 'briefing';
--> statement-breakpoint
CREATE TABLE "briefings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"team_id" uuid,
	"aide_id" uuid,
	"agent_id" uuid NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inbox_items" ADD COLUMN "briefing_id" uuid;--> statement-breakpoint
ALTER TABLE "briefings" ADD CONSTRAINT "briefings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "briefings" ADD CONSTRAINT "briefings_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "briefings" ADD CONSTRAINT "briefings_aide_id_aides_id_fk" FOREIGN KEY ("aide_id") REFERENCES "public"."aides"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "briefings" ADD CONSTRAINT "briefings_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_items" ADD CONSTRAINT "inbox_items_briefing_id_briefings_id_fk" FOREIGN KEY ("briefing_id") REFERENCES "public"."briefings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "briefings_user_id_idx" ON "briefings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "briefings_team_id_idx" ON "briefings" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "briefings_aide_id_idx" ON "briefings" USING btree ("aide_id");--> statement-breakpoint
CREATE INDEX "briefings_agent_id_idx" ON "briefings" USING btree ("agent_id");--> statement-breakpoint
ALTER TABLE "briefings" ADD CONSTRAINT "briefings_owner_check"
  CHECK ((team_id IS NOT NULL AND aide_id IS NULL) OR (team_id IS NULL AND aide_id IS NOT NULL));
