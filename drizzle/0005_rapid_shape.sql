ALTER TABLE "inbox_items" DROP CONSTRAINT "inbox_items_agent_id_agents_id_fk";
--> statement-breakpoint
ALTER TABLE "inbox_items" ALTER COLUMN "agent_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "inbox_items" ADD CONSTRAINT "inbox_items_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;