# Plan 9: Aides Feature

## Overview

Add a new "Aides" feature that works like teams but with different semantics. Aides are personal professional extensions of the user (e.g., portfolio manager, research aide), while teams represent external organizations/groups (e.g., engineering org).

**Key principle**: Technically identical to teams now, but separated to allow independent evolution of setup, lifecycle, and behavior.

## Terminology

- **Aide**: The top-level entity (parallel to Team)
- **Lead Agent**: The primary agent for an aide (parentAgentId = null)
- **Subordinate Agents**: Supporting agents under the lead (parentAgentId = lead's id)

## Design Decisions

### 1. Schema Approach: Nullable Foreign Keys with Check Constraint

Rather than polymorphic patterns or separate agent tables, we'll:
- Add `aideId` column to `agents` table (nullable)
- Make `teamId` nullable
- Add check constraint: exactly one of `teamId` or `aideId` must be set

This keeps agents unified while supporting both ownership types.

### 2. Parallel Tables Needing aideId Support

Tables that currently reference `teamId` need parallel `aideId` support:
- `agents` - which aide/team owns this agent
- `agentTasks` - task grouping by aide/team
- `inboxItems` - briefings grouped by aide/team

### 3. Shared Infrastructure (No Changes Needed)

These remain unchanged as they reference agents, not teams/aides directly:
- `conversations` - references agentId
- `messages` - references conversationId
- `memories` - references agentId
- `knowledgeItems` - references agentId

### 4. Worker Changes

The worker queries for agents needing work. It doesn't care about team vs aide - it just processes agents. Minimal changes needed (possibly none for initial implementation).

### 5. Additional Files Needing Updates

Files that reference `teamId` and need parallel `aideId` support:

**Database Queries:**
- `src/lib/db/queries/agents.ts` - `getActiveTeamLeads()`, `getTeamLeadsDueToRun()` need `getActiveAideLeads()` and `getAideLeadsDueToRun()` equivalents, or refactored to be owner-agnostic

**Agent Tools:**
- `src/lib/agents/tools/team-lead-tools.ts` - `createInboxItemTool` hardcodes `teamId: context.teamId`; needs to use owner info
- `src/lib/agents/tools/index.ts` - `ToolContext` interface has `teamId: string`; needs `aideId?: string` or use owner pattern

**Types:**
- `src/lib/types.ts` - `InboxItem` interface has `teamId: string`; needs to support both

**Worker:**
- `src/worker/runner.ts` - `getAgentsNeedingWork()` calls `getTeamLeadsDueToRun()` which only returns team leads; needs to include aide leads

---

## Implementation Steps

### Phase 1: Database Schema

#### 1.1 Create `aides` table

```typescript
// In src/lib/db/schema.ts
export const aides = pgTable('aides', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  purpose: text('purpose'),
  status: text('status').notNull().default('active'), // 'active', 'paused', 'archived'
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
});
```

#### 1.2 Modify `agents` table

```typescript
// Change teamId to nullable, add aideId
export const agents = pgTable('agents', {
  id: uuid('id').primaryKey().defaultRandom(),
  teamId: uuid('team_id')
    .references(() => teams.id, { onDelete: 'cascade' }), // NOW NULLABLE
  aideId: uuid('aide_id')
    .references(() => aides.id, { onDelete: 'cascade' }), // NEW
  parentAgentId: uuid('parent_agent_id').references((): AnyPgColumn => agents.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  role: text('role').notNull(),
  systemPrompt: text('system_prompt'),
  status: text('status').notNull().default('idle'),
  nextRunAt: timestamp('next_run_at', { mode: 'date' }),
  lastCompletedAt: timestamp('last_completed_at', { mode: 'date' }),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
}, (table) => [
  index('agents_next_run_at_idx').on(table.nextRunAt),
  index('agents_aide_id_idx').on(table.aideId), // NEW INDEX
]);
```

**Note**: Check constraint (exactly one of teamId/aideId) will be added via raw SQL in migration since Drizzle doesn't support check constraints declaratively.

#### 1.3 Modify `agentTasks` table

```typescript
export const agentTasks = pgTable('agent_tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  teamId: uuid('team_id')
    .references(() => teams.id, { onDelete: 'cascade' }), // NOW NULLABLE
  aideId: uuid('aide_id')
    .references(() => aides.id, { onDelete: 'cascade' }), // NEW
  assignedToId: uuid('assigned_to_id')
    .notNull()
    .references(() => agents.id, { onDelete: 'cascade' }),
  assignedById: uuid('assigned_by_id')
    .notNull()
    .references(() => agents.id, { onDelete: 'cascade' }),
  task: text('task').notNull(),
  result: text('result'),
  status: text('status').notNull().default('pending'),
  source: text('source').notNull().default('delegation'),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { mode: 'date' }),
});
```

#### 1.4 Modify `inboxItems` table

```typescript
export const inboxItems = pgTable('inbox_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  teamId: uuid('team_id')
    .references(() => teams.id, { onDelete: 'cascade' }), // NOW NULLABLE
  aideId: uuid('aide_id')
    .references(() => aides.id, { onDelete: 'cascade' }), // NEW
  agentId: uuid('agent_id')
    .notNull()
    .references(() => agents.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  readAt: timestamp('read_at', { mode: 'date' }),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});
```

#### 1.5 Add Relations

```typescript
export const aidesRelations = relations(aides, ({ one, many }) => ({
  user: one(users, {
    fields: [aides.userId],
    references: [users.id],
  }),
  agents: many(agents),
  inboxItems: many(inboxItems),
  agentTasks: many(agentTasks),
}));

// Update usersRelations to include aides
export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  apiKeys: many(userApiKeys),
  teams: many(teams),
  aides: many(aides), // NEW
  inboxItems: many(inboxItems),
}));

// Update agentsRelations to include aide
export const agentsRelations = relations(agents, ({ one, many }) => ({
  team: one(teams, {
    fields: [agents.teamId],
    references: [teams.id],
  }),
  aide: one(aides, { // NEW
    fields: [agents.aideId],
    references: [aides.id],
  }),
  // ... rest unchanged
}));

// Update inboxItemsRelations
export const inboxItemsRelations = relations(inboxItems, ({ one }) => ({
  user: one(users, {
    fields: [inboxItems.userId],
    references: [users.id],
  }),
  team: one(teams, {
    fields: [inboxItems.teamId],
    references: [teams.id],
  }),
  aide: one(aides, { // NEW
    fields: [inboxItems.aideId],
    references: [aides.id],
  }),
  agent: one(agents, {
    fields: [inboxItems.agentId],
    references: [agents.id],
  }),
}));

// Update agentTasksRelations
export const agentTasksRelations = relations(agentTasks, ({ one }) => ({
  team: one(teams, {
    fields: [agentTasks.teamId],
    references: [teams.id],
  }),
  aide: one(aides, { // NEW
    fields: [agentTasks.aideId],
    references: [aides.id],
  }),
  // ... rest unchanged
}));
```

#### 1.6 Migration

After schema changes, generate migration:
```bash
npx drizzle-kit generate
```

Then manually add check constraints to the generated migration:
```sql
-- Ensure exactly one of teamId or aideId is set on agents
ALTER TABLE agents ADD CONSTRAINT agents_owner_check
  CHECK ((team_id IS NOT NULL AND aide_id IS NULL) OR (team_id IS NULL AND aide_id IS NOT NULL));

-- Ensure exactly one of teamId or aideId is set on agent_tasks
ALTER TABLE agent_tasks ADD CONSTRAINT agent_tasks_owner_check
  CHECK ((team_id IS NOT NULL AND aide_id IS NULL) OR (team_id IS NULL AND aide_id IS NOT NULL));

-- Ensure exactly one of teamId or aideId is set on inbox_items
ALTER TABLE inbox_items ADD CONSTRAINT inbox_items_owner_check
  CHECK ((team_id IS NOT NULL AND aide_id IS NULL) OR (team_id IS NULL AND aide_id IS NOT NULL));
```

---

### Phase 2: Database Queries

#### 2.1 Create `src/lib/db/queries/aides.ts`

Parallel to `teams.ts`:

```typescript
import { db } from '../index';
import { aides } from '../schema';
import { eq } from 'drizzle-orm';

export async function createAide(data: {
  userId: string;
  name: string;
  purpose?: string;
  status?: string;
}) {
  const [aide] = await db.insert(aides).values(data).returning();
  return aide;
}

export async function getAideById(id: string) {
  return db.query.aides.findFirst({
    where: eq(aides.id, id),
  });
}

export async function getAidesByUserId(userId: string) {
  return db.query.aides.findMany({
    where: eq(aides.userId, userId),
    orderBy: (aides, { desc }) => [desc(aides.createdAt)],
  });
}

export async function updateAide(id: string, data: Partial<{
  name: string;
  purpose: string;
  status: string;
}>) {
  const [aide] = await db.update(aides)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(aides.id, id))
    .returning();
  return aide;
}

export async function deleteAide(id: string) {
  await db.delete(aides).where(eq(aides.id, id));
}

export async function getAideLead(aideId: string) {
  // Get the lead agent (parentAgentId is null) for this aide
  return db.query.agents.findFirst({
    where: (agents, { eq, and, isNull }) => and(
      eq(agents.aideId, aideId),
      isNull(agents.parentAgentId)
    ),
  });
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
 * Get aide with its agents
 */
export async function getAideWithAgents(aideId: string): Promise<AideWithAgents | null> {
  const aide = await getAideById(aideId);
  if (!aide) return null;

  const aideAgents = await db
    .select()
    .from(agents)
    .where(eq(agents.aideId, aideId));

  return {
    ...aide,
    agents: aideAgents,
  };
}
```

#### 2.2 Update `src/lib/db/queries/agents.ts`

Add functions that work with aideId:

```typescript
// Add to existing file
export async function createAgentForAide(data: {
  aideId: string;
  parentAgentId: string | null;
  name: string;
  role: string;
  systemPrompt?: string;
  status?: string;
}) {
  const [agent] = await db.insert(agents).values({
    ...data,
    teamId: null, // Explicitly null for aide agents
  }).returning();
  return agent;
}

export async function getAgentsByAideId(aideId: string) {
  return db.query.agents.findMany({
    where: eq(agents.aideId, aideId),
    orderBy: (agents, { asc }) => [asc(agents.createdAt)],
  });
}
```

#### 2.3 Update `src/lib/db/queries/agentTasks.ts`

Add aideId support to task creation functions.

#### 2.4 Update `src/lib/db/queries/inboxItems.ts`

Add aideId support to inbox item creation and queries.

#### 2.5 Update `src/lib/db/queries/index.ts`

Export the new aides queries.

---

### Phase 3: Aide Configuration

#### 3.1 Create `src/lib/agents/aide-configuration.ts`

```typescript
import { z } from 'zod';
import { generateLLMObject } from './llm';

const AideConfigurationSchema = z.object({
  aideDescription: z.string().describe('A one sentence description of what this aide does'),
  leadAgentName: z.string().describe('A professional name for the aide (the lead agent)'),
  leadAgentSystemPrompt: z.string().describe('System prompt defining the aide personality and approach'),
});

export type AideConfiguration = z.infer<typeof AideConfigurationSchema>;

export async function generateAideConfiguration(
  aideName: string,
  purpose: string,
  options?: { userId?: string }
): Promise<AideConfiguration> {
  const systemPrompt = `You are an aide configuration assistant. Given an aide name and purpose, generate the configuration for a personal AI aide.

An aide is a professional extension of the user - like having a personal portfolio manager, research assistant, or specialist who works on your behalf.

Generate:
1. **aideDescription**: A one sentence description of what this aide does for the user
2. **leadAgentName**: A professional, friendly name for the aide (e.g., "Alex", "Jordan", "Morgan", "Taylor")
3. **leadAgentSystemPrompt**: A detailed system prompt that defines:
   - The aide's role and expertise as a personal professional
   - Their approach to serving the user
   - How they should communicate (professional but personable)
   - Key responsibilities and areas of focus

The system prompt should emphasize that this aide works directly for the user as their personal professional in this domain. It should be comprehensive (3-5 paragraphs).`;

  const userPrompt = `Aide Name: ${aideName}
Purpose: ${purpose}

Generate the aide configuration.`;

  return generateLLMObject(
    [{ role: 'user', content: userPrompt }],
    AideConfigurationSchema,
    systemPrompt,
    {
      temperature: 0.7,
      userId: options?.userId,
    }
  );
}
```

---

### Phase 4: API Routes

#### 4.1 Create `src/app/api/aides/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { createAide, getAidesByUserId } from '@/lib/db/queries/aides';
import { createAgentForAide } from '@/lib/db/queries/agents';
import { queueSystemTask } from '@/lib/agents/taskQueue';
import { generateAideConfiguration } from '@/lib/agents/aide-configuration';
import { z } from 'zod';

const createAideSchema = z.object({
  name: z.string().min(1, 'Aide name is required'),
  purpose: z.string().min(1, 'Purpose is required'),
});

// GET /api/aides - List all aides for the current user
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const aides = await getAidesByUserId(session.user.id);

    // Fetch agent counts for each aide
    const aidesWithAgentCount = await Promise.all(
      aides.map(async (aide) => {
        const agents = await getAgentsByAideId(aide.id);
        return {
          ...aide,
          agentCount: agents.length,
        };
      })
    );

    return NextResponse.json(aidesWithAgentCount);
  } catch (error) {
    console.error('Error fetching aides:', error);
    return NextResponse.json({ error: 'Failed to fetch aides' }, { status: 500 });
  }
}

// POST /api/aides - Create a new aide with a lead agent
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validation = createAideSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const { name, purpose } = validation.data;

    // Generate aide configuration using LLM
    const config = await generateAideConfiguration(name, purpose, { userId: session.user.id });

    // Create the aide
    const aide = await createAide({
      userId: session.user.id,
      name,
      purpose: `${config.aideDescription}\n\nPurpose: ${purpose}`,
      status: 'active',
    });

    // Create the lead agent
    const aideLead = await createAgentForAide({
      aideId: aide.id,
      parentAgentId: null,
      name: config.leadAgentName,
      role: 'aide_lead',
      systemPrompt: config.leadAgentSystemPrompt,
      status: 'idle',
    });

    // Queue bootstrap task
    await queueSystemTask(
      aideLead.id,
      { aideId: aide.id },
      'Get to work on your purpose. Review what the user needs and start serving them.'
    );

    return NextResponse.json(aide, { status: 201 });
  } catch (error) {
    console.error('Error creating aide:', error);
    return NextResponse.json({ error: 'Failed to create aide' }, { status: 500 });
  }
}
```

#### 4.2 Create `src/app/api/aides/[id]/route.ts`

Individual aide operations:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { getAideById, updateAide, deleteAide, getAideWithAgents } from '@/lib/db/queries/aides';
import { z } from 'zod';

// GET /api/aides/[id] - Get aide details with agents
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const aide = await getAideWithAgents(id);

    if (!aide || aide.userId !== session.user.id) {
      return NextResponse.json({ error: 'Aide not found' }, { status: 404 });
    }

    return NextResponse.json(aide);
  } catch (error) {
    console.error('Error fetching aide:', error);
    return NextResponse.json({ error: 'Failed to fetch aide' }, { status: 500 });
  }
}

// PATCH /api/aides/[id] - Update aide
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Similar to teams PATCH
}

// DELETE /api/aides/[id] - Delete aide
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Similar to teams DELETE
}
```

#### 4.3 Create `src/app/api/aides/[id]/agents/route.ts`

Add subordinate agents to an aide:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { getAideById } from '@/lib/db/queries/aides';
import { createAgentForAide, getAgentsByAideId } from '@/lib/db/queries/agents';
import { z } from 'zod';

// GET /api/aides/[id]/agents - List agents for aide
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Similar to teams agents GET
}

// POST /api/aides/[id]/agents - Add subordinate agent
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Similar to teams agents POST but uses createAgentForAide
  // and sets parentAgentId to the aide lead
}
```

#### 4.4 Update `src/app/api/messages/route.ts`

The messages API needs to support both teams and aides:

```typescript
// Current: only accepts teamId
// Updated: accept teamId OR aideId

export async function POST(request: NextRequest) {
  // ...
  const body = await request.json();
  const { teamId, aideId, agentId, content } = body;

  // Validate: exactly one of teamId or aideId
  if ((!teamId && !aideId) || (teamId && aideId)) {
    return NextResponse.json(
      { error: 'Exactly one of teamId or aideId is required' },
      { status: 400 }
    );
  }

  // Verify ownership based on which was provided
  if (teamId) {
    const team = await getTeamById(teamId);
    if (!team || team.userId !== session.user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
  } else {
    const aide = await getAideById(aideId);
    if (!aide || aide.userId !== session.user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
  }

  // Get agent and verify it belongs to the correct owner
  // ...
}
```

#### 4.5 Update `src/components/chat/Chat.tsx`

Update Chat component to accept either teamId or aideId:

```typescript
export interface ChatProps {
  teamId?: string;   // NOW OPTIONAL
  aideId?: string;   // NEW
  agentId?: string;
  // ... rest unchanged
}

export function Chat({
  teamId,
  aideId,
  // ...
}: ChatProps) {
  // In handleSendMessage:
  body: JSON.stringify({
    ...(teamId ? { teamId } : { aideId }),
    agentId,
    content,
  }),
}
```

---

### Phase 5: Task Queue Updates

#### 5.1 Update `src/lib/agents/taskQueue.ts`

Modify task queuing functions to accept either teamId or aideId:

```typescript
// Update function signatures to support both
export async function queueUserTask(
  agentId: string,
  ownerInfo: { teamId: string } | { aideId: string },
  userMessage: string
) {
  // ... implementation
}

export async function queueSystemTask(
  agentId: string,
  ownerInfo: { teamId: string } | { aideId: string },
  content: string
) {
  // ... implementation
}

// Similar updates for other queue functions
```

---

### Phase 6: Agent Class and Types Updates

#### 6.1 Update `src/lib/types.ts`

Update the `InboxItem` interface to support both teams and aides:

```typescript
export interface InboxItem {
  id: string;
  userId: string;
  teamId: string | null;    // NOW NULLABLE
  aideId: string | null;    // NEW
  agentId: string;
  type: InboxItemType;
  title: string;
  content: string;
  readAt: Date | null;
  createdAt: Date;
}
```

Add `Aide` type:

```typescript
export type Aide = InferSelectModel<typeof aides>;

export interface AideWithAgents extends Aide {
  agents: Agent[];
}
```

#### 6.2 Update `src/lib/agents/tools/index.ts`

Update `ToolContext` to support both ownership types:

```typescript
export interface ToolContext {
  agentId: string;
  ownerInfo: { teamId: string } | { aideId: string };  // CHANGED from teamId
  isTeamLead: boolean;
}

// Or alternatively, keep teamId but add aideId:
export interface ToolContext {
  agentId: string;
  teamId: string | null;
  aideId: string | null;
  isTeamLead: boolean;
}
```

#### 6.3 Update `src/lib/agents/tools/team-lead-tools.ts`

Update `createInboxItemTool` to use the owner info pattern:

```typescript
// In handler:
const inboxData: {
  userId: string;
  agentId: string;
  type: string;
  title: string;
  content: string;
  teamId?: string;
  aideId?: string;
} = {
  userId,
  agentId: context.agentId,
  type,
  title,
  content: summary,
};

// Use owner info
if ('teamId' in context.ownerInfo) {
  inboxData.teamId = context.ownerInfo.teamId;
} else {
  inboxData.aideId = context.ownerInfo.aideId;
}

const result = await db.insert(inboxItems).values(inboxData).returning();
```

Also update `getTeamUserId` call to handle aides:

```typescript
// Need a helper function
async function getOwnerUserId(ownerInfo: { teamId: string } | { aideId: string }): Promise<string | null> {
  if ('teamId' in ownerInfo) {
    return getTeamUserId(ownerInfo.teamId);
  }
  return getAideUserId(ownerInfo.aideId);
}
```

#### 6.4 Update `src/lib/agents/agent.ts`

The Agent class needs to know whether it belongs to a team or aide for task queuing and inbox items:

```typescript
export class Agent {
  readonly id: string;
  readonly teamId: string | null;   // NOW NULLABLE
  readonly aideId: string | null;   // NEW
  readonly name: string;
  readonly role: string;
  readonly systemPrompt: string;
  readonly parentAgentId: string | null;

  // Update constructor to load aideId from data

  // Add helper
  getOwnerInfo(): { teamId: string } | { aideId: string } {
    if (this.teamId) return { teamId: this.teamId };
    if (this.aideId) return { aideId: this.aideId };
    throw new Error('Agent has no team or aide');
  }

  // Update methods that create tasks or inbox items to use getOwnerInfo()
}
```

Update all places that currently use `this.teamId` for task queuing:

```typescript
// In handleUserMessage():
await queueUserTask(this.id, this.getOwnerInfo(), content);

// In decideBriefing():
// Update getTeamUserId to use owner-agnostic helper
const userId = await getOwnerUserId(this.getOwnerInfo());
```

---

### Phase 7: UI Pages

#### 7.1 Create Aides List Page

`src/app/(dashboard)/aides/page.tsx` - List all user's aides

#### 7.2 Create New Aide Page

`src/app/(dashboard)/aides/new/page.tsx` - Create new aide form

#### 7.3 Create Aide Detail Page

`src/app/(dashboard)/aides/[id]/page.tsx` - View aide details

#### 7.4 Create Aide Chat Page

`src/app/(dashboard)/aides/[id]/chat/page.tsx` - Chat with aide lead

#### 7.5 Create Aide Agents Pages

- `src/app/(dashboard)/aides/[id]/agents/page.tsx` - List subordinates
- `src/app/(dashboard)/aides/[id]/agents/new/page.tsx` - Add subordinate
- `src/app/(dashboard)/aides/[id]/agents/[agentId]/page.tsx` - Agent detail
- `src/app/(dashboard)/aides/[id]/agents/[agentId]/chat/page.tsx` - Chat with subordinate
- `src/app/(dashboard)/aides/[id]/agents/[agentId]/edit/page.tsx` - Edit subordinate
- `src/app/(dashboard)/aides/[id]/agents/[agentId]/inspect/page.tsx` - Inspect background

---

### Phase 8: Navigation Updates

#### 8.1 Update Dashboard Layout/Navigation

Add "Aides" section to sidebar navigation alongside "Teams".

#### 8.2 Update Inbox

The inbox must support items from both teams and aides. This requires several changes:

**8.2.1 Update `InboxItem` interface** in `src/app/(dashboard)/inbox/page.tsx`:

```typescript
interface InboxItem {
  id: string;
  type: string;
  title: string;
  content: string;
  teamId: string | null;      // Now nullable
  teamName: string | null;    // Now nullable
  aideId: string | null;      // NEW
  aideName: string | null;    // NEW
  agentId: string;
  read: boolean;
  readAt: string | null;
  createdAt: string;
}
```

**8.2.2 Update conversation link** to redirect to correct path:

Current (line 348):
```typescript
<Link href={`/teams/${selectedItem.teamId}/chat`}>
```

Updated to use full agent path (consistent for both teams and aides):
```typescript
<Link href={
  selectedItem.teamId
    ? `/teams/${selectedItem.teamId}/agents/${selectedItem.agentId}/chat`
    : `/aides/${selectedItem.aideId}/agents/${selectedItem.agentId}/chat`
}>
```

**Note**: Delete the `/teams/[id]/chat` route (`src/app/(dashboard)/teams/[id]/chat/page.tsx`) as it's now redundant. All chat access should go through the full agent path.

**8.2.3 Update source display** (lines 279, 304, 332-335):

Replace `teamName` references with conditional display:
```typescript
// Helper function
function getSourceName(item: InboxItem): string {
  return item.teamName ?? item.aideName ?? 'Unknown';
}

function getSourceLabel(item: InboxItem): string {
  return item.teamId ? 'Team' : 'Aide';
}

// Usage in detail view
<p>
  <span className="font-medium">{getSourceLabel(selectedItem)}:</span>{" "}
  {getSourceName(selectedItem)}
</p>
```

**8.2.4 Update `src/lib/db/queries/inboxItems.ts`**

The `getInboxItemsWithTeams` function currently uses `innerJoin` which won't work for aide items. Rename and update to support both:

```typescript
/**
 * Get inbox items with team/aide names
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
```

Also update `createInboxItem` to accept either teamId or aideId:

```typescript
export async function createInboxItem(data: {
  userId: string;
  agentId: string;
  type: string;
  title: string;
  content: string;
} & ({ teamId: string } | { aideId: string })): Promise<InboxItem> {
  // ... implementation
}
```

**8.2.5 Update inbox API** (`/api/inbox/route.ts`):

```typescript
// Update response mapping
const items = itemsWithSources.map(({ item, teamName, aideName }) => ({
  id: item.id,
  type: item.type,
  title: item.title,
  content: item.content,
  teamId: item.teamId,
  teamName,
  aideId: item.aideId,    // NEW
  aideName,               // NEW
  agentId: item.agentId,
  read: item.readAt !== null,
  readAt: item.readAt,
  createdAt: item.createdAt,
}));
```

---

### Phase 9: Worker and Agent Query Updates

The worker needs updates to support aide leads in the scheduled run logic.

#### 9.1 Update `src/lib/db/queries/agents.ts`

Add aide-aware functions or refactor existing ones:

**Option A: Add parallel functions for aides:**

```typescript
/**
 * Get active aide leads (for worker runner)
 */
export async function getActiveAideLeads(): Promise<Agent[]> {
  return db
    .select({
      id: agents.id,
      teamId: agents.teamId,
      aideId: agents.aideId,
      parentAgentId: agents.parentAgentId,
      name: agents.name,
      role: agents.role,
      systemPrompt: agents.systemPrompt,
      status: agents.status,
      nextRunAt: agents.nextRunAt,
      lastCompletedAt: agents.lastCompletedAt,
      createdAt: agents.createdAt,
      updatedAt: agents.updatedAt,
    })
    .from(agents)
    .innerJoin(aides, eq(agents.aideId, aides.id))
    .where(
      and(
        isNull(agents.parentAgentId),
        eq(aides.status, 'active')
      )
    );
}

/**
 * Get aide lead agent IDs where nextRunAt <= now
 */
export async function getAideLeadsDueToRun(): Promise<string[]> {
  const now = new Date();
  const result = await db
    .select({ id: agents.id })
    .from(agents)
    .innerJoin(aides, eq(agents.aideId, aides.id))
    .where(
      and(
        isNull(agents.parentAgentId),
        eq(aides.status, 'active'),
        lte(agents.nextRunAt, now)
      )
    );

  return result.map((r) => r.id);
}

/**
 * Get all leads (team and aide) due to run
 */
export async function getAllLeadsDueToRun(): Promise<string[]> {
  const [teamLeads, aideLeads] = await Promise.all([
    getTeamLeadsDueToRun(),
    getAideLeadsDueToRun(),
  ]);
  return [...teamLeads, ...aideLeads];
}
```

**Option B: Refactor to be owner-agnostic:**

```typescript
/**
 * Get all lead agent IDs where nextRunAt <= now
 * Includes both team leads and aide leads from active teams/aides
 */
export async function getLeadsDueToRun(): Promise<string[]> {
  const { lte, or, sql } = await import('drizzle-orm');

  const now = new Date();

  // Query leads from active teams
  const teamLeadsResult = await db
    .select({ id: agents.id })
    .from(agents)
    .innerJoin(teams, eq(agents.teamId, teams.id))
    .where(
      and(
        isNull(agents.parentAgentId),
        eq(teams.status, 'active'),
        lte(agents.nextRunAt, now)
      )
    );

  // Query leads from active aides
  const aideLeadsResult = await db
    .select({ id: agents.id })
    .from(agents)
    .innerJoin(aides, eq(agents.aideId, aides.id))
    .where(
      and(
        isNull(agents.parentAgentId),
        eq(aides.status, 'active'),
        lte(agents.nextRunAt, now)
      )
    );

  return [...teamLeadsResult.map(r => r.id), ...aideLeadsResult.map(r => r.id)];
}
```

#### 9.2 Update `src/worker/runner.ts`

Update `getAgentsNeedingWork` to include aide leads:

```typescript
async function getAgentsNeedingWork(): Promise<string[]> {
  // 1. Get agents with pending tasks (works for both team and aide agents)
  const agentsWithTasks = await getAgentsWithPendingTasks();

  // 2. Get ALL leads due for scheduled proactive run (teams AND aides)
  const leadsDue = await getAllLeadsDueToRun(); // NEW - includes aide leads

  // 3. Add any agents from pending notifications
  const notifiedAgents = Array.from(pendingNotifications);
  pendingNotifications.clear();

  // 4. Combine and dedupe
  const allAgentIds = new Set([
    ...agentsWithTasks,
    ...leadsDue,
    ...notifiedAgents,
  ]);

  return Array.from(allAgentIds);
}
```

#### 9.3 Verification Checklist

- [ ] `getAgentsWithPendingTasks()` works for both team and aide agents (no changes needed - queries by agent)
- [ ] Lead detection (`parentAgentId === null`) works for aide leads (no changes needed)
- [ ] Task claiming works correctly (no changes needed - queries by agent)
- [ ] Inbox item creation works with aideId (needs updates in Phase 6)

---

## File Changes Summary

### New Files
- `src/lib/db/queries/aides.ts`
- `src/lib/agents/aide-configuration.ts`
- `src/app/api/aides/route.ts`
- `src/app/api/aides/[id]/route.ts`
- `src/app/api/aides/[id]/agents/route.ts`
- `src/app/(dashboard)/aides/page.tsx`
- `src/app/(dashboard)/aides/new/page.tsx`
- `src/app/(dashboard)/aides/[id]/page.tsx`
- `src/app/(dashboard)/aides/[id]/chat/page.tsx`
- `src/app/(dashboard)/aides/[id]/agents/page.tsx`
- `src/app/(dashboard)/aides/[id]/agents/new/page.tsx`
- `src/app/(dashboard)/aides/[id]/agents/[agentId]/page.tsx`
- `src/app/(dashboard)/aides/[id]/agents/[agentId]/chat/page.tsx`
- `src/app/(dashboard)/aides/[id]/agents/[agentId]/edit/page.tsx`
- `src/app/(dashboard)/aides/[id]/agents/[agentId]/inspect/page.tsx`
- `src/lib/db/__tests__/aides.test.ts` - Tests for aides queries

### Modified Files
- `src/lib/db/schema.ts` - Add aides table, modify agents/agentTasks/inboxItems, add relations
- `src/lib/db/queries/agents.ts` - Add aide-related functions (`createAgentForAide`, `getAgentsByAideId`, `getAideLeadsDueToRun`, `getAllLeadsDueToRun`)
- `src/lib/db/queries/agentTasks.ts` - Support aideId in `createAgentTask`, `queueTask`
- `src/lib/db/queries/inboxItems.ts` - Support aideId in queries, add `getInboxItemsWithSources`
- `src/lib/db/queries/index.ts` - Export aides queries
- `src/lib/types.ts` - Add `Aide`, `AideWithAgents` types, update `InboxItem` to support nullable teamId/aideId
- `src/lib/agents/taskQueue.ts` - Change signature to accept `{ teamId: string } | { aideId: string }`
- `src/lib/agents/agent.ts` - Add `aideId` property, add `getOwnerInfo()` method, update task/inbox calls
- `src/lib/agents/tools/index.ts` - Update `ToolContext` interface for owner pattern
- `src/lib/agents/tools/team-lead-tools.ts` - Update `createInboxItemTool` to use owner info
- `src/worker/runner.ts` - Update `getAgentsNeedingWork` to call `getAllLeadsDueToRun`
- `src/app/(dashboard)/inbox/page.tsx` - Update `InboxItem` interface, add aideId/aideName, update links
- `src/app/api/inbox/route.ts` - Update to use `getInboxItemsWithSources`, include aideId/aideName
- Dashboard navigation components - Add Aides section
- `src/app/(dashboard)/teams/[id]/page.tsx` - Update "Chat with Team" link to use agent path
- `src/lib/agents/__tests__/taskQueue.test.ts` - Add tests for aide-based task queuing
- `src/lib/agents/__tests__/agent.test.ts` - Add tests for Agent with aideId
- `src/app/api/__tests__/api.test.ts` - Add tests for aides API
- `src/worker/__tests__/runner.test.ts` - Add tests for worker with aides
- `src/components/chat/Chat.tsx` - Accept either teamId or aideId
- `src/app/api/messages/route.ts` - Support both teamId and aideId for message sending

### Deleted Files
- `src/app/(dashboard)/teams/[id]/chat/page.tsx` - Redundant; use `/teams/[id]/agents/[agentId]/chat` instead

---

## Migration Notes

### Database Migration

After updating the schema, generate and run migrations:

```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

The migration needs to include a manual SQL statement for the check constraint. After generating the migration, edit it to add:

```sql
-- Add check constraint: exactly one of teamId or aideId must be set
ALTER TABLE agents ADD CONSTRAINT agents_owner_check
  CHECK (
    (team_id IS NOT NULL AND aide_id IS NULL) OR
    (team_id IS NULL AND aide_id IS NOT NULL)
  );

-- Also add constraints for agent_tasks and inbox_items
ALTER TABLE agent_tasks ADD CONSTRAINT agent_tasks_owner_check
  CHECK (
    (team_id IS NOT NULL AND aide_id IS NULL) OR
    (team_id IS NULL AND aide_id IS NOT NULL)
  );

ALTER TABLE inbox_items ADD CONSTRAINT inbox_items_owner_check
  CHECK (
    (team_id IS NOT NULL AND aide_id IS NULL) OR
    (team_id IS NULL AND aide_id IS NOT NULL)
  );
```

### Backwards Compatibility

- Existing teams and their agents continue to work unchanged
- The `teamId` foreign key remains on agents, just becomes nullable
- Existing data has `teamId` set and `aideId` null, which satisfies the check constraint

### Additional Updates (Route Consolidation)

**Update `src/app/(dashboard)/teams/[id]/page.tsx`** (line 56):

The "Chat with Team" button currently links to `/teams/${team.id}/chat`. Update to link to the team lead's agent chat:

```typescript
// Find the team lead from agents
const teamLead = team.agents.find(a => a.parentAgentId === null);

// Update the link (line 56)
<Link href={`/teams/${team.id}/agents/${teamLead?.id}/chat`}>
  <Button>Chat with Team</Button>
</Link>
```

This ensures consistency: all chat access goes through `/teams/[id]/agents/[agentId]/chat` or `/aides/[id]/agents/[agentId]/chat`.

---

## Testing Checklist

- [ ] Create an aide successfully
- [ ] Aide lead agent is created with correct configuration
- [ ] Bootstrap task is queued for new aide
- [ ] Can chat with aide lead in foreground
- [ ] Aide lead processes tasks in background
- [ ] Can add subordinate agents to aide
- [ ] Subordinates report to aide lead correctly
- [ ] Inbox shows items from aides
- [ ] Worker processes aide agents correctly
- [ ] Knowledge extraction works for aide agents
- [ ] Briefing decision works for aide leads
- [ ] Teams continue to work unchanged

---

## Phase 10: Testing

The project uses **Vitest** for testing with database-level tests using real PostgreSQL connections. Tests follow patterns established in existing test files.

### 10.1 Test File Organization

Tests are located in `__tests__` directories adjacent to the code being tested:
- `src/lib/db/__tests__/` - Database query tests
- `src/lib/agents/__tests__/` - Agent logic tests
- `src/app/api/__tests__/` - API integration tests

### 10.2 Database Query Tests

#### Create `src/lib/db/__tests__/aides.test.ts`

```typescript
/**
 * Tests for aides database queries
 */
import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { db } from '@/lib/db/client';
import { users, aides, agents, agentTasks, inboxItems } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import {
  createAide,
  getAideById,
  getAidesByUserId,
  updateAide,
  deleteAide,
  getAideLead,
} from '@/lib/db/queries/aides';
import {
  createAgentForAide,
  getAgentsByAideId,
} from '@/lib/db/queries/agents';

let testUserId: string;

beforeAll(async () => {
  const [user] = await db.insert(users).values({
    email: `aides-test-${Date.now()}@example.com`,
    name: 'Aides Test User',
  }).returning();
  testUserId = user.id;
});

afterAll(async () => {
  await db.delete(users).where(eq(users.id, testUserId));
});

describe('createAide', () => {
  test('creates aide with required fields', async () => {
    const aide = await createAide({
      userId: testUserId,
      name: 'Test Aide',
      purpose: 'Testing',
    });
    expect(aide.id).toBeDefined();
    expect(aide.name).toBe('Test Aide');
    expect(aide.status).toBe('active');

    await deleteAide(aide.id);
  });
});

describe('getAidesByUserId', () => {
  test('returns aides for user ordered by creation date', async () => {
    const aide1 = await createAide({ userId: testUserId, name: 'Aide 1' });
    const aide2 = await createAide({ userId: testUserId, name: 'Aide 2' });

    const aides = await getAidesByUserId(testUserId);
    expect(aides.length).toBeGreaterThanOrEqual(2);
    // Most recent first
    expect(aides[0].name).toBe('Aide 2');

    await deleteAide(aide1.id);
    await deleteAide(aide2.id);
  });
});

describe('createAgentForAide', () => {
  test('creates agent with aideId and null teamId', async () => {
    const aide = await createAide({ userId: testUserId, name: 'Agent Test Aide' });

    const agent = await createAgentForAide({
      aideId: aide.id,
      parentAgentId: null,
      name: 'Test Lead',
      role: 'lead',
    });

    expect(agent.aideId).toBe(aide.id);
    expect(agent.teamId).toBeNull();

    await deleteAide(aide.id);
  });
});

describe('getAideLead', () => {
  test('returns lead agent for aide', async () => {
    const aide = await createAide({ userId: testUserId, name: 'Lead Test Aide' });
    const lead = await createAgentForAide({
      aideId: aide.id,
      parentAgentId: null,
      name: 'Lead Agent',
      role: 'lead',
    });

    const foundLead = await getAideLead(aide.id);
    expect(foundLead?.id).toBe(lead.id);

    await deleteAide(aide.id);
  });
});

// Test check constraint
describe('Agent Owner Constraint', () => {
  test('agent must have either teamId or aideId (not both, not neither)', async () => {
    // This is verified by the database check constraint
    // The queries should enforce this through their signatures
  });
});
```

### 10.3 Task Queue Tests with Aides

#### Update `src/lib/agents/__tests__/taskQueue.test.ts`

Add test cases for aide-based task queuing:

```typescript
describe('Task Queue with Aides', () => {
  let testAideId: string;
  let testAideAgentId: string;

  beforeAll(async () => {
    // Create test aide and agent
    const aide = await createAide({ userId: testUserId, name: 'Task Queue Test Aide' });
    testAideId = aide.id;

    const agent = await createAgentForAide({
      aideId: testAideId,
      parentAgentId: null,
      name: 'Task Queue Aide Agent',
      role: 'lead',
    });
    testAideAgentId = agent.id;
  });

  test('queueUserTask works with aideId', async () => {
    const task = await queueUserTask(
      testAideAgentId,
      { aideId: testAideId },
      'User message for aide'
    );

    expect(task.aideId).toBe(testAideId);
    expect(task.teamId).toBeNull();
    expect(task.source).toBe('user');

    await cleanupTasks([task.id]);
  });

  test('queueSystemTask works with aideId', async () => {
    const task = await queueSystemTask(
      testAideAgentId,
      { aideId: testAideId },
      'Bootstrap aide'
    );

    expect(task.aideId).toBe(testAideId);
    expect(task.source).toBe('system');

    await cleanupTasks([task.id]);
  });
});
```

### 10.4 Agent Class Tests with Aides

#### Update `src/lib/agents/__tests__/agent.test.ts`

Add test cases for Agent class with aideId:

```typescript
describe('Agent Class with Aides', () => {
  let testAideId: string;
  let testAideLeadId: string;

  beforeAll(async () => {
    const aide = await createAide({ userId: testUserId, name: 'Agent Test Aide' });
    testAideId = aide.id;

    const lead = await createAgentForAide({
      aideId: testAideId,
      parentAgentId: null,
      name: 'Aide Lead',
      role: 'Personal Aide',
    });
    testAideLeadId = lead.id;
  });

  test('creates agent from aide agent ID', async () => {
    const agent = await createAgent(testAideLeadId);
    expect(agent).not.toBeNull();
    expect(agent!.aideId).toBe(testAideId);
    expect(agent!.teamId).toBeNull();
  });

  test('getOwnerInfo returns aideId for aide agents', async () => {
    const agent = await createAgent(testAideLeadId);
    const ownerInfo = agent!.getOwnerInfo();
    expect(ownerInfo).toEqual({ aideId: testAideId });
  });

  test('isTeamLead returns true for aide lead', async () => {
    const agent = await createAgent(testAideLeadId);
    expect(agent!.isTeamLead()).toBe(true);
  });

  test('handleUserMessage queues task with aideId', async () => {
    const agent = await createAgent(testAideLeadId);

    // Mock intent classification
    const mockGenerateLLMObject = vi.spyOn(llm, 'generateLLMObject').mockResolvedValueOnce({
      intent: 'work_request',
      reasoning: 'User is requesting work',
    });

    const stream = await agent!.handleUserMessage('Analyze this');
    for await (const _ of stream) { /* consume */ }

    // Verify task was queued with aideId
    const [task] = await db.select().from(agentTasks)
      .where(eq(agentTasks.assignedToId, testAideLeadId));
    expect(task.aideId).toBe(testAideId);
    expect(task.teamId).toBeNull();

    mockGenerateLLMObject.mockRestore();
    await db.delete(agentTasks).where(eq(agentTasks.assignedToId, testAideLeadId));
  });

  test('decideBriefing creates inbox item with aideId', async () => {
    // Test that briefings for aide leads use aideId
  });
});
```

### 10.5 API Route Tests

#### Update `src/app/api/__tests__/api.test.ts`

Add test cases for aide API routes:

```typescript
describe('Aides API (/api/aides)', () => {
  test('POST creates aide with lead agent and bootstrap task', async () => {
    // Similar to teams POST test but for aides
    const aide = await createAide({
      userId: testUserId,
      name: 'API Test Aide',
      purpose: 'Personal assistant',
    });

    const lead = await createAgentForAide({
      aideId: aide.id,
      parentAgentId: null,
      name: 'API Test Lead',
      role: 'lead',
    });

    await queueSystemTask(
      lead.id,
      { aideId: aide.id },
      'Get to work on your purpose.'
    );

    // Verify bootstrap task
    const [task] = await db.select().from(agentTasks)
      .where(eq(agentTasks.assignedToId, lead.id));
    expect(task.source).toBe('system');
    expect(task.aideId).toBe(aide.id);

    await deleteAide(aide.id);
  });
});

describe('Inbox with Aides', () => {
  test('getInboxItemsWithSources returns aide items correctly', async () => {
    const aide = await createAide({ userId: testUserId, name: 'Inbox Test Aide' });
    const lead = await createAgentForAide({
      aideId: aide.id,
      parentAgentId: null,
      name: 'Inbox Lead',
      role: 'lead',
    });

    // Create inbox item for aide
    await createInboxItem({
      userId: testUserId,
      aideId: aide.id,
      agentId: lead.id,
      type: 'briefing',
      title: 'Test',
      content: 'Test content',
    });

    const items = await getInboxItemsWithSources(testUserId);
    const aideItem = items.find(i => i.aideId === aide.id);
    expect(aideItem).toBeDefined();
    expect(aideItem!.aideName).toBe('Inbox Test Aide');
    expect(aideItem!.teamName).toBeNull();

    await deleteAide(aide.id);
  });
});
```

### 10.6 Worker Tests with Aides

#### Update `src/worker/__tests__/runner.test.ts`

Add test cases to verify worker handles aide agents:

```typescript
describe('Worker Runner with Aides', () => {
  test('getAgentsNeedingWork includes aide agents with pending tasks', async () => {
    const aide = await createAide({ userId: testUserId, name: 'Worker Test Aide' });
    const lead = await createAgentForAide({
      aideId: aide.id,
      parentAgentId: null,
      name: 'Worker Lead',
      role: 'lead',
    });

    await queueUserTask(lead.id, { aideId: aide.id }, 'Test task');

    const agentsNeeding = await getAgentsWithPendingTasks();
    expect(agentsNeeding).toContain(lead.id);

    await deleteAide(aide.id);
  });

  test('getActiveLeads includes aide leads from active aides', async () => {
    const aide = await createAide({
      userId: testUserId,
      name: 'Active Aide',
      status: 'active',
    });
    const lead = await createAgentForAide({
      aideId: aide.id,
      parentAgentId: null,
      name: 'Active Lead',
      role: 'lead',
    });

    // Set nextRunAt to past
    await updateAgentNextRunAt(lead.id, new Date(Date.now() - 1000));

    const leadsDue = await getLeadsDueToRun();
    expect(leadsDue).toContain(lead.id);

    await deleteAide(aide.id);
  });
});
```

### 10.7 Test Commands

```bash
# Run all tests
npm run test

# Run specific test file
npm run test src/lib/db/__tests__/aides.test.ts

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### 10.8 Manual Testing Checklist

After automated tests pass, verify the following manually:

1. **Aide Creation Flow**
   - Navigate to /aides/new
   - Fill in name and purpose
   - Submit and verify redirect to aide detail page
   - Verify lead agent was created with correct system prompt
   - Verify bootstrap task was queued

2. **Aide Chat Flow**
   - Navigate to /aides/[id]/agents/[agentId]/chat
   - Send a message
   - Verify response and task queuing (for work requests)

3. **Aide Inbox Integration**
   - Trigger a briefing from an aide
   - Verify inbox shows item with aide name (not team name)
   - Click "View Conversation" and verify correct redirect

4. **Worker Processing**
   - Create an aide with a work request task
   - Verify worker picks up and processes the task
   - Verify knowledge extraction works
   - Verify briefing decision works for aide leads

5. **Regression Testing**
   - Verify existing team functionality still works
   - Create a team, send messages, verify inbox works

---

## Future Considerations

As aides and teams evolve differently, potential divergence points include:

1. **Configuration**: Different prompts, personas, setup wizards
2. **Lifecycle**: Different scheduling, activation, pause behavior
3. **Tools**: Aides might have different tool access than teams
4. **UI/UX**: Different presentation, interaction patterns
5. **Subordinate creation**: Aides might auto-suggest specialists, teams might have role-based templates
6. **Billing/Limits**: Potentially different pricing models

The current implementation keeps them parallel, making future divergence straightforward.
