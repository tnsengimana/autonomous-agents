/**
 * Briefings Database Queries
 */

import { and, desc, eq, ilike, or } from 'drizzle-orm';
import { db } from '../client';
import { briefings, teams, aides } from '../schema';
import type { Briefing } from '@/lib/types';

export type BriefingOwnerInfo = { teamId: string } | { aideId: string };

export async function createBriefing(data: {
  userId: string;
  agentId: string;
  title: string;
  summary: string;
  content: string;
} & BriefingOwnerInfo): Promise<Briefing> {
  const result = await db
    .insert(briefings)
    .values({
      userId: data.userId,
      teamId: 'teamId' in data ? data.teamId : null,
      aideId: 'aideId' in data ? data.aideId : null,
      agentId: data.agentId,
      title: data.title,
      summary: data.summary,
      content: data.content,
    })
    .returning();

  return result[0] as Briefing;
}

export async function getBriefingById(
  briefingId: string
): Promise<Briefing | null> {
  const result = await db
    .select()
    .from(briefings)
    .where(eq(briefings.id, briefingId))
    .limit(1);

  return (result[0] as Briefing) ?? null;
}

export async function getBriefingWithSource(briefingId: string): Promise<{
  briefing: Briefing;
  teamName: string | null;
  aideName: string | null;
} | null> {
  const result = await db
    .select({
      briefing: briefings,
      teamName: teams.name,
      aideName: aides.name,
    })
    .from(briefings)
    .leftJoin(teams, eq(briefings.teamId, teams.id))
    .leftJoin(aides, eq(briefings.aideId, aides.id))
    .where(eq(briefings.id, briefingId))
    .limit(1);

  if (!result[0]) {
    return null;
  }

  return {
    briefing: result[0].briefing as Briefing,
    teamName: result[0].teamName,
    aideName: result[0].aideName,
  };
}

export async function getRecentBriefingsByOwner(
  data: { userId: string } & BriefingOwnerInfo,
  limit = 5
): Promise<Briefing[]> {
  const ownerFilter =
    'teamId' in data
      ? eq(briefings.teamId, data.teamId)
      : eq(briefings.aideId, data.aideId);

  const result = await db
    .select()
    .from(briefings)
    .where(and(eq(briefings.userId, data.userId), ownerFilter))
    .orderBy(desc(briefings.createdAt))
    .limit(limit);

  return result as Briefing[];
}

export async function listBriefingsByOwner(
  data: { userId: string; query?: string } & BriefingOwnerInfo,
  limit = 20
): Promise<Briefing[]> {
  const ownerFilter =
    'teamId' in data
      ? eq(briefings.teamId, data.teamId)
      : eq(briefings.aideId, data.aideId);

  const searchQuery = data.query?.trim();
  const searchFilter = searchQuery
    ? or(
        ilike(briefings.title, `%${searchQuery}%`),
        ilike(briefings.summary, `%${searchQuery}%`)
      )
    : null;

  const filters = [eq(briefings.userId, data.userId), ownerFilter];
  if (searchFilter) {
    filters.push(searchFilter);
  }

  const result = await db
    .select()
    .from(briefings)
    .where(and(...filters))
    .orderBy(desc(briefings.createdAt))
    .limit(limit);

  return result as Briefing[];
}

export async function getBriefingByIdForOwner(data: {
  briefingId: string;
  userId: string;
} & BriefingOwnerInfo): Promise<Briefing | null> {
  const ownerFilter =
    'teamId' in data
      ? eq(briefings.teamId, data.teamId)
      : eq(briefings.aideId, data.aideId);

  const result = await db
    .select()
    .from(briefings)
    .where(
      and(
        eq(briefings.id, data.briefingId),
        eq(briefings.userId, data.userId),
        ownerFilter
      )
    )
    .limit(1);

  return (result[0] as Briefing) ?? null;
}
