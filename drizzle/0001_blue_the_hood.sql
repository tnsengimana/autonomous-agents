ALTER TABLE "entities" ADD COLUMN "conversation_system_prompt" text;--> statement-breakpoint
ALTER TABLE "entities" ADD COLUMN "classification_system_prompt" text;--> statement-breakpoint
ALTER TABLE "entities" ADD COLUMN "insight_synthesis_system_prompt" text;--> statement-breakpoint
ALTER TABLE "entities" ADD COLUMN "graph_construction_system_prompt" text;--> statement-breakpoint
ALTER TABLE "llm_interactions" ADD COLUMN "phase" text;