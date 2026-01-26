CREATE TABLE "aides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"purpose" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_tasks" ALTER COLUMN "team_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" ALTER COLUMN "team_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "inbox_items" ALTER COLUMN "team_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_tasks" ADD COLUMN "aide_id" uuid;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "aide_id" uuid;--> statement-breakpoint
ALTER TABLE "inbox_items" ADD COLUMN "aide_id" uuid;--> statement-breakpoint
ALTER TABLE "aides" ADD CONSTRAINT "aides_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_tasks" ADD CONSTRAINT "agent_tasks_aide_id_aides_id_fk" FOREIGN KEY ("aide_id") REFERENCES "public"."aides"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_aide_id_aides_id_fk" FOREIGN KEY ("aide_id") REFERENCES "public"."aides"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_items" ADD CONSTRAINT "inbox_items_aide_id_aides_id_fk" FOREIGN KEY ("aide_id") REFERENCES "public"."aides"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agents_aide_id_idx" ON "agents" USING btree ("aide_id");--> statement-breakpoint
-- Check constraints: exactly one of team_id or aide_id must be set
ALTER TABLE "agents" ADD CONSTRAINT "agents_owner_check"
  CHECK ((team_id IS NOT NULL AND aide_id IS NULL) OR (team_id IS NULL AND aide_id IS NOT NULL));--> statement-breakpoint
ALTER TABLE "agent_tasks" ADD CONSTRAINT "agent_tasks_owner_check"
  CHECK ((team_id IS NOT NULL AND aide_id IS NULL) OR (team_id IS NULL AND aide_id IS NOT NULL));--> statement-breakpoint
ALTER TABLE "inbox_items" ADD CONSTRAINT "inbox_items_owner_check"
  CHECK ((team_id IS NOT NULL AND aide_id IS NULL) OR (team_id IS NULL AND aide_id IS NOT NULL));