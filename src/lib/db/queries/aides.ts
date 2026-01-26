/**
 * Aides Database Queries
 *
 * CRUD operations for aides (personal professional extensions).
 * Parallel to teams.ts but for aides.
 */

import { eq, desc, and } from 'drizzle-orm';
import { db } from '../client';
import { aides, agents } from '../schema';
import type { Agent } from '@/lib/types';

// ============================================================================
// Types
// ============================================================================

export type AideStatus = 'active' | 'paused' | 'archived';

export interface Aide {
  id: string;
  userId: string;
  name: string;
  purpose: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AideWithAgents extends Aide {
  agents: Agent[];
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Create a new aide
 */
export async function createAide(data: {
  userId: string;
  name: string;
  purpose?: string | null;
  status?: AideStatus;
}): Promise<Aide> {
  const result = await db
    .insert(aides)
    .values({
      userId: data.userId,
      name: data.name,
      purpose: data.purpose ?? null,
      status: data.status ?? 'active',
    })
    .returning();

  return result[0];
}

/**
 * Get an aide by ID
 */
export async function getAideById(aideId: string): Promise<Aide | null> {
  const result = await db
    .select()
    .from(aides)
    .where(eq(aides.id, aideId))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Get all aides for a user
 */
export async function getAidesByUserId(userId: string): Promise<Aide[]> {
  return db
    .select()
    .from(aides)
    .where(eq(aides.userId, userId))
    .orderBy(desc(aides.createdAt));
}

/**
 * Get active aides for a user
 */
export async function getActiveAidesByUserId(userId: string): Promise<Aide[]> {
  return db
    .select()
    .from(aides)
    .where(and(eq(aides.userId, userId), eq(aides.status, 'active')))
    .orderBy(desc(aides.createdAt));
}

/**
 * Update aide details
 */
export async function updateAide(
  aideId: string,
  data: {
    name?: string;
    purpose?: string | null;
    status?: AideStatus;
  }
): Promise<void> {
  await db
    .update(aides)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(aides.id, aideId));
}

/**
 * Update aide status
 */
export async function updateAideStatus(
  aideId: string,
  status: AideStatus
): Promise<void> {
  await db
    .update(aides)
    .set({ status, updatedAt: new Date() })
    .where(eq(aides.id, aideId));
}

/**
 * Activate an aide (set status to 'active')
 */
export async function activateAide(aideId: string): Promise<void> {
  await updateAideStatus(aideId, 'active');
}

/**
 * Delete an aide (cascades to agents, conversations, etc.)
 */
export async function deleteAide(aideId: string): Promise<void> {
  await db.delete(aides).where(eq(aides.id, aideId));
}

/**
 * Get the user ID for an aide
 */
export async function getAideUserId(aideId: string): Promise<string | null> {
  const result = await db
    .select({ userId: aides.userId })
    .from(aides)
    .where(eq(aides.id, aideId))
    .limit(1);

  return result[0]?.userId ?? null;
}

/**
 * Get the lead agent (parentAgentId is null) for an aide
 */
export async function getAideLead(aideId: string): Promise<Agent | null> {
  const { isNull } = await import('drizzle-orm');

  const result = await db
    .select()
    .from(agents)
    .where(and(eq(agents.aideId, aideId), isNull(agents.parentAgentId)))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Get an aide with its agents
 */
export async function getAideWithAgents(
  aideId: string
): Promise<AideWithAgents | null> {
  const aide = await getAideById(aideId);
  if (!aide) {
    return null;
  }

  const aideAgents = await db
    .select()
    .from(agents)
    .where(eq(agents.aideId, aideId));

  return {
    ...aide,
    agents: aideAgents,
  };
}
