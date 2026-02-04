import { eq, desc } from 'drizzle-orm';
import { db } from '../client';
import { conversations } from '../schema';
import type { Conversation } from '@/lib/types';

/**
 * Get a conversation by ID
 */
export async function getConversationById(
  conversationId: string
): Promise<Conversation | null> {
  const result = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Get the conversation for an entity (one conversation per entity)
 */
export async function getLatestConversation(
  entityId: string
): Promise<Conversation | null> {
  const result = await db
    .select()
    .from(conversations)
    .where(eq(conversations.entityId, entityId))
    .orderBy(desc(conversations.createdAt))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Get all conversations for an entity
 */
export async function getConversationsByEntityId(
  entityId: string
): Promise<Conversation[]> {
  return db
    .select()
    .from(conversations)
    .where(eq(conversations.entityId, entityId))
    .orderBy(desc(conversations.createdAt));
}

/**
 * Create a new conversation for an entity
 */
export async function createConversation(
  entityId: string
): Promise<Conversation> {
  const result = await db
    .insert(conversations)
    .values({ entityId })
    .returning();

  return result[0];
}

/**
 * Get or create a conversation for an entity
 * Creates a new conversation if none exists
 */
export async function getOrCreateConversation(
  entityId: string
): Promise<Conversation> {
  const existing = await getLatestConversation(entityId);
  if (existing) {
    return existing;
  }
  return createConversation(entityId);
}

/**
 * Update conversation timestamp
 */
export async function touchConversation(
  conversationId: string
): Promise<void> {
  await db
    .update(conversations)
    .set({ updatedAt: new Date() })
    .where(eq(conversations.id, conversationId));
}
