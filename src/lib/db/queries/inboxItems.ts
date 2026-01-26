/**
 * Inbox Items Database Queries
 *
 * CRUD operations for inbox items (briefings, signals, alerts).
 */

import { eq, desc, and, isNull, count } from 'drizzle-orm';
import { db } from '../client';
import { inboxItems, teams, aides } from '../schema';
import type { InboxItem } from '@/lib/types';

/**
 * Owner info type for inbox items - exactly one of teamId or aideId must be set
 */
export type InboxItemOwnerInfo = { teamId: string } | { aideId: string };

/**
 * Get all inbox items for a user, sorted by creation date (newest first)
 */
export async function getInboxItemsByUserId(userId: string): Promise<InboxItem[]> {
  const result = await db
    .select()
    .from(inboxItems)
    .where(eq(inboxItems.userId, userId))
    .orderBy(desc(inboxItems.createdAt));

  return result as InboxItem[];
}

/**
 * Get inbox items for a specific team
 */
export async function getInboxItemsByTeamId(
  userId: string,
  teamId: string
): Promise<InboxItem[]> {
  const result = await db
    .select()
    .from(inboxItems)
    .where(and(eq(inboxItems.userId, userId), eq(inboxItems.teamId, teamId)))
    .orderBy(desc(inboxItems.createdAt));

  return result as InboxItem[];
}

/**
 * Get inbox items for a specific aide
 */
export async function getInboxItemsByAideId(
  userId: string,
  aideId: string
): Promise<InboxItem[]> {
  const result = await db
    .select()
    .from(inboxItems)
    .where(and(eq(inboxItems.userId, userId), eq(inboxItems.aideId, aideId)))
    .orderBy(desc(inboxItems.createdAt));

  return result as InboxItem[];
}

/**
 * Get unread inbox items count for a user
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const result = await db
    .select({ count: count() })
    .from(inboxItems)
    .where(and(eq(inboxItems.userId, userId), isNull(inboxItems.readAt)));

  return result[0]?.count ?? 0;
}

/**
 * Get a single inbox item by ID
 */
export async function getInboxItemById(itemId: string): Promise<InboxItem | null> {
  const result = await db
    .select()
    .from(inboxItems)
    .where(eq(inboxItems.id, itemId))
    .limit(1);

  return (result[0] as InboxItem) ?? null;
}

/**
 * Get an inbox item with its team/aide info
 */
export async function getInboxItemWithSource(itemId: string): Promise<{
  item: InboxItem;
  teamName: string | null;
  aideName: string | null;
} | null> {
  const result = await db
    .select({
      item: inboxItems,
      teamName: teams.name,
      aideName: aides.name,
    })
    .from(inboxItems)
    .leftJoin(teams, eq(inboxItems.teamId, teams.id))
    .leftJoin(aides, eq(inboxItems.aideId, aides.id))
    .where(eq(inboxItems.id, itemId))
    .limit(1);

  if (!result[0]) {
    return null;
  }

  return {
    item: result[0].item as InboxItem,
    teamName: result[0].teamName,
    aideName: result[0].aideName,
  };
}

/**
 * Get an inbox item with its team info
 * @deprecated Use getInboxItemWithSource instead
 */
export async function getInboxItemWithTeam(itemId: string): Promise<{
  item: InboxItem;
  teamName: string;
} | null> {
  const result = await db
    .select({
      item: inboxItems,
      teamName: teams.name,
    })
    .from(inboxItems)
    .innerJoin(teams, eq(inboxItems.teamId, teams.id))
    .where(eq(inboxItems.id, itemId))
    .limit(1);

  if (!result[0]) {
    return null;
  }

  return {
    item: result[0].item as InboxItem,
    teamName: result[0].teamName,
  };
}

/**
 * Create a new inbox item
 */
export async function createInboxItem(data: {
  userId: string;
  agentId: string;
  type: string;
  title: string;
  content: string;
} & InboxItemOwnerInfo): Promise<InboxItem> {
  const result = await db
    .insert(inboxItems)
    .values({
      userId: data.userId,
      teamId: 'teamId' in data ? data.teamId : null,
      aideId: 'aideId' in data ? data.aideId : null,
      agentId: data.agentId,
      type: data.type,
      title: data.title,
      content: data.content,
    })
    .returning();

  return result[0] as InboxItem;
}

/**
 * Mark an inbox item as read
 */
export async function markAsRead(itemId: string): Promise<void> {
  await db
    .update(inboxItems)
    .set({ readAt: new Date() })
    .where(eq(inboxItems.id, itemId));
}

/**
 * Mark an inbox item as unread
 */
export async function markAsUnread(itemId: string): Promise<void> {
  await db
    .update(inboxItems)
    .set({ readAt: null })
    .where(eq(inboxItems.id, itemId));
}

/**
 * Delete an inbox item
 */
export async function deleteInboxItem(itemId: string): Promise<void> {
  await db.delete(inboxItems).where(eq(inboxItems.id, itemId));
}

/**
 * Mark all inbox items as read for a user
 */
export async function markAllAsRead(userId: string): Promise<void> {
  await db
    .update(inboxItems)
    .set({ readAt: new Date() })
    .where(and(eq(inboxItems.userId, userId), isNull(inboxItems.readAt)));
}

/**
 * Get recent inbox items for a user (for inbox preview)
 */
export async function getRecentInboxItems(
  userId: string,
  limit: number = 5
): Promise<InboxItem[]> {
  const result = await db
    .select()
    .from(inboxItems)
    .where(eq(inboxItems.userId, userId))
    .orderBy(desc(inboxItems.createdAt))
    .limit(limit);

  return result as InboxItem[];
}

/**
 * Get inbox items with team/aide names
 * Uses LEFT JOINs to support items from both teams and aides
 */
export async function getInboxItemsWithSources(userId: string): Promise<
  Array<{
    item: InboxItem;
    teamName: string | null;
    aideName: string | null;
  }>
> {
  const result = await db
    .select({
      item: inboxItems,
      teamName: teams.name,
      aideName: aides.name,
    })
    .from(inboxItems)
    .leftJoin(teams, eq(inboxItems.teamId, teams.id))
    .leftJoin(aides, eq(inboxItems.aideId, aides.id))
    .where(eq(inboxItems.userId, userId))
    .orderBy(desc(inboxItems.createdAt));

  return result.map((r) => ({
    item: r.item as InboxItem,
    teamName: r.teamName,
    aideName: r.aideName,
  }));
}

/**
 * Get inbox items with team names
 * @deprecated Use getInboxItemsWithSources instead
 */
export async function getInboxItemsWithTeams(userId: string): Promise<
  Array<{
    item: InboxItem;
    teamName: string;
  }>
> {
  const result = await db
    .select({
      item: inboxItems,
      teamName: teams.name,
    })
    .from(inboxItems)
    .innerJoin(teams, eq(inboxItems.teamId, teams.id))
    .where(eq(inboxItems.userId, userId))
    .orderBy(desc(inboxItems.createdAt));

  return result.map((r) => ({
    item: r.item as InboxItem,
    teamName: r.teamName,
  }));
}
