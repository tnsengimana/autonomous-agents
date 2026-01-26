ALTER TABLE "insights" RENAME TO "knowledge_items";--> statement-breakpoint
ALTER TABLE "knowledge_items" DROP CONSTRAINT "insights_agent_id_agents_id_fk";
--> statement-breakpoint
ALTER TABLE "knowledge_items" DROP CONSTRAINT "insights_source_thread_id_threads_id_fk";
--> statement-breakpoint
DROP INDEX "insights_agent_id_idx";--> statement-breakpoint
ALTER TABLE "knowledge_items" ADD CONSTRAINT "knowledge_items_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_items" ADD CONSTRAINT "knowledge_items_source_thread_id_threads_id_fk" FOREIGN KEY ("source_thread_id") REFERENCES "public"."threads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "knowledge_items_agent_id_idx" ON "knowledge_items" USING btree ("agent_id");