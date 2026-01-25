# Agent Foreground/Background Architecture

## Overview

Evolve the agent system from single-conversation to a sophisticated foreground/background architecture with separate conversation contexts, task queues for all agents, and knowledge extraction.

## Core Concepts

### Conversations vs Threads

| Aspect | Conversation | Thread |
|--------|--------------|--------|
| Purpose | User ↔ Agent interaction | Agent background work session |
| Lifecycle | One per agent, permanent | Many per agent, ephemeral |
| Visibility | Shown in UI | Internal only |
| Persistence | Long-lived, accumulates | Discarded after knowledge extraction |
| Context | Grows over time | Fresh each session, compaction if needed |

- **Conversation**: The user-facing chat history. One per agent. This is where briefings and user interactions live.
- **Thread**: A single background work session. Agent creates new thread each time it processes its queue. Thread is used for agent ↔ LLM communication during work. Discarded after extracting knowledge.

### Why This Model Works

1. **No context overflow across sessions**: Each work session starts with a fresh thread
2. **Mid-session compaction**: If thread exceeds context during work, compact and continue
3. **Learning becomes critical**: Memories are the ONLY thing that persists between sessions
4. **Professional growth**: Agent improves by extracting insights from work threads into memories
5. **Clean separation**: Users see conversation, internal work happens in disposable threads

### Agent Types & Behavior

| Aspect | Team Lead | Teammate Worker |
|--------|-----------|-----------------|
| Task Queue | Yes | Yes |
| Proactive | Yes (seeks work based on mission) | No (purely reactive) |
| 1-Hour Trigger | Yes (to further mission) | No (only queue-triggered) |
| Can Send Briefings | Yes (decides after work) | No |
| Knowledge Extraction | Yes (after clearing queue) | Yes (after clearing queue) |

### Key Flows

**User Message Flow (Foreground)**:
```
User sends message → Agent responds minimally ("I'll look into that")
                   → Agent queues task to own queue
                   → Return response to user
                   → Background picks up task immediately
```

**Background Work Flow**:
```
Task picked up → Load agent conversation (or create new)
              → Process task via LLM with tools
              → May queue sub-tasks or delegate to workers
              → Mark task complete
              → If queue empty:
                  → Extract knowledge from agent conversation
                  → Team lead only: decide if briefing needed
                  → If briefing: create inbox item + message in user conversation
                  → Schedule next run (team lead: 1 hour, worker: none)
```

**Team Creation Bootstrap**:
```
Team created → Team lead created
            → Queue "get to work" task
            → Background picks up immediately
            → Team lead starts mission execution
```

---

## Database Schema Changes

### 1. Create threads table (NEW)

Threads are ephemeral work sessions for background processing:

```typescript
export const threads = pgTable('threads', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('active'), // 'active', 'completed', 'compacted'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});
```

### 2. Create threadMessages table (NEW)

Messages within a work thread:

```typescript
export const threadMessages = pgTable('thread_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  threadId: uuid('thread_id').notNull().references(() => threads.id, { onDelete: 'cascade' }),
  role: text('role').notNull(), // 'user' (agent as user), 'assistant' (LLM response), 'system'
  content: text('content').notNull(),
  toolCalls: jsonb('tool_calls'), // Store tool call data if any
  sequenceNumber: integer('sequence_number').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

### 3. Conversations table (unchanged)

Existing conversations table remains for user ↔ agent interactions. No changes needed.

### 4. Extend agentTasks for self-queued tasks

Add `source` field to distinguish task origins:

```sql
ALTER TABLE agent_tasks ADD COLUMN source TEXT NOT NULL DEFAULT 'delegation';
-- Values: 'delegation' (from another agent), 'user' (from user message), 'system' (bootstrap), 'self' (proactive)
```

### 5. Add scheduling fields to agents table

```sql
ALTER TABLE agents ADD COLUMN next_run_at TIMESTAMP;
ALTER TABLE agents ADD COLUMN last_completed_at TIMESTAMP;
```

---

## Implementation Tasks

### Phase 1: Schema & Database Layer

#### Task 1.1: Create threads and threadMessages tables
**File**: `src/lib/db/schema.ts`

Add new tables for background work sessions:
```typescript
// Threads - ephemeral work sessions
export const threads = pgTable('threads', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});

// Thread messages
export const threadMessages = pgTable('thread_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  threadId: uuid('thread_id').notNull().references(() => threads.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  content: text('content').notNull(),
  toolCalls: jsonb('tool_calls'),
  sequenceNumber: integer('sequence_number').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

#### Task 1.2: Update agentTasks schema
**File**: `src/lib/db/schema.ts`

Add `source` field:
```typescript
source: text('source').notNull().default('delegation'), // 'delegation' | 'user' | 'system' | 'self'
```

#### Task 1.3: Update agents schema
**File**: `src/lib/db/schema.ts`

Add scheduling fields:
```typescript
nextRunAt: timestamp('next_run_at'),
lastCompletedAt: timestamp('last_completed_at'),
```

#### Task 1.4: Generate and apply migrations
```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

### Phase 2: Thread Management (NEW)

#### Task 2.1: Create thread queries
**File**: `src/lib/db/queries/threads.ts` (NEW)

Create functions for thread lifecycle:
- `createThread(agentId)` - start new work session
- `getActiveThread(agentId)` - get current active thread (if any)
- `completeThread(threadId)` - mark thread as completed
- `getThreadMessages(threadId)` - get all messages in thread
- `appendThreadMessage(threadId, role, content, toolCalls?)` - add message
- `compactThread(threadId, summary)` - replace messages with summary (mid-session compaction)

#### Task 2.2: Create thread abstraction
**File**: `src/lib/agents/thread.ts` (NEW)

High-level thread management:
- `startWorkSession(agentId)` - create thread, return thread context
- `addToThread(threadId, role, content)` - append message
- `buildThreadContext(threadId, maxTokens)` - get messages for LLM call
- `shouldCompact(threadId)` - check if approaching context limit
- `compactIfNeeded(threadId)` - summarize and replace if too long
- `endWorkSession(threadId)` - mark complete

### Phase 3: Task Queue System

#### Task 3.1: Update task queries
**File**: `src/lib/db/queries/agentTasks.ts`

Add functions:
- `queueTask(agentId, task, source)` - add task to agent's own queue
- `getOwnPendingTasks(agentId)` - tasks where agent is assignedToId
- `hasQueuedWork(agentId)` - check if queue is non-empty

#### Task 3.2: Create queueUserTask function
**File**: `src/lib/agents/agent.ts` (or new file)

Function to queue a task from user message:
```typescript
async queueUserTask(userMessage: string): Promise<void> {
  await queueTask(this.id, userMessage, 'user');
  // Trigger background processing
}
```

### Phase 4: Agent Lifecycle Refactor

#### Task 4.1: Split handleMessage for foreground
**File**: `src/lib/agents/agent.ts`

New `handleUserMessage()`:
1. Add user message to USER conversation
2. Generate contextual acknowledgment via quick LLM call
3. Add acknowledgment to USER conversation
4. Queue task with source='user'
5. Return response stream
6. Trigger background worker

#### Task 4.2: Create runWorkSession method
**File**: `src/lib/agents/agent.ts`

Main entry point for background processing:
```typescript
async runWorkSession(): Promise<void> {
  // 1. Create new thread for this session
  // 2. Load memories for context
  // 3. Process all pending tasks in queue
  // 4. When queue empty:
  //    - Extract knowledge from thread → memories
  //    - Mark thread completed
  //    - Team lead: decide briefing
  //    - Schedule next run (team lead only)
}
```

#### Task 4.3: Create processTaskInThread method
**File**: `src/lib/agents/agent.ts`

Process single task within current thread:
```typescript
async processTaskInThread(threadId: string, task: AgentTask): Promise<string> {
  // 1. Build context from thread messages + memories
  // 2. Add task as "user" message to thread (agent is the user here)
  // 3. Call LLM with tools
  // 4. Add response to thread
  // 5. If tool calls, execute and continue conversation
  // 6. Check if should compact thread (context limit)
  // 7. Mark task complete
  // 8. Return result
}
```

#### Task 4.4: Create extractKnowledgeFromThread method
**File**: `src/lib/agents/agent.ts` or `src/lib/agents/memory.ts`

Extract professional learnings from work session:
```typescript
async extractKnowledgeFromThread(threadId: string): Promise<void> {
  // 1. Load all thread messages
  // 2. Build extraction prompt focused on:
  //    - What approaches worked/didn't work
  //    - Patterns discovered
  //    - Skills or techniques learned
  //    - Information about the domain
  // 3. Extract memories via LLM
  // 4. Persist to memories with type 'insight' or 'fact'
  // 5. This is how the agent "grows professionally"
}
```

#### Task 4.5: Create decideBriefing method (team lead only)
**File**: `src/lib/agents/agent.ts`

```typescript
async decideBriefing(threadId: string): Promise<void> {
  if (!this.isTeamLead()) return;

  // 1. Review thread work and newly extracted knowledge
  // 2. LLM decides: is this worth briefing user?
  //    - Significant discoveries?
  //    - Actionable insights?
  //    - Important alerts?
  // 3. If yes:
  //    - Generate briefing content
  //    - Create inbox item (summary)
  //    - Add full briefing to USER conversation
  // 4. If no: complete silently (no noise)
}
```

### Phase 5: Background Worker Refactor

#### Task 5.1: Refactor runner for event-driven execution
**File**: `src/worker/runner.ts`

Change from polling all team leads to:
- Listen for agents with pending tasks OR nextRunAt <= now
- Process one agent at a time
- Team leads: schedule next run 1 hour after completion
- Workers: no next run scheduling (purely reactive)

#### Task 5.2: Add immediate trigger on task queue
**File**: `src/worker/runner.ts` or new file

When task is queued, immediately trigger processing:
```typescript
export async function notifyTaskQueued(agentId: string): Promise<void> {
  // Wake up the agent to process its queue
}
```

### Phase 6: API Updates

#### Task 6.1: Update messages API for foreground handling
**File**: `src/app/api/messages/route.ts`

Change to:
1. Call `agent.handleUserMessage()` instead of `handleMessage()`
2. Return minimal response
3. Task is queued automatically

#### Task 6.2: Update team creation to bootstrap
**File**: `src/app/api/teams/route.ts`

After creating team lead:
```typescript
await queueTask(teamLead.id, 'Get to work on your mission', 'system');
```

#### Task 6.3: Update conversations API
**File**: `src/app/api/conversations/[agentId]/route.ts`

Only return USER conversation (not agent conversation).

### Phase 7: Remove Legacy Code

#### Task 7.1: Remove hourly cycle logic
- Remove `runResearchCycle()` (replaced by task-based work)
- Remove `maybeGenerateProactiveBriefing()` (replaced by `decideBriefing()`)
- Remove `BRIEFING_INTERVAL_HOURS`, `RESEARCH_INTERVAL_MINUTES` constants

#### Task 7.2: Update runCycle dispatch
- Team lead: `processTaskQueue()` + proactive work if queue empty
- Worker: `processTaskQueue()` only

---

## Data Flow Diagrams

### User Message → Background Processing

```
┌─────────────────────────────────────────────────────────────────┐
│ FOREGROUND (API Request)                                        │
├─────────────────────────────────────────────────────────────────┤
│ 1. User sends: "Research NVIDIA stock"                          │
│ 2. Agent receives in handleUserMessage()                        │
│ 3. Add to CONVERSATION: user message                            │
│ 4. Quick LLM call for contextual ack                            │
│ 5. Add to CONVERSATION: "I'll research NVIDIA's latest..."      │
│ 6. Queue task: {task: "Research NVIDIA stock", source: 'user'}  │
│ 7. Trigger background: notifyTaskQueued(agentId)                │
│ 8. Return response to user                                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ BACKGROUND (Worker Process)                                     │
├─────────────────────────────────────────────────────────────────┤
│ 1. Worker picks up agent (has pending task)                     │
│ 2. runWorkSession() starts                                      │
│ 3. Create NEW THREAD for this session                           │
│ 4. Load memories for context                                    │
│ 5. Process task in thread:                                      │
│    - Add task as "user" message to thread                       │
│    - LLM responds with tool calls                               │
│    - tavilySearch("NVIDIA stock news") → add result to thread   │
│    - May delegate to workers                                    │
│    - Thread grows with work conversation                        │
│    - Compact if approaching context limit                       │
│ 6. Mark task complete                                           │
│ 7. Check queue → empty                                          │
│ 8. Extract knowledge from THREAD → memories                     │
│ 9. Mark thread completed (can be cleaned up later)              │
│ 10. Decide briefing: "Yes, found significant news"              │
│ 11. Create inbox item (summary)                                 │
│ 12. Add full briefing to USER CONVERSATION                      │
│ 13. Schedule next run: now + 1 hour                             │
└─────────────────────────────────────────────────────────────────┘
```

### Team Lead Proactive Cycle (1-Hour Trigger)

```
┌─────────────────────────────────────────────────────────────────┐
│ BACKGROUND (Worker Process - 1 Hour Timer)                      │
├─────────────────────────────────────────────────────────────────┤
│ 1. Worker picks up team lead (nextRunAt <= now)                 │
│ 2. runWorkSession() starts                                      │
│ 3. Create NEW THREAD for this session                           │
│ 4. Check queue → empty                                          │
│ 5. Load mission + memories                                      │
│ 6. Add to thread: "What should I work on for my mission?"       │
│ 7. LLM decides proactive work based on mission & learnings      │
│ 8. Execute work in thread (search, delegate, etc.)              │
│ 9. When done: extract knowledge from thread → memories          │
│ 10. Mark thread completed                                       │
│ 11. Decide briefing based on significance                       │
│ 12. Schedule next run: now + 1 hour                             │
└─────────────────────────────────────────────────────────────────┘
```

### Teammate Worker (Purely Reactive)

```
┌─────────────────────────────────────────────────────────────────┐
│ BACKGROUND (Worker Process - Task Queued)                       │
├─────────────────────────────────────────────────────────────────┤
│ 1. Task delegated by team lead → queue updated                  │
│ 2. notifyTaskQueued() triggers worker pickup                    │
│ 3. runWorkSession() starts                                      │
│ 4. Create NEW THREAD for this session                           │
│ 5. Process task in thread                                       │
│ 6. Mark task complete, report to lead                           │
│ 7. Check queue → empty                                          │
│ 8. Extract knowledge from thread → memories                     │
│ 9. Mark thread completed                                        │
│ 10. NO briefing (workers can't send)                            │
│ 11. NO scheduling (purely reactive)                             │
│ 12. Session ends, agent goes idle                               │
└─────────────────────────────────────────────────────────────────┘
```

### Thread Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│ THREAD LIFECYCLE                                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐    ┌──────────────────────────────────────┐       │
│  │ Created  │───▶│ Active (processing tasks)            │       │
│  └──────────┘    │                                      │       │
│                  │  Messages accumulate:                │       │
│                  │  - Agent adds task as "user"         │       │
│                  │  - LLM responds as "assistant"       │       │
│                  │  - Tool results added                │       │
│                  │                                      │       │
│                  │  If context limit approached:        │       │
│                  │  ┌────────────────────────────┐      │       │
│                  │  │ Compact: summarize history │      │       │
│                  │  │ Replace with summary msg   │      │       │
│                  │  │ Continue working           │      │       │
│                  │  └────────────────────────────┘      │       │
│                  └──────────────────────────────────────┘       │
│                                    │                            │
│                                    ▼                            │
│                  ┌──────────────────────────────────────┐       │
│                  │ Queue Empty → Extract Knowledge      │       │
│                  │                                      │       │
│                  │  - Review all thread messages        │       │
│                  │  - Extract insights, learnings       │       │
│                  │  - Persist to memories               │       │
│                  │  - Agent "grows professionally"      │       │
│                  └──────────────────────────────────────┘       │
│                                    │                            │
│                                    ▼                            │
│                  ┌──────────────────────────────────────┐       │
│                  │ Completed                            │       │
│                  │                                      │       │
│                  │  Thread marked completed             │       │
│                  │  Can be cleaned up/archived later    │       │
│                  │  Next session = NEW thread           │       │
│                  └──────────────────────────────────────┘       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## File Changes Summary

| File | Changes |
|------|---------|
| `src/lib/db/schema.ts` | Add threads + threadMessages tables, task source, agent scheduling fields |
| `src/lib/db/queries/threads.ts` | NEW: createThread, getThreadMessages, appendThreadMessage, compactThread, completeThread |
| `src/lib/db/queries/agentTasks.ts` | queueTask, getOwnPendingTasks, hasQueuedWork |
| `src/lib/db/queries/agents.ts` | scheduleNextRun, getAgentsDueToRun |
| `src/lib/agents/agent.ts` | Major refactor: handleUserMessage, runWorkSession, processTaskInThread, extractKnowledgeFromThread, decideBriefing |
| `src/lib/agents/thread.ts` | NEW: startWorkSession, addToThread, buildThreadContext, shouldCompact, compactIfNeeded |
| `src/lib/agents/memory.ts` | extractKnowledgeFromThread function |
| `src/worker/runner.ts` | Event-driven + timer-based scheduling |
| `src/app/api/messages/route.ts` | Use handleUserMessage |
| `src/app/api/teams/route.ts` | Bootstrap "get to work" task |
| `src/app/api/conversations/[agentId]/route.ts` | No changes needed (already returns user conversation)

---

## Implementation Order

1. **Schema changes** (Tasks 1.1-1.4) - foundation for everything
2. **Thread management** (Tasks 2.1-2.2) - new thread infrastructure
3. **Task queue system** (Tasks 3.1-3.2) - needed before agent refactor
4. **Agent lifecycle** (Tasks 4.1-4.5) - core behavior changes
5. **Background worker** (Tasks 5.1-5.2) - execution infrastructure
6. **API updates** (Tasks 6.1-6.3) - wire up new system
7. **Cleanup** (Tasks 7.1-7.2) - remove legacy code

---

## Verification Plan

### 1. Schema Verification
```bash
npx drizzle-kit generate
npx drizzle-kit migrate
npx drizzle-kit studio  # Verify new tables: threads, thread_messages
```

### 2. Unit Tests
- Test `createThread()` creates new thread for agent
- Test `appendThreadMessage()` adds message with correct sequence
- Test `compactThread()` replaces messages with summary
- Test `queueTask()` creates task with correct source
- Test `handleUserMessage()` queues task and returns contextual ack

### 3. Integration Tests
1. Create team → verify "get to work" task queued
2. Send user message → verify task queued + contextual response
3. Run worker → verify NEW thread created for session
4. Verify task processed via thread (not conversation)
5. Check queue empty → verify knowledge extracted from thread
6. Verify thread marked completed
7. Check team lead → verify briefing decision made
8. If briefing → verify inbox item + conversation message

### 4. End-to-End Test
1. Start worker: `npx ts-node --project tsconfig.json src/worker/index.ts`
2. Create new team via UI
3. Verify team lead starts working (check logs for "new thread created")
4. Send message to team lead
5. Verify contextual response returned immediately
6. Wait for background processing
7. Verify thread completed and knowledge extracted
8. Check inbox for briefing (if significant)
9. Check USER conversation has briefing content
10. Check memories for extracted professional learnings
11. Wait 1 hour (or manually trigger) → verify team lead wakes up
12. Verify NEW thread created for proactive work

### 5. Thread Compaction Test
1. Create task that requires many LLM exchanges
2. Monitor thread message count
3. Verify compaction triggers when approaching context limit
4. Verify work continues after compaction

---

## Success Criteria

- [ ] Threads table exists with proper schema
- [ ] ThreadMessages table exists with proper schema
- [ ] Each work session creates NEW thread
- [ ] Tasks have source field (delegation/user/system/self)
- [ ] User messages queue tasks, return contextual ack
- [ ] Background processes tasks via thread (not conversation)
- [ ] Mid-session compaction works when context limit approached
- [ ] Knowledge extracted from thread after queue cleared
- [ ] Thread marked completed after knowledge extraction
- [ ] Team leads decide briefings (not automatic)
- [ ] Briefings go to inbox (summary) + conversation (full)
- [ ] Team leads have 1-hour proactive trigger
- [ ] Workers are purely reactive (queue-triggered only)
- [ ] New teams bootstrap with "get to work" task
- [ ] Memories accumulate professional learnings over time
- [ ] UI shows only user conversation (not threads)
