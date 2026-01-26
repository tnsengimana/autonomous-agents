/**
 * Tests for Agent Lifecycle - Phase 4 Implementation
 *
 * Tests cover:
 * - handleUserMessage flow (queue task, return ack)
 * - runWorkSession flow (thread creation, task processing, knowledge extraction)
 * - decideBriefing (team lead vs subordinate)
 * - Knowledge item tools (add, list, remove)
 *
 * Uses MOCK_LLM=true for testing without real API calls.
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { db } from '@/lib/db/client';
import { users, teams, agents, agentTasks, knowledgeItems, threads, threadMessages, messages } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

// Import the Agent class and related functions
import { createAgent, createAgentFromData } from '@/lib/agents/agent';
import { queueUserTask, getQueueStatus } from '@/lib/agents/taskQueue';
import { registerKnowledgeItemTools } from '@/lib/agents/tools/knowledge-item-tools';
import { getTool, executeTool, type ToolContext } from '@/lib/agents/tools';
import { createKnowledgeItem, getKnowledgeItemsByAgentId, deleteKnowledgeItem } from '@/lib/db/queries/knowledge-items';
import { createThread } from '@/lib/db/queries/threads';

// ============================================================================
// Test Setup
// ============================================================================

let testUserId: string;
let testTeamId: string;
let testTeamLeadId: string;
let testSubordinateId: string;

beforeAll(async () => {
  // Enable mock LLM mode for testing
  process.env.MOCK_LLM = 'true';

  // Create test user
  const [user] = await db.insert(users).values({
    email: `agent-lifecycle-test-${Date.now()}@example.com`,
    name: 'Agent Lifecycle Test User',
  }).returning();
  testUserId = user.id;

  // Create test team (active status for runWorkSession)
  const [team] = await db.insert(teams).values({
    userId: testUserId,
    name: 'Agent Lifecycle Test Team',
    purpose: 'Testing agent lifecycle methods',
    status: 'active',
  }).returning();
  testTeamId = team.id;

  // Create team lead agent (no parent)
  const [teamLead] = await db.insert(agents).values({
    teamId: testTeamId,
    name: 'Test Team Lead',
    role: 'Financial Analyst',
    parentAgentId: null,
  }).returning();
  testTeamLeadId = teamLead.id;

  // Create subordinate agent (has parent)
  const [subordinate] = await db.insert(agents).values({
    teamId: testTeamId,
    name: 'Test Subordinate',
    role: 'Research Assistant',
    parentAgentId: testTeamLeadId,
  }).returning();
  testSubordinateId = subordinate.id;

  // Register knowledge item tools
  registerKnowledgeItemTools();
});

afterAll(async () => {
  // Cleanup: delete test user (cascades to teams, agents, tasks, etc.)
  await db.delete(users).where(eq(users.id, testUserId));
  delete process.env.MOCK_LLM;
});

// Helper to cleanup data created during tests
async function cleanupTestData() {
  // Clean up tasks, knowledge items, threads, messages for test agents
  await db.delete(agentTasks).where(eq(agentTasks.teamId, testTeamId));
  await db.delete(knowledgeItems).where(eq(knowledgeItems.agentId, testTeamLeadId));
  await db.delete(knowledgeItems).where(eq(knowledgeItems.agentId, testSubordinateId));
  await db.delete(threads).where(eq(threads.agentId, testTeamLeadId));
  await db.delete(threads).where(eq(threads.agentId, testSubordinateId));
}

beforeEach(async () => {
  await cleanupTestData();
});

// ============================================================================
// Agent Class Basic Tests
// ============================================================================

describe('Agent Class', () => {
  test('creates agent from database ID', async () => {
    const agent = await createAgent(testTeamLeadId);

    expect(agent).not.toBeNull();
    expect(agent!.id).toBe(testTeamLeadId);
    expect(agent!.name).toBe('Test Team Lead');
    expect(agent!.role).toBe('Financial Analyst');
  });

  test('returns null for non-existent agent ID', async () => {
    const agent = await createAgent('00000000-0000-0000-0000-000000000000');
    expect(agent).toBeNull();
  });

  test('isTeamLead() returns true for team lead', async () => {
    const agent = await createAgent(testTeamLeadId);
    expect(agent!.isTeamLead()).toBe(true);
  });

  test('isTeamLead() returns false for subordinate', async () => {
    const agent = await createAgent(testSubordinateId);
    expect(agent!.isTeamLead()).toBe(false);
  });

  test('creates agent from data object', () => {
    const data = {
      id: 'test-id',
      teamId: testTeamId,
      name: 'Direct Agent',
      role: 'Tester',
      parentAgentId: null,
      systemPrompt: null,
      status: 'idle' as const,
      nextRunAt: null,
      lastCompletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const agent = createAgentFromData(data);
    expect(agent.id).toBe('test-id');
    expect(agent.name).toBe('Direct Agent');
    expect(agent.isTeamLead()).toBe(true);
  });
});

// ============================================================================
// handleUserMessage Tests
// ============================================================================

describe('handleUserMessage', () => {
  test('queues task with source=user', async () => {
    const agent = await createAgent(testTeamLeadId);
    const userMessage = 'What is the current price of NVDA?';

    // Call handleUserMessage (uses mock LLM)
    const stream = await agent!.handleUserMessage(userMessage);

    // Consume the stream
    for await (const _ of stream) { /* consume */ }

    // Verify task was queued
    const status = await getQueueStatus(testTeamLeadId);
    expect(status.hasPendingWork).toBe(true);
    expect(status.pendingCount).toBe(1);

    // Verify task has correct source
    const [task] = await db.select().from(agentTasks)
      .where(and(
        eq(agentTasks.assignedToId, testTeamLeadId),
        eq(agentTasks.status, 'pending')
      ));
    expect(task.source).toBe('user');
    expect(task.task).toBe(userMessage);
  });

  test('returns acknowledgment stream', async () => {
    const agent = await createAgent(testTeamLeadId);
    const stream = await agent!.handleUserMessage('Tell me about NVIDIA');

    // Consume the stream and verify it yields chunks
    let fullResponse = '';
    let chunkCount = 0;
    for await (const chunk of stream) {
      fullResponse += chunk;
      chunkCount++;
    }

    // Should have yielded multiple chunks (word by word)
    expect(chunkCount).toBeGreaterThan(1);
    // Content should be non-empty (mock response)
    expect(fullResponse.trim().length).toBeGreaterThan(0);
  });

  test('adds user message and acknowledgment to conversation', async () => {
    const agent = await createAgent(testTeamLeadId);
    const userMessage = 'Check my portfolio';

    // Call handleUserMessage
    const stream = await agent!.handleUserMessage(userMessage);
    for await (const _ of stream) { /* consume stream */ }

    // Get conversation and messages
    const conversation = await agent!.getConversation();
    const conversationMessages = await db.select().from(messages)
      .where(eq(messages.conversationId, conversation.id));

    // Should have at least 2 messages (user + assistant acknowledgment)
    expect(conversationMessages.length).toBeGreaterThanOrEqual(2);

    // Find user message
    const userMsg = conversationMessages.find(m => m.role === 'user' && m.content === userMessage);
    expect(userMsg).toBeDefined();

    // Find assistant acknowledgment
    const assistantMsg = conversationMessages.find(m => m.role === 'assistant');
    expect(assistantMsg).toBeDefined();
  });

  test('loads memories before generating acknowledgment', async () => {
    const agent = await createAgent(testTeamLeadId);

    // Initially no memories loaded
    expect(agent!.getMemories()).toHaveLength(0);

    const stream = await agent!.handleUserMessage('Test message');
    for await (const _ of stream) { /* consume stream */ }

    // Memories should now be loaded (empty array, but loaded)
    expect(agent!.getMemories()).toEqual([]);
  });
});

// ============================================================================
// runWorkSession Tests
// ============================================================================

describe('runWorkSession', () => {
  test('skips session when no pending work', async () => {
    const agent = await createAgent(testTeamLeadId);

    // Verify no pending work
    const statusBefore = await getQueueStatus(testTeamLeadId);
    expect(statusBefore.hasPendingWork).toBe(false);

    // Run work session - should complete without creating thread
    await agent!.runWorkSession();

    // Verify no thread was created
    const threadList = await db.select().from(threads)
      .where(eq(threads.agentId, testTeamLeadId));
    expect(threadList.length).toBe(0);
  });

  test('creates new thread for session', async () => {
    // Queue a task first
    await queueUserTask(testTeamLeadId, testTeamId, 'Test task');

    const agent = await createAgent(testTeamLeadId);
    await agent!.runWorkSession();

    // Verify thread was created
    const threadList = await db.select().from(threads)
      .where(eq(threads.agentId, testTeamLeadId));
    expect(threadList.length).toBeGreaterThan(0);
  });

  test('processes pending tasks in queue', async () => {
    // Queue multiple tasks
    await queueUserTask(testTeamLeadId, testTeamId, 'Task 1');
    await queueUserTask(testTeamLeadId, testTeamId, 'Task 2');

    const statusBefore = await getQueueStatus(testTeamLeadId);
    expect(statusBefore.pendingCount).toBe(2);

    const agent = await createAgent(testTeamLeadId);
    await agent!.runWorkSession();

    // All tasks should be processed (no pending)
    const statusAfter = await getQueueStatus(testTeamLeadId);
    expect(statusAfter.pendingCount).toBe(0);
    expect(statusAfter.inProgressCount).toBe(0);
  });

  test('loads knowledge items not memories for background work', async () => {
    // Create some knowledge items for the agent
    await createKnowledgeItem(testTeamLeadId, 'fact', 'NVIDIA is a GPU company', undefined, 0.9);
    await createKnowledgeItem(testTeamLeadId, 'pattern', 'Tech stocks rise in Q4', undefined, 0.7);

    // Queue a task
    await queueUserTask(testTeamLeadId, testTeamId, 'Analyze market');

    const agent = await createAgent(testTeamLeadId);

    // Before session, no knowledge items loaded
    expect(agent!.getKnowledge()).toHaveLength(0);

    await agent!.runWorkSession();

    // After session, knowledge items should be loaded
    expect(agent!.getKnowledge()).toHaveLength(2);
  });

  test('team lead schedules next run after session', async () => {
    // Queue a task
    await queueUserTask(testTeamLeadId, testTeamId, 'Test task');

    const agent = await createAgent(testTeamLeadId);
    await agent!.runWorkSession();

    // Check that nextRunAt was set
    const [updatedAgent] = await db.select().from(agents)
      .where(eq(agents.id, testTeamLeadId));
    expect(updatedAgent.nextRunAt).not.toBeNull();

    // Should be approximately 1 day (24 hours) in the future
    const nextRun = new Date(updatedAgent.nextRunAt!);
    const now = new Date();
    const diffHours = (nextRun.getTime() - now.getTime()) / (1000 * 60 * 60);
    expect(diffHours).toBeGreaterThan(23.9);
    expect(diffHours).toBeLessThan(24.1);
  });

  test('subordinate does not schedule next run', async () => {
    // Queue a task for subordinate
    await queueUserTask(testSubordinateId, testTeamId, 'Subordinate task');

    const agent = await createAgent(testSubordinateId);
    await agent!.runWorkSession();

    // Subordinate should not have nextRunAt set
    const [updatedAgent] = await db.select().from(agents)
      .where(eq(agents.id, testSubordinateId));
    expect(updatedAgent.nextRunAt).toBeNull();
  });
});

// ============================================================================
// processTaskInThread Tests
// ============================================================================

describe('processTaskInThread', () => {
  test('adds task as user message to thread', async () => {
    // Create a thread manually
    const thread = await createThread(testTeamLeadId);

    // Queue a task
    const task = await queueUserTask(testTeamLeadId, testTeamId, 'Analyze TSLA stock');

    // Claim the task
    const { startTask } = await import('@/lib/db/queries/agentTasks');
    const claimedTask = await startTask(task.id);

    const agent = await createAgent(testTeamLeadId);
    await agent!.processTaskInThread(thread.id, claimedTask);

    // Verify thread has messages
    const threadMsgs = await db.select().from(threadMessages)
      .where(eq(threadMessages.threadId, thread.id));

    expect(threadMsgs.length).toBeGreaterThanOrEqual(2);

    // First message should be user (task)
    const userMsg = threadMsgs.find(m => m.role === 'user');
    expect(userMsg).toBeDefined();
    expect(userMsg!.content).toContain('TSLA');

    // Should have assistant response
    const assistantMsg = threadMsgs.find(m => m.role === 'assistant');
    expect(assistantMsg).toBeDefined();
  });

  test('marks task complete with result', async () => {
    const thread = await createThread(testTeamLeadId);
    const task = await queueUserTask(testTeamLeadId, testTeamId, 'Complete this');

    const { startTask } = await import('@/lib/db/queries/agentTasks');
    const claimedTask = await startTask(task.id);

    const agent = await createAgent(testTeamLeadId);
    const result = await agent!.processTaskInThread(thread.id, claimedTask);

    // Result should be non-empty (mock response)
    expect(result.length).toBeGreaterThan(0);

    // Verify task is completed
    const [updatedTask] = await db.select().from(agentTasks)
      .where(eq(agentTasks.id, task.id));
    expect(updatedTask.status).toBe('completed');
    expect(updatedTask.result).not.toBeNull();
  });
});

// ============================================================================
// decideBriefing Tests
// ============================================================================

describe('decideBriefing', () => {
  test('team lead decideBriefing does not error with empty thread', async () => {
    // Create a thread with no messages
    const thread = await createThread(testTeamLeadId);

    const agent = await createAgent(testTeamLeadId);

    // Should not throw - just return early
    await expect(agent!.decideBriefing(thread.id)).resolves.not.toThrow();
  });

  test('subordinate agent does not create briefings', async () => {
    const thread = await createThread(testSubordinateId);
    await db.insert(threadMessages).values({
      threadId: thread.id,
      role: 'assistant',
      content: 'Subordinate completed task with important info.',
      sequenceNumber: 1,
    });

    const agent = await createAgent(testSubordinateId);

    // Get conversation before
    const conversationBefore = await agent!.getConversation();
    const messagesBefore = await db.select().from(messages)
      .where(eq(messages.conversationId, conversationBefore.id));
    const countBefore = messagesBefore.length;

    await agent!.decideBriefing(thread.id);

    // Subordinate should not add any messages (decideBriefing returns early for subordinates)
    const messagesAfter = await db.select().from(messages)
      .where(eq(messages.conversationId, conversationBefore.id));
    expect(messagesAfter.length).toBe(countBefore);
  });

  test('isTeamLead check works in decideBriefing', async () => {
    const subordinateAgent = await createAgent(testSubordinateId);
    const teamLeadAgent = await createAgent(testTeamLeadId);

    expect(subordinateAgent!.isTeamLead()).toBe(false);
    expect(teamLeadAgent!.isTeamLead()).toBe(true);
  });
});

// ============================================================================
// Knowledge Item Tools Tests
// ============================================================================

describe('Knowledge Item Tools', () => {
  const toolContext: ToolContext = {
    agentId: '',
    teamId: '',
    isTeamLead: true,
  };

  beforeEach(() => {
    toolContext.agentId = testTeamLeadId;
    toolContext.teamId = testTeamId;
  });

  describe('addKnowledgeItem', () => {
    test('stores fact knowledge item successfully', async () => {
      const tool = getTool('addKnowledgeItem');
      expect(tool).toBeDefined();

      const result = await executeTool('addKnowledgeItem', {
        type: 'fact',
        content: 'NVIDIA dominates the AI chip market',
        confidence: 0.95,
      }, toolContext);

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('knowledgeItemId');

      // Verify in database
      const agentKnowledgeItems = await getKnowledgeItemsByAgentId(testTeamLeadId);
      expect(agentKnowledgeItems.some(k => k.content === 'NVIDIA dominates the AI chip market')).toBe(true);
    });

    test('stores technique knowledge item successfully', async () => {
      const result = await executeTool('addKnowledgeItem', {
        type: 'technique',
        content: 'Use RSI indicators for timing entries',
      }, toolContext);

      expect(result.success).toBe(true);

      const agentKnowledgeItems = await getKnowledgeItemsByAgentId(testTeamLeadId);
      const technique = agentKnowledgeItems.find(k => k.type === 'technique');
      expect(technique).toBeDefined();
      expect(technique!.content).toContain('RSI');
    });

    test('stores pattern knowledge item successfully', async () => {
      const result = await executeTool('addKnowledgeItem', {
        type: 'pattern',
        content: 'Tech stocks rally after earnings beats',
        confidence: 0.8,
      }, toolContext);

      expect(result.success).toBe(true);

      const agentKnowledgeItems = await getKnowledgeItemsByAgentId(testTeamLeadId);
      const pattern = agentKnowledgeItems.find(k => k.type === 'pattern');
      expect(pattern).toBeDefined();
      expect(pattern!.confidence).toBe(0.8);
    });

    test('stores lesson knowledge item successfully', async () => {
      const result = await executeTool('addKnowledgeItem', {
        type: 'lesson',
        content: 'Never chase momentum after major news',
      }, toolContext);

      expect(result.success).toBe(true);

      const agentKnowledgeItems = await getKnowledgeItemsByAgentId(testTeamLeadId);
      const lesson = agentKnowledgeItems.find(k => k.type === 'lesson');
      expect(lesson).toBeDefined();
    });

    test('fails with invalid type', async () => {
      const result = await executeTool('addKnowledgeItem', {
        type: 'invalid_type',
        content: 'Some content',
      }, toolContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid parameters');
    });

    test('fails with empty content', async () => {
      const result = await executeTool('addKnowledgeItem', {
        type: 'fact',
        content: '',
      }, toolContext);

      expect(result.success).toBe(false);
    });
  });

  describe('listKnowledgeItems', () => {
    test('lists all knowledge items for agent', async () => {
      // Create some knowledge items
      await createKnowledgeItem(testTeamLeadId, 'fact', 'Fact 1', undefined, 0.9);
      await createKnowledgeItem(testTeamLeadId, 'technique', 'Technique 1', undefined, 0.8);
      await createKnowledgeItem(testTeamLeadId, 'pattern', 'Pattern 1', undefined, 0.7);

      const result = await executeTool('listKnowledgeItems', {}, toolContext);

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('count');
      expect(result.data).toHaveProperty('knowledgeItems');
      expect((result.data as { count: number }).count).toBe(3);
    });

    test('filters by type', async () => {
      await createKnowledgeItem(testTeamLeadId, 'fact', 'Fact A');
      await createKnowledgeItem(testTeamLeadId, 'fact', 'Fact B');
      await createKnowledgeItem(testTeamLeadId, 'technique', 'Technique A');

      const result = await executeTool('listKnowledgeItems', {
        type: 'fact',
      }, toolContext);

      expect(result.success).toBe(true);
      const data = result.data as { count: number; knowledgeItems: Array<{ type: string }> };
      expect(data.count).toBe(2);
      expect(data.knowledgeItems.every(k => k.type === 'fact')).toBe(true);
    });

    test('respects limit parameter', async () => {
      // Create 5 knowledge items
      for (let i = 0; i < 5; i++) {
        await createKnowledgeItem(testTeamLeadId, 'fact', `Fact ${i}`);
      }

      const result = await executeTool('listKnowledgeItems', {
        limit: 3,
      }, toolContext);

      expect(result.success).toBe(true);
      const data = result.data as { count: number };
      expect(data.count).toBe(3);
    });

    test('returns empty array when no knowledge items', async () => {
      const result = await executeTool('listKnowledgeItems', {}, toolContext);

      expect(result.success).toBe(true);
      const data = result.data as { count: number; knowledgeItems: unknown[] };
      expect(data.count).toBe(0);
      expect(data.knowledgeItems).toEqual([]);
    });
  });

  describe('removeKnowledgeItem', () => {
    test('removes existing knowledge item', async () => {
      const knowledgeItem = await createKnowledgeItem(testTeamLeadId, 'fact', 'To be deleted');

      const result = await executeTool('removeKnowledgeItem', {
        knowledgeItemId: knowledgeItem.id,
      }, toolContext);

      expect(result.success).toBe(true);

      // Verify deleted
      const agentKnowledgeItems = await getKnowledgeItemsByAgentId(testTeamLeadId);
      expect(agentKnowledgeItems.find(k => k.id === knowledgeItem.id)).toBeUndefined();
    });

    test('fails for non-existent knowledge item', async () => {
      const result = await executeTool('removeKnowledgeItem', {
        knowledgeItemId: '00000000-0000-0000-0000-000000000000',
      }, toolContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    test('fails for knowledge item belonging to another agent', async () => {
      // Create knowledge item for subordinate
      const knowledgeItem = await createKnowledgeItem(testSubordinateId, 'fact', 'Subordinate knowledge item');

      // Try to delete from team lead context
      const result = await executeTool('removeKnowledgeItem', {
        knowledgeItemId: knowledgeItem.id,
      }, toolContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('other agents');

      // Cleanup
      await deleteKnowledgeItem(knowledgeItem.id);
    });

    test('fails with invalid UUID format', async () => {
      const result = await executeTool('removeKnowledgeItem', {
        knowledgeItemId: 'not-a-uuid',
      }, toolContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid parameters');
    });
  });
});

// ============================================================================
// Knowledge Context Building Tests
// ============================================================================

describe('Knowledge Context', () => {
  test('buildBackgroundSystemPrompt includes knowledge items', async () => {
    // Create some knowledge items
    await createKnowledgeItem(testTeamLeadId, 'fact', 'Important domain fact');
    await createKnowledgeItem(testTeamLeadId, 'technique', 'Useful technique');

    const agent = await createAgent(testTeamLeadId);
    await agent!.loadKnowledge();

    const systemPrompt = agent!.buildBackgroundSystemPrompt();

    expect(systemPrompt).toContain('professional_knowledge');
    expect(systemPrompt).toContain('Important domain fact');
    expect(systemPrompt).toContain('Useful technique');
  });

  test('buildBackgroundSystemPrompt handles no knowledge items', async () => {
    const agent = await createAgent(testTeamLeadId);
    await agent!.loadKnowledge();

    const systemPrompt = agent!.buildBackgroundSystemPrompt();

    // Should just be the base system prompt without knowledge block
    expect(systemPrompt).not.toContain('professional_knowledge');
  });
});

// ============================================================================
// Agent Status Tests
// ============================================================================

describe('Agent Status', () => {
  test('setStatus updates agent status', async () => {
    const agent = await createAgent(testTeamLeadId);

    await agent!.setStatus('running');

    const [updated] = await db.select().from(agents)
      .where(eq(agents.id, testTeamLeadId));
    expect(updated.status).toBe('running');

    await agent!.setStatus('idle');

    const [final] = await db.select().from(agents)
      .where(eq(agents.id, testTeamLeadId));
    expect(final.status).toBe('idle');
  });

  test('runWorkSession sets status to running then idle', async () => {
    await queueUserTask(testTeamLeadId, testTeamId, 'Test task');

    const agent = await createAgent(testTeamLeadId);
    await agent!.runWorkSession();

    // After session, status should be idle
    const [updated] = await db.select().from(agents)
      .where(eq(agents.id, testTeamLeadId));
    expect(updated.status).toBe('idle');
  });
});

// ============================================================================
// Edge Cases and Error Handling
// ============================================================================

describe('Edge Cases', () => {
  test('handleUserMessage handles empty message', async () => {
    const agent = await createAgent(testTeamLeadId);
    const stream = await agent!.handleUserMessage('');

    let response = '';
    for await (const chunk of stream) {
      response += chunk;
    }

    expect(response).toBeTruthy();

    // Task should still be queued
    const status = await getQueueStatus(testTeamLeadId);
    expect(status.pendingCount).toBe(1);
  });

  test('multiple concurrent handleUserMessage calls queue tasks correctly', async () => {
    const agent = await createAgent(testTeamLeadId);

    // Send multiple messages concurrently
    const promises = [
      agent!.handleUserMessage('Message 1'),
      agent!.handleUserMessage('Message 2'),
      agent!.handleUserMessage('Message 3'),
    ];

    const streams = await Promise.all(promises);

    // Consume all streams
    for (const stream of streams) {
      for await (const _ of stream) { /* consume */ }
    }

    // All tasks should be queued
    const status = await getQueueStatus(testTeamLeadId);
    expect(status.pendingCount).toBe(3);
  });
});
