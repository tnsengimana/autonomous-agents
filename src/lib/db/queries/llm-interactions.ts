/**
 * LLM Interactions Database Queries
 *
 * Operations for tracking background LLM interactions.
 */

import { eq, desc } from 'drizzle-orm';
import { db } from '../client';
import { llmInteractions } from '../schema';

// ============================================================================
// Types
// ============================================================================

export interface LLMInteraction {
  id: string;
  entityId: string;
  systemPrompt: string;
  request: Record<string, unknown>;
  response: Record<string, unknown> | null;
  createdAt: Date;
  completedAt: Date | null;
}

export interface CreateLLMInteractionInput {
  entityId: string;
  systemPrompt: string;
  request: Record<string, unknown>;
  phase?: string; // 'classification' | 'insight_synthesis' | 'graph_construction' | 'conversation'
}

export interface UpdateLLMInteractionInput {
  response: Record<string, unknown>;
  completedAt: Date;
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Create a new LLM interaction record
 */
export async function createLLMInteraction(
  data: CreateLLMInteractionInput
): Promise<LLMInteraction> {
  const result = await db
    .insert(llmInteractions)
    .values({
      entityId: data.entityId,
      systemPrompt: data.systemPrompt,
      request: data.request,
      phase: data.phase,
    })
    .returning();

  const interaction = result[0];
  return {
    id: interaction.id,
    entityId: interaction.entityId,
    systemPrompt: interaction.systemPrompt,
    request: interaction.request as Record<string, unknown>,
    response: interaction.response as Record<string, unknown> | null,
    createdAt: interaction.createdAt,
    completedAt: interaction.completedAt,
  };
}

/**
 * Update an LLM interaction record with response and completion time
 */
export async function updateLLMInteraction(
  id: string,
  data: UpdateLLMInteractionInput
): Promise<void> {
  await db
    .update(llmInteractions)
    .set({
      response: data.response,
      completedAt: data.completedAt,
    })
    .where(eq(llmInteractions.id, id));
}

/**
 * Get LLM interactions for an entity, ordered by createdAt desc
 */
export async function getLLMInteractionsByEntity(
  entityId: string,
  limit: number = 50
): Promise<LLMInteraction[]> {
  const results = await db
    .select()
    .from(llmInteractions)
    .where(eq(llmInteractions.entityId, entityId))
    .orderBy(desc(llmInteractions.createdAt))
    .limit(limit);

  return results.map((row) => ({
    id: row.id,
    entityId: row.entityId,
    systemPrompt: row.systemPrompt,
    request: row.request as Record<string, unknown>,
    response: row.response as Record<string, unknown> | null,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
  }));
}

/**
 * Get a single LLM interaction by ID
 */
export async function getLLMInteractionById(
  id: string
): Promise<LLMInteraction | null> {
  const results = await db
    .select()
    .from(llmInteractions)
    .where(eq(llmInteractions.id, id))
    .limit(1);

  if (results.length === 0) {
    return null;
  }

  const row = results[0];
  return {
    id: row.id,
    entityId: row.entityId,
    systemPrompt: row.systemPrompt,
    request: row.request as Record<string, unknown>,
    response: row.response as Record<string, unknown> | null,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
  };
}
