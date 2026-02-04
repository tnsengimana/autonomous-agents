CREATE TABLE "graph_edge_type_source_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"edge_type_id" uuid NOT NULL,
	"node_type_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "graph_edge_type_target_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"edge_type_id" uuid NOT NULL,
	"node_type_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "graph_edge_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"properties_schema" jsonb,
	"example_properties" jsonb,
	"created_by" text DEFAULT 'system' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "graph_edges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"type" text NOT NULL,
	"source_id" uuid NOT NULL,
	"target_id" uuid NOT NULL,
	"properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source_conversation_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "graph_node_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"properties_schema" jsonb NOT NULL,
	"example_properties" jsonb,
	"created_by" text DEFAULT 'system' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "graph_nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source_conversation_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "graph_edge_type_source_types" ADD CONSTRAINT "graph_edge_type_source_types_edge_type_id_graph_edge_types_id_fk" FOREIGN KEY ("edge_type_id") REFERENCES "public"."graph_edge_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graph_edge_type_source_types" ADD CONSTRAINT "graph_edge_type_source_types_node_type_id_graph_node_types_id_fk" FOREIGN KEY ("node_type_id") REFERENCES "public"."graph_node_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graph_edge_type_target_types" ADD CONSTRAINT "graph_edge_type_target_types_edge_type_id_graph_edge_types_id_fk" FOREIGN KEY ("edge_type_id") REFERENCES "public"."graph_edge_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graph_edge_type_target_types" ADD CONSTRAINT "graph_edge_type_target_types_node_type_id_graph_node_types_id_fk" FOREIGN KEY ("node_type_id") REFERENCES "public"."graph_node_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graph_edge_types" ADD CONSTRAINT "graph_edge_types_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graph_edges" ADD CONSTRAINT "graph_edges_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graph_edges" ADD CONSTRAINT "graph_edges_source_id_graph_nodes_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."graph_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graph_edges" ADD CONSTRAINT "graph_edges_target_id_graph_nodes_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."graph_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graph_edges" ADD CONSTRAINT "graph_edges_source_conversation_id_conversations_id_fk" FOREIGN KEY ("source_conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graph_node_types" ADD CONSTRAINT "graph_node_types_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graph_nodes" ADD CONSTRAINT "graph_nodes_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graph_nodes" ADD CONSTRAINT "graph_nodes_source_conversation_id_conversations_id_fk" FOREIGN KEY ("source_conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "graph_edge_type_source_types_edge_idx" ON "graph_edge_type_source_types" USING btree ("edge_type_id");--> statement-breakpoint
CREATE INDEX "graph_edge_type_source_types_node_idx" ON "graph_edge_type_source_types" USING btree ("node_type_id");--> statement-breakpoint
CREATE INDEX "graph_edge_type_target_types_edge_idx" ON "graph_edge_type_target_types" USING btree ("edge_type_id");--> statement-breakpoint
CREATE INDEX "graph_edge_type_target_types_node_idx" ON "graph_edge_type_target_types" USING btree ("node_type_id");--> statement-breakpoint
CREATE INDEX "graph_edge_types_entity_id_idx" ON "graph_edge_types" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "graph_edges_entity_id_idx" ON "graph_edges" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "graph_edges_type_idx" ON "graph_edges" USING btree ("type");--> statement-breakpoint
CREATE INDEX "graph_edges_source_id_idx" ON "graph_edges" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "graph_edges_target_id_idx" ON "graph_edges" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "graph_node_types_entity_id_idx" ON "graph_node_types" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "graph_nodes_entity_id_idx" ON "graph_nodes" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "graph_nodes_type_idx" ON "graph_nodes" USING btree ("type");--> statement-breakpoint
CREATE INDEX "graph_nodes_entity_type_idx" ON "graph_nodes" USING btree ("entity_id","type");