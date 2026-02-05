/**
 * Worker Runner
 *
 * Entity-based iteration with 5-minute intervals using two-step classification -> action flow.
 *
 * For each active entity:
 * 1. Run classification phase to decide: "synthesize" or "populate"
 * 2. Run the appropriate action phase based on classification result
 *
 * This implements the KGoT-inspired INSERT/RETRIEVE loop:
 * - "populate" = INSERT branch: gather external knowledge via Tavily tools
 * - "synthesize" = RETRIEVE branch: create Insight nodes from existing knowledge
 */

import {
  streamLLMResponseWithTools,
  generateLLMObject,
} from "@/lib/llm/providers";
import {
  buildGraphContextBlock,
  ensureGraphTypesInitialized,
} from "@/lib/llm/knowledge-graph";
import {
  getInsightSynthesisTools,
  getGraphConstructionTools,
  type ToolContext,
} from "@/lib/llm/tools";
import { z } from "zod";
import { getActiveEntities } from "@/lib/db/queries/entities";
import {
  createLLMInteraction,
  updateLLMInteraction,
} from "@/lib/db/queries/llm-interactions";
import {
  createWorkerIteration,
  updateWorkerIteration,
  getLastCompletedIteration,
} from "@/lib/db/queries/worker-iterations";
import type { Entity } from "@/lib/types";

// ============================================================================
// Configuration
// ============================================================================

// How often to check if any entity needs processing
const POLL_INTERVAL_MS = 10 * 1000; // 10 seconds

// Shutdown flag
let isShuttingDown = false;

export function stopRunner(): void {
  isShuttingDown = true;
}

// ============================================================================
// Types & Schemas
// ============================================================================

const ClassificationResultSchema = z.object({
  action: z
    .enum(["synthesize", "populate"])
    .describe(
      "The action to take: 'synthesize' to create insights from existing knowledge, 'populate' to gather more external knowledge",
    ),
  reasoning: z
    .string()
    .describe(
      "Detailed reasoning explaining why this action was chosen and what specific work should be done",
    ),
});

type ClassificationResult = z.infer<typeof ClassificationResultSchema>;

// ============================================================================
// Utility Functions
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function log(message: string, ...args: unknown[]): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [Worker] ${message}`, ...args);
}

function logError(message: string, error: unknown): void {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [Worker] ${message}`, error);
}

/**
 * Check if an entity is due for its next iteration based on its interval.
 * Returns true if the entity has never been processed or if enough time has passed.
 */
async function isEntityDueForIteration(entity: Entity): Promise<boolean> {
  const lastIteration = await getLastCompletedIteration(entity.id);

  // Never processed - due immediately
  if (!lastIteration || !lastIteration.completedAt) {
    return true;
  }

  const timeSinceLastIteration =
    Date.now() - lastIteration.completedAt.getTime();
  return timeSinceLastIteration >= entity.iterationIntervalMs;
}

// ============================================================================
// Classification Phase
// ============================================================================

/**
 * Run the classification phase to decide whether to synthesize or populate.
 * Uses structured output (generateLLMObject) to get a JSON response.
 */
async function runClassificationPhase(
  entity: Entity,
  graphContext: string,
  workerIterationId: string,
): Promise<ClassificationResult> {
  log(`[Classification] Starting for entity: ${entity.name}`);

  const systemPrompt = entity.classificationSystemPrompt;
  if (!systemPrompt) {
    throw new Error("Entity missing classificationSystemPrompt");
  }

  const requestMessages = [
    {
      role: "user" as const,
      content: `Review your current knowledge graph state and decide your next action.

${graphContext}

Based on the graph state above, decide:
- "synthesize" if you have enough knowledge to derive meaningful insights
- "populate" if you need to gather more external knowledge`,
    },
  ];

  // Create llm_interaction record for classification
  const interaction = await createLLMInteraction({
    entityId: entity.id,
    workerIterationId,
    systemPrompt: systemPrompt,
    request: { messages: requestMessages },
    phase: "classification",
  });

  log(
    `[Classification] Calling LLM with structured output for entity ${entity.name}`,
  );

  const classification = await generateLLMObject(
    requestMessages,
    ClassificationResultSchema,
    systemPrompt,
    { entityId: entity.id },
  );

  await updateLLMInteraction(interaction.id, {
    response: classification,
    completedAt: new Date(),
  });

  log(
    `[Classification] Entity ${entity.name} decided: ${classification.action}`,
  );
  log(
    `[Classification] Reasoning preview: ${classification.reasoning.substring(0, 200)}...`,
  );

  return classification;
}

// ============================================================================
// Action Phases
// ============================================================================

/**
 * Run the insight synthesis phase.
 * Uses existing graph knowledge to create Insight nodes.
 */
async function runInsightSynthesisPhase(
  entity: Entity,
  classificationReasoning: string,
  graphContext: string,
  workerIterationId: string,
): Promise<void> {
  log(`[InsightSynthesis] Starting for entity: ${entity.name}`);

  const systemPrompt = entity.insightSynthesisSystemPrompt;
  if (!systemPrompt) {
    throw new Error("Entity missing insightSynthesisSystemPrompt");
  }

  const requestMessages = [
    {
      role: "user" as const,
      content: `Execute insight synthesis based on the classification decision.

## Classification Decision
${classificationReasoning}

## Current Knowledge Graph
${graphContext}

Analyze the existing knowledge in your graph and create Insight nodes that capture signals, observations, or patterns. Use the addInsightNode tool to create insights and addGraphEdge to connect them to relevant nodes.`,
    },
  ];

  // Create llm_interaction record
  const interaction = await createLLMInteraction({
    entityId: entity.id,
    workerIterationId,
    systemPrompt: systemPrompt,
    request: { messages: requestMessages },
    phase: "insight_synthesis",
  });

  // Get insight synthesis tools
  const toolContext: ToolContext = { entityId: entity.id };
  const tools = getInsightSynthesisTools();

  log(
    `[InsightSynthesis] Calling LLM with ${tools.length} tools for entity ${entity.name}`,
  );

  const { fullResponse } = await streamLLMResponseWithTools(
    requestMessages,
    systemPrompt,
    {
      tools,
      toolContext,
      entityId: entity.id,
      maxSteps: 10,
    },
  );

  const result = await fullResponse;

  await updateLLMInteraction(interaction.id, {
    response: {
      text: result.text,
      toolCalls: result.toolCalls,
      toolResults: result.toolResults,
      steps: result.steps,
    },
    completedAt: new Date(),
  });

  log(
    `[InsightSynthesis] Completed for entity ${entity.name}. ` +
      `Tool calls: ${result.toolCalls.length}, Response length: ${result.text.length}`,
  );
}

/**
 * Run the graph construction phase.
 * Gathers external knowledge via Tavily tools and populates the graph.
 */
async function runGraphConstructionPhase(
  entity: Entity,
  classificationReasoning: string,
  graphContext: string,
  workerIterationId: string,
): Promise<void> {
  log(`[GraphConstruction] Starting for entity: ${entity.name}`);

  const systemPrompt = entity.graphConstructionSystemPrompt;
  if (!systemPrompt) {
    throw new Error("Entity missing graphConstructionSystemPrompt");
  }

  const requestMessages = [
    {
      role: "user" as const,
      content: `Execute graph population based on the classification decision.

## Classification Decision
${classificationReasoning}

## Current Knowledge Graph
${graphContext}

Research and gather external information to fill knowledge gaps. Use Tavily tools (tavilySearch, tavilyExtract, tavilyResearch) to find information, then use addGraphNode and addGraphEdge to add the knowledge to your graph.`,
    },
  ];

  // Create llm_interaction record
  const interaction = await createLLMInteraction({
    entityId: entity.id,
    workerIterationId,
    systemPrompt: systemPrompt,
    request: { messages: requestMessages },
    phase: "graph_construction",
  });

  // Get graph construction tools
  const toolContext: ToolContext = { entityId: entity.id };
  const tools = getGraphConstructionTools();

  log(
    `[GraphConstruction] Calling LLM with ${tools.length} tools for entity ${entity.name}`,
  );

  const { fullResponse } = await streamLLMResponseWithTools(
    requestMessages,
    systemPrompt,
    {
      tools,
      toolContext,
      entityId: entity.id,
      maxSteps: 10,
    },
  );

  const result = await fullResponse;

  await updateLLMInteraction(interaction.id, {
    response: {
      text: result.text,
      toolCalls: result.toolCalls,
      toolResults: result.toolResults,
      steps: result.steps,
    },
    completedAt: new Date(),
  });

  log(
    `[GraphConstruction] Completed for entity ${entity.name}. ` +
      `Tool calls: ${result.toolCalls.length}, Response length: ${result.text.length}`,
  );
}

// ============================================================================
// Entity Iteration Processing
// ============================================================================

/**
 * Process one entity's iteration using the two-step classification -> action flow.
 *
 * Step 1: Classification - decide "synthesize" or "populate"
 * Step 2: Execute the appropriate action phase
 */
async function processEntityIteration(entity: Entity): Promise<void> {
  log(`Processing iteration for entity: ${entity.name} (${entity.id})`);

  // Create worker iteration record
  const workerIteration = await createWorkerIteration({
    entityId: entity.id,
  });
  log(`Created worker iteration: ${workerIteration.id}`);

  try {
    // Ensure graph types are initialized for this entity
    await ensureGraphTypesInitialized(
      entity.id,
      {
        name: entity.name,
        type: "entity", // Legacy field, can be anything
        purpose: entity.purpose,
      },
      { userId: entity.userId },
    );

    // Build graph context once (reused across phases)
    const graphContext = await buildGraphContextBlock(entity.id);

    // Step 1: CLASSIFICATION
    const classification = await runClassificationPhase(
      entity,
      graphContext,
      workerIteration.id,
    );

    // Update iteration with classification result
    await updateWorkerIteration(workerIteration.id, {
      classificationResult: classification.action,
      classificationReasoning: classification.reasoning,
    });

    // Step 2: EXECUTE ACTION based on classification
    if (classification.action === "synthesize") {
      await runInsightSynthesisPhase(
        entity,
        classification.reasoning,
        graphContext,
        workerIteration.id,
      );
    } else {
      await runGraphConstructionPhase(
        entity,
        classification.reasoning,
        graphContext,
        workerIteration.id,
      );
    }

    // Mark iteration as completed
    await updateWorkerIteration(workerIteration.id, {
      status: "completed",
      completedAt: new Date(),
    });

    log(`Completed two-step iteration for entity ${entity.name}`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logError(`Error in iteration for entity ${entity.name}:`, error);

    // Mark iteration as failed
    await updateWorkerIteration(workerIteration.id, {
      status: "failed",
      errorMessage: errorMsg,
      completedAt: new Date(),
    });
  }
}

// ============================================================================
// Main Runner Loop
// ============================================================================

/**
 * The main runner loop
 *
 * Polls for active entities and processes those that are due based on their
 * individual iteration intervals.
 */
export async function startRunner(): Promise<void> {
  log(
    "Worker runner started (two-step classification -> action flow, per-entity intervals)",
  );

  // Register all tools before starting
  const { registerTavilyTools } = await import("@/lib/llm/tools/tavily-tools");
  const { registerGraphTools } = await import("@/lib/llm/tools/graph-tools");
  const { registerInboxTools } = await import("@/lib/llm/tools/inbox-tools");

  registerTavilyTools();
  registerGraphTools();
  registerInboxTools();
  log("Tools registered: Tavily, Graph, and Inbox tools");

  while (!isShuttingDown) {
    try {
      // Get all active entities
      const entities = await getActiveEntities();

      if (entities.length > 0) {
        // Check each entity to see if it's due for processing
        for (const entity of entities) {
          if (isShuttingDown) break;

          const isDue = await isEntityDueForIteration(entity);
          if (isDue) {
            log(
              `Entity ${entity.name} is due (interval: ${entity.iterationIntervalMs / 1000}s)`,
            );
            await processEntityIteration(entity);
          }
        }
      }
    } catch (error) {
      logError("Runner error:", error);
    }

    // Poll again after a short interval (unless shutting down)
    if (!isShuttingDown) {
      await sleep(POLL_INTERVAL_MS);
    }
  }

  log("Runner loop stopped");
}

/**
 * Run a single cycle (useful for testing)
 */
export async function runSingleCycle(): Promise<void> {
  log("Running single cycle");

  // Register tools if not already registered
  const { registerTavilyTools } = await import("@/lib/llm/tools/tavily-tools");
  const { registerGraphTools } = await import("@/lib/llm/tools/graph-tools");
  const { registerInboxTools } = await import("@/lib/llm/tools/inbox-tools");

  registerTavilyTools();
  registerGraphTools();
  registerInboxTools();

  try {
    const entities = await getActiveEntities();

    for (const entity of entities) {
      await processEntityIteration(entity);
    }

    log("Single cycle complete");
  } catch (error) {
    logError("Single cycle error:", error);
  }
}
