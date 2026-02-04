import { eq, desc, and, inArray } from 'drizzle-orm';
import { db } from '../client';
import { memories } from '../schema';
import type { Memory, MemoryType, ExtractedMemory } from '@/lib/types';

/**
 * Get a memory by ID
 */
export async function getMemoryById(memoryId: string): Promise<Memory | null> {
  const result = await db
    .select()
    .from(memories)
    .where(eq(memories.id, memoryId))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Get all memories for an entity
 */
export async function getMemoriesByEntityId(entityId: string): Promise<Memory[]> {
  return db
    .select()
    .from(memories)
    .where(eq(memories.entityId, entityId))
    .orderBy(desc(memories.createdAt));
}

/**
 * Get memories for an entity filtered by type
 */
export async function getMemoriesByType(
  entityId: string,
  type: MemoryType
): Promise<Memory[]> {
  return db
    .select()
    .from(memories)
    .where(and(eq(memories.entityId, entityId), eq(memories.type, type)))
    .orderBy(desc(memories.createdAt));
}

/**
 * Get memories for an entity filtered by multiple types
 */
export async function getMemoriesByTypes(
  entityId: string,
  types: MemoryType[]
): Promise<Memory[]> {
  return db
    .select()
    .from(memories)
    .where(and(eq(memories.entityId, entityId), inArray(memories.type, types)))
    .orderBy(desc(memories.createdAt));
}

/**
 * Get the most recent N memories for an entity
 */
export async function getRecentMemories(
  entityId: string,
  limit: number
): Promise<Memory[]> {
  return db
    .select()
    .from(memories)
    .where(eq(memories.entityId, entityId))
    .orderBy(desc(memories.createdAt))
    .limit(limit);
}

/**
 * Create a new memory
 */
export async function createMemory(data: {
  entityId: string;
  type: MemoryType;
  content: string;
  sourceMessageId?: string | null;
}): Promise<Memory> {
  const result = await db
    .insert(memories)
    .values({
      entityId: data.entityId,
      type: data.type,
      content: data.content,
      sourceMessageId: data.sourceMessageId ?? null,
    })
    .returning();

  return result[0];
}

/**
 * Create multiple memories at once
 */
export async function createMemories(
  entityId: string,
  extractedMemories: ExtractedMemory[],
  sourceMessageId?: string | null
): Promise<Memory[]> {
  if (extractedMemories.length === 0) {
    return [];
  }

  const result = await db
    .insert(memories)
    .values(
      extractedMemories.map((m) => ({
        entityId,
        type: m.type,
        content: m.content,
        sourceMessageId: sourceMessageId ?? null,
      }))
    )
    .returning();

  return result;
}

/**
 * Update a memory's content
 */
export async function updateMemory(
  memoryId: string,
  content: string
): Promise<void> {
  await db
    .update(memories)
    .set({ content, updatedAt: new Date() })
    .where(eq(memories.id, memoryId));
}

/**
 * Delete a memory
 */
export async function deleteMemory(memoryId: string): Promise<void> {
  await db.delete(memories).where(eq(memories.id, memoryId));
}

/**
 * Delete all memories for an entity
 */
export async function deleteEntityMemories(entityId: string): Promise<void> {
  await db.delete(memories).where(eq(memories.entityId, entityId));
}
