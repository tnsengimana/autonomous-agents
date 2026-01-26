import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@/lib/db/client';
import {
  users, teams, agents, threads, threadMessages, knowledgeItems, agentTasks
} from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// Test utilities
let testUserId: string;
let testTeamId: string;
let testAgentId: string;

beforeAll(async () => {
  // Create test user
  const [user] = await db.insert(users).values({
    email: `test-${Date.now()}@example.com`,
    name: 'Test User',
  }).returning();
  testUserId = user.id;

  // Create test team
  const [team] = await db.insert(teams).values({
    userId: testUserId,
    name: 'Test Team',
    purpose: 'Testing',
  }).returning();
  testTeamId = team.id;

  // Create test agent
  const [agent] = await db.insert(agents).values({
    teamId: testTeamId,
    name: 'Test Agent',
    role: 'Test Role',
  }).returning();
  testAgentId = agent.id;
});

afterAll(async () => {
  // Cleanup: delete test user (cascades to teams, agents, etc.)
  await db.delete(users).where(eq(users.id, testUserId));
});

describe('threads schema', () => {
  test('creates thread for agent', async () => {
    const [thread] = await db.insert(threads).values({
      agentId: testAgentId,
    }).returning();

    expect(thread.agentId).toBe(testAgentId);
    expect(thread.status).toBe('active');
    expect(thread.createdAt).toBeDefined();
    expect(thread.completedAt).toBeNull();

    // Cleanup
    await db.delete(threads).where(eq(threads.id, thread.id));
  });

  test('cascades delete when agent deleted', async () => {
    // Create a separate agent for this test
    const [tempAgent] = await db.insert(agents).values({
      teamId: testTeamId,
      name: 'Temp Agent',
      role: 'Temp',
    }).returning();

    const [thread] = await db.insert(threads).values({
      agentId: tempAgent.id,
    }).returning();

    // Delete the agent
    await db.delete(agents).where(eq(agents.id, tempAgent.id));

    // Thread should be gone
    const remainingThreads = await db.select().from(threads).where(eq(threads.id, thread.id));
    expect(remainingThreads).toHaveLength(0);
  });

  test('supports status transitions (active -> completed)', async () => {
    const [thread] = await db.insert(threads).values({
      agentId: testAgentId,
    }).returning();

    expect(thread.status).toBe('active');

    // Transition to completed
    const completedAt = new Date();
    await db.update(threads)
      .set({ status: 'completed', completedAt })
      .where(eq(threads.id, thread.id));

    const [updated] = await db.select().from(threads).where(eq(threads.id, thread.id));
    expect(updated.status).toBe('completed');
    expect(updated.completedAt).toBeDefined();

    // Cleanup
    await db.delete(threads).where(eq(threads.id, thread.id));
  });
});

describe('threadMessages schema', () => {
  test('creates message in thread', async () => {
    const [thread] = await db.insert(threads).values({
      agentId: testAgentId,
    }).returning();

    const [message] = await db.insert(threadMessages).values({
      threadId: thread.id,
      role: 'user',
      content: 'Test message',
      sequenceNumber: 1,
    }).returning();

    expect(message.threadId).toBe(thread.id);
    expect(message.role).toBe('user');
    expect(message.content).toBe('Test message');
    expect(message.sequenceNumber).toBe(1);

    // Cleanup
    await db.delete(threads).where(eq(threads.id, thread.id));
  });

  test('cascades delete when thread deleted', async () => {
    const [thread] = await db.insert(threads).values({
      agentId: testAgentId,
    }).returning();

    await db.insert(threadMessages).values({
      threadId: thread.id,
      role: 'assistant',
      content: 'Response',
      sequenceNumber: 1,
    });

    // Delete thread
    await db.delete(threads).where(eq(threads.id, thread.id));

    // Messages should be gone
    const messages = await db.select().from(threadMessages).where(eq(threadMessages.threadId, thread.id));
    expect(messages).toHaveLength(0);
  });

  test('stores toolCalls in jsonb field', async () => {
    const [thread] = await db.insert(threads).values({
      agentId: testAgentId,
    }).returning();

    const toolCalls = [
      { id: 'call_1', type: 'function', function: { name: 'search', arguments: '{"query":"test"}' } },
      { id: 'call_2', type: 'function', function: { name: 'browse', arguments: '{"url":"https://example.com"}' } },
    ];

    const [message] = await db.insert(threadMessages).values({
      threadId: thread.id,
      role: 'assistant',
      content: 'Let me search for that.',
      toolCalls,
      sequenceNumber: 1,
    }).returning();

    expect(message.toolCalls).toEqual(toolCalls);

    // Verify retrieval from database
    const [retrieved] = await db.select().from(threadMessages).where(eq(threadMessages.id, message.id));
    expect(retrieved.toolCalls).toEqual(toolCalls);

    // Cleanup
    await db.delete(threads).where(eq(threads.id, thread.id));
  });
});

describe('knowledgeItems schema', () => {
  test('creates knowledge item for agent', async () => {
    const [knowledgeItem] = await db.insert(knowledgeItems).values({
      agentId: testAgentId,
      type: 'fact',
      content: 'NVIDIA reports earnings in February',
    }).returning();

    expect(knowledgeItem.agentId).toBe(testAgentId);
    expect(knowledgeItem.type).toBe('fact');
    expect(knowledgeItem.content).toBe('NVIDIA reports earnings in February');
    expect(knowledgeItem.sourceThreadId).toBeNull();

    // Cleanup
    await db.delete(knowledgeItems).where(eq(knowledgeItems.id, knowledgeItem.id));
  });

  test('links knowledge item to source thread', async () => {
    const [thread] = await db.insert(threads).values({
      agentId: testAgentId,
    }).returning();

    const [knowledgeItem] = await db.insert(knowledgeItems).values({
      agentId: testAgentId,
      type: 'technique',
      content: 'Check SEC filings first',
      sourceThreadId: thread.id,
    }).returning();

    expect(knowledgeItem.sourceThreadId).toBe(thread.id);

    // Cleanup
    await db.delete(threads).where(eq(threads.id, thread.id));
  });

  test('nullifies sourceThreadId when thread deleted', async () => {
    const [thread] = await db.insert(threads).values({
      agentId: testAgentId,
    }).returning();

    const [knowledgeItem] = await db.insert(knowledgeItems).values({
      agentId: testAgentId,
      type: 'pattern',
      content: 'Market volatility increases before earnings',
      sourceThreadId: thread.id,
    }).returning();

    // Delete thread
    await db.delete(threads).where(eq(threads.id, thread.id));

    // Knowledge item should remain but with null sourceThreadId
    const [updated] = await db.select().from(knowledgeItems).where(eq(knowledgeItems.id, knowledgeItem.id));
    expect(updated).toBeDefined();
    expect(updated.sourceThreadId).toBeNull();

    // Cleanup
    await db.delete(knowledgeItems).where(eq(knowledgeItems.id, knowledgeItem.id));
  });

  test('stores confidence as real number', async () => {
    const [knowledgeItem] = await db.insert(knowledgeItems).values({
      agentId: testAgentId,
      type: 'fact',
      content: 'Tech stocks tend to rally in Q4',
      confidence: 0.85,
    }).returning();

    expect(knowledgeItem.confidence).toBeCloseTo(0.85, 2);

    // Verify retrieval from database
    const [retrieved] = await db.select().from(knowledgeItems).where(eq(knowledgeItems.id, knowledgeItem.id));
    expect(retrieved.confidence).toBeCloseTo(0.85, 2);

    // Cleanup
    await db.delete(knowledgeItems).where(eq(knowledgeItems.id, knowledgeItem.id));
  });

  test('confidence defaults to null when not provided', async () => {
    const [knowledgeItem] = await db.insert(knowledgeItems).values({
      agentId: testAgentId,
      type: 'lesson',
      content: 'Always verify data sources',
    }).returning();

    expect(knowledgeItem.confidence).toBeNull();

    // Cleanup
    await db.delete(knowledgeItems).where(eq(knowledgeItems.id, knowledgeItem.id));
  });
});

describe('agentTasks schema', () => {
  test('creates task with source field', async () => {
    const [task] = await db.insert(agentTasks).values({
      teamId: testTeamId,
      assignedToId: testAgentId,
      assignedById: testAgentId,
      task: 'Test task',
      source: 'user',
    }).returning();

    expect(task.source).toBe('user');
    expect(task.status).toBe('pending');

    // Cleanup
    await db.delete(agentTasks).where(eq(agentTasks.id, task.id));
  });

  test('source defaults to delegation', async () => {
    const [task] = await db.insert(agentTasks).values({
      teamId: testTeamId,
      assignedToId: testAgentId,
      assignedById: testAgentId,
      task: 'Delegated task',
    }).returning();

    expect(task.source).toBe('delegation');

    // Cleanup
    await db.delete(agentTasks).where(eq(agentTasks.id, task.id));
  });

  test('supports all source types', async () => {
    const sourceTypes = ['delegation', 'user', 'system', 'self'] as const;
    const createdTaskIds: string[] = [];

    for (const source of sourceTypes) {
      const [task] = await db.insert(agentTasks).values({
        teamId: testTeamId,
        assignedToId: testAgentId,
        assignedById: testAgentId,
        task: `Task from ${source}`,
        source,
      }).returning();

      expect(task.source).toBe(source);
      createdTaskIds.push(task.id);
    }

    // Cleanup
    for (const taskId of createdTaskIds) {
      await db.delete(agentTasks).where(eq(agentTasks.id, taskId));
    }
  });

  test('supports status transitions', async () => {
    const [task] = await db.insert(agentTasks).values({
      teamId: testTeamId,
      assignedToId: testAgentId,
      assignedById: testAgentId,
      task: 'Status transition test',
      source: 'system',
    }).returning();

    expect(task.status).toBe('pending');

    // Transition to in_progress
    await db.update(agentTasks)
      .set({ status: 'in_progress' })
      .where(eq(agentTasks.id, task.id));

    let [updated] = await db.select().from(agentTasks).where(eq(agentTasks.id, task.id));
    expect(updated.status).toBe('in_progress');

    // Transition to completed
    const completedAt = new Date();
    await db.update(agentTasks)
      .set({ status: 'completed', completedAt, result: 'Task completed successfully' })
      .where(eq(agentTasks.id, task.id));

    [updated] = await db.select().from(agentTasks).where(eq(agentTasks.id, task.id));
    expect(updated.status).toBe('completed');
    expect(updated.completedAt).toBeDefined();
    expect(updated.result).toBe('Task completed successfully');

    // Cleanup
    await db.delete(agentTasks).where(eq(agentTasks.id, task.id));
  });
});

describe('agents schema', () => {
  test('has nextRunAt and lastCompletedAt fields', async () => {
    const now = new Date();

    await db.update(agents)
      .set({ nextRunAt: now, lastCompletedAt: now })
      .where(eq(agents.id, testAgentId));

    const [updated] = await db.select().from(agents).where(eq(agents.id, testAgentId));

    expect(updated.nextRunAt).toBeDefined();
    expect(updated.lastCompletedAt).toBeDefined();

    // Reset
    await db.update(agents)
      .set({ nextRunAt: null, lastCompletedAt: null })
      .where(eq(agents.id, testAgentId));
  });
});
