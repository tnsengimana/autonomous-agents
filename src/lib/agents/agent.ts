import { getAgentById, updateAgentStatus } from '@/lib/db/queries/agents';
import { getMemoriesByAgentId } from '@/lib/db/queries/memories';
import {
  getActiveConversation,
  buildMessageContext,
  addUserMessage,
  addAssistantMessage,
  trimMessagesToTokenBudget,
} from './conversation';
import {
  streamLLMResponse,
  streamLLMResponseWithTools,
  generateLLMResponse,
  generateLLMObject,
  type StreamOptions,
} from './llm';
import {
  getBackgroundTools,
  type ToolContext,
} from './tools';
import {
  extractAndPersistMemories,
  buildMemoryContextBlock,
} from './memory';
import {
  extractInsightsFromThread,
  buildInsightsContextBlock,
  loadInsights,
} from './insights';
import {
  startWorkSession,
  endWorkSession,
  addToThread,
  buildThreadContext,
  shouldCompact,
  compactWithSummary,
  getMessages as getThreadMessages,
  threadMessagesToLLMFormat,
} from './thread';
import { queueUserTask, claimNextTask, getQueueStatus } from './taskQueue';
import type {
  Agent as AgentData,
  AgentTask,
  Memory,
  Insight,
  Conversation,
  LLMMessage,
} from '@/lib/types';
import { z } from 'zod';

// ============================================================================
// Agent Configuration
// ============================================================================

const DEFAULT_MAX_CONTEXT_TOKENS = 8000;
const DEFAULT_MAX_RESPONSE_TOKENS = 2000;

// Work session configuration
const MAX_THREAD_MESSAGES_BEFORE_COMPACT = 50;
const TEAM_LEAD_NEXT_RUN_HOURS = 24; // 1 day

// ============================================================================
// Agent Class
// ============================================================================

export class Agent {
  readonly id: string;
  readonly teamId: string;
  readonly name: string;
  readonly role: string;
  readonly systemPrompt: string;
  readonly parentAgentId: string | null;

  private conversation: Conversation | null = null;
  private memories: Memory[] = [];
  private insights: Insight[] = [];
  private llmOptions: StreamOptions;

  constructor(data: AgentData, llmOptions: StreamOptions = {}) {
    this.id = data.id;
    this.teamId = data.teamId;
    this.name = data.name;
    this.role = data.role;
    this.systemPrompt = data.systemPrompt ?? this.getDefaultSystemPrompt();
    this.parentAgentId = data.parentAgentId;
    this.llmOptions = {
      teamId: data.teamId,
      ...llmOptions,
    };
  }

  /**
   * Create an Agent instance from a database record
   */
  static async fromId(
    agentId: string,
    llmOptions: StreamOptions = {}
  ): Promise<Agent | null> {
    const data = await getAgentById(agentId);
    if (!data) {
      return null;
    }
    return new Agent(data, llmOptions);
  }

  /**
   * Check if this agent is a team lead (no parent)
   */
  isTeamLead(): boolean {
    return this.parentAgentId === null;
  }

  // ============================================================================
  // Memory Management (for foreground/user conversations)
  // ============================================================================

  /**
   * Load memories from the database
   */
  async loadMemories(): Promise<Memory[]> {
    this.memories = await getMemoriesByAgentId(this.id);
    return this.memories;
  }

  /**
   * Get currently loaded memories
   */
  getMemories(): Memory[] {
    return this.memories;
  }

  // ============================================================================
  // Insight Management (for background/work sessions)
  // ============================================================================

  /**
   * Load insights from the database
   */
  async loadInsights(): Promise<Insight[]> {
    this.insights = await loadInsights(this.id);
    return this.insights;
  }

  /**
   * Get currently loaded insights
   */
  getInsights(): Insight[] {
    return this.insights;
  }

  // ============================================================================
  // Conversation Management
  // ============================================================================

  /**
   * Ensure conversation is loaded
   */
  private async ensureConversation(): Promise<Conversation> {
    if (!this.conversation) {
      this.conversation = await getActiveConversation(this.id);
    }
    return this.conversation;
  }

  /**
   * Get the current conversation
   */
  async getConversation(): Promise<Conversation> {
    return this.ensureConversation();
  }

  // ============================================================================
  // Context Building
  // ============================================================================

  /**
   * Get the default system prompt for this agent
   */
  private getDefaultSystemPrompt(): string {
    return `You are ${this.name}, a ${this.role}.

Your primary responsibilities are to:
1. Understand and respond to user queries relevant to your role
2. Provide accurate and helpful information
3. Learn from interactions to improve future responses

Always be professional, concise, and focused on your role.`;
  }

  /**
   * Build the full system prompt including memory context (for foreground)
   */
  buildSystemPrompt(): string {
    const memoryBlock = buildMemoryContextBlock(this.memories);

    if (memoryBlock) {
      return `${this.systemPrompt}\n\n${memoryBlock}`;
    }

    return this.systemPrompt;
  }

  /**
   * Build the system prompt with insights context (for background work)
   */
  buildBackgroundSystemPrompt(): string {
    const insightsBlock = buildInsightsContextBlock(this.insights);

    if (insightsBlock) {
      return `${this.systemPrompt}\n\n${insightsBlock}`;
    }

    return this.systemPrompt;
  }

  /**
   * Build the complete context for an LLM call
   */
  async buildContext(
    maxTokens: number = DEFAULT_MAX_CONTEXT_TOKENS
  ): Promise<LLMMessage[]> {
    const conversation = await this.ensureConversation();
    const messages = await buildMessageContext(conversation.id);

    // Trim to fit within token budget
    return trimMessagesToTokenBudget(messages, maxTokens);
  }

  // ============================================================================
  // NEW: Foreground Message Handling (User Conversations)
  // ============================================================================

  /**
   * Handle a user message in the foreground (user conversation)
   *
   * This method:
   * 1. Loads MEMORIES for user context
   * 2. Adds user message to conversation
   * 3. Generates a quick contextual acknowledgment
   * 4. Adds ack to conversation
   * 5. Queues the task for background processing
   * 6. Returns the acknowledgment as a stream
   */
  async handleUserMessage(content: string): Promise<AsyncIterable<string>> {
    // 1. Load memories for user context (not insights)
    await this.loadMemories();
    const conversation = await this.ensureConversation();

    // 2. Add user message to conversation
    await addUserMessage(conversation.id, content);

    // 3. Generate quick contextual acknowledgment
    const ackPrompt = `The user just sent you this message:
"${content}"

Generate a brief, natural acknowledgment (1-2 sentences) that shows you understand what they're asking for.
Don't answer the question yet - just acknowledge that you'll look into it.
Examples:
- "I'll look into the latest NVIDIA earnings for you."
- "Let me research current market trends for semiconductor stocks."
- "I'll analyze your portfolio's performance and get back to you."`;

    const systemPrompt = this.buildSystemPrompt();
    const ackResponse = await generateLLMResponse(
      [{ role: 'user', content: ackPrompt }],
      systemPrompt,
      {
        ...this.llmOptions,
        maxOutputTokens: 100, // Keep it short
        temperature: 0.7,
      }
    );

    const acknowledgment = ackResponse.content;

    // 4. Add acknowledgment to conversation
    await addAssistantMessage(conversation.id, acknowledgment);

    // 5. Queue task for background processing
    await queueUserTask(this.id, this.teamId, content);

    // 6. Return the acknowledgment as a stream (for API compatibility)
    async function* streamAck(): AsyncGenerator<string> {
      // Yield the acknowledgment in chunks for streaming feel
      const words = acknowledgment.split(' ');
      for (const word of words) {
        yield word + ' ';
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    }

    // Extract memories in background (from user message + ack)
    this.extractMemoriesInBackground(content, acknowledgment, '');

    return streamAck();
  }

  // ============================================================================
  // NEW: Background Work Session (Thread-based processing)
  // ============================================================================

  /**
   * Run a work session to process queued tasks
   *
   * This is the main entry point for background processing:
   * 1. Creates a new thread for this session
   * 2. Loads INSIGHTS for work context (not memories)
   * 3. Processes all pending tasks in queue
   * 4. When queue empty:
   *    - Extracts insights from thread
   *    - Marks thread completed
   *    - Team lead: decides on briefing
   *    - Schedules next run
   */
  async runWorkSession(): Promise<void> {
    // Check if there's work to do
    const queueStatus = await getQueueStatus(this.id);
    if (!queueStatus.hasPendingWork) {
      console.log(`[Agent ${this.name}] No pending work, skipping session`);
      return;
    }

    console.log(
      `[Agent ${this.name}] Starting work session with ${queueStatus.pendingCount} pending tasks`
    );

    await this.setStatus('running');

    try {
      // 1. Create new thread for this session
      const { threadId } = await startWorkSession(this.id);

      // 2. Load INSIGHTS for work context (not memories)
      await this.loadInsights();

      // 3. Process all pending tasks in queue (loop)
      let task = await claimNextTask(this.id);
      while (task) {
        console.log(`[Agent ${this.name}] Processing task: ${task.id}`);

        try {
          const result = await this.processTaskInThread(threadId, task);
          console.log(
            `[Agent ${this.name}] Task ${task.id} completed: ${result.slice(0, 100)}...`
          );
        } catch (error) {
          console.error(
            `[Agent ${this.name}] Task ${task.id} failed:`,
            error
          );
          // Mark task as failed
          const { failTask } = await import('@/lib/db/queries/agentTasks');
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          await failTask(task.id, errorMessage);
        }

        // Get next task
        task = await claimNextTask(this.id);
      }

      // 4. Queue empty - wrap up the session
      console.log(`[Agent ${this.name}] All tasks processed, wrapping up session`);

      // Extract insights from thread
      const newInsights = await extractInsightsFromThread(
        threadId,
        this.id,
        this.role,
        this.llmOptions
      );
      console.log(
        `[Agent ${this.name}] Extracted ${newInsights.length} insights from session`
      );

      // Mark thread completed
      await endWorkSession(threadId);

      // Team lead: decide on briefing
      if (this.isTeamLead()) {
        await this.decideBriefing(threadId);
      }

      // Schedule next run (team lead: 1 day, subordinate: none - triggered by delegation)
      if (this.isTeamLead()) {
        await this.scheduleNextRun(TEAM_LEAD_NEXT_RUN_HOURS);
      }
    } catch (error) {
      console.error(`[Agent ${this.name}] Work session failed:`, error);
    } finally {
      await this.setStatus('idle');
    }
  }

  /**
   * Process a single task within a thread
   */
  async processTaskInThread(threadId: string, task: AgentTask): Promise<string> {
    // 1. Add task as "user" message to thread (agent is the user here)
    const taskMessage = `Task from ${task.source}: ${task.task}`;
    await addToThread(threadId, 'user', taskMessage);

    // 2. Build context from thread messages + INSIGHTS
    // Note: threadContext is used implicitly when we fetch messages below for the LLM call
    await buildThreadContext(threadId);
    const systemPrompt = this.buildBackgroundSystemPrompt();

    // 3. Get tools for background work
    const tools = getBackgroundTools(this.isTeamLead());
    const toolContext: ToolContext = {
      agentId: this.id,
      teamId: this.teamId,
      isTeamLead: this.isTeamLead(),
    };

    // 4. Call LLM with tools
    const result = await streamLLMResponseWithTools(
      threadMessagesToLLMFormat(
        (await getThreadMessages(threadId)).map((m) => ({
          ...m,
          toolCalls: null,
          createdAt: new Date(),
        }))
      ),
      systemPrompt,
      {
        ...this.llmOptions,
        tools,
        toolContext,
        maxSteps: 10, // Allow multiple tool calls
        maxOutputTokens: DEFAULT_MAX_RESPONSE_TOKENS,
      }
    );

    // 5. Consume stream and get response
    const fullResponse = await result.fullResponse;

    // 6. Add response to thread
    await addToThread(threadId, 'assistant', fullResponse.text, fullResponse.toolCalls);

    // 7. Check if should compact thread
    if (await shouldCompact(threadId, MAX_THREAD_MESSAGES_BEFORE_COMPACT)) {
      await this.compactThread(threadId);
    }

    // 8. Mark task complete with result
    const { completeTaskWithResult } = await import('@/lib/db/queries/agentTasks');
    await completeTaskWithResult(task.id, fullResponse.text);

    return fullResponse.text;
  }

  /**
   * Compact a thread by summarizing its content
   */
  private async compactThread(threadId: string): Promise<void> {
    const messages = await getThreadMessages(threadId);

    // Generate summary
    const summaryPrompt = `Summarize the key points from this work session conversation for context in future messages. Focus on:
- What tasks were completed
- Key decisions made
- Important findings
- Outstanding items

Conversation:
${messages.map((m) => `[${m.role}]: ${m.content}`).join('\n\n')}`;

    const summaryResponse = await generateLLMResponse(
      [{ role: 'user', content: summaryPrompt }],
      'You are a concise summarizer. Create a brief summary (2-3 paragraphs max).',
      {
        ...this.llmOptions,
        maxOutputTokens: 500,
      }
    );

    await compactWithSummary(threadId, summaryResponse.content);
    console.log(`[Agent ${this.name}] Thread compacted`);
  }

  // ============================================================================
  // NEW: Briefing Decision (Team Lead Only)
  // ============================================================================

  /**
   * Decide whether to brief the user based on work session results
   */
  async decideBriefing(threadId: string): Promise<void> {
    if (!this.isTeamLead()) return;

    // Get thread messages for review
    const messages = await getThreadMessages(threadId);
    if (messages.length === 0) return;

    // Build summary of work done
    const workSummary = messages
      .filter((m) => m.role === 'assistant')
      .map((m) => m.content)
      .join('\n\n')
      .slice(0, 2000); // Limit context size

    // Schema for briefing decision
    const BriefingDecisionSchema = z.object({
      shouldBrief: z
        .boolean()
        .describe('Whether this work warrants notifying the user'),
      reason: z.string().describe('Brief reason for the decision'),
      title: z.string().optional().describe('Title for the briefing if shouldBrief is true'),
      summary: z.string().optional().describe('Summary for inbox if shouldBrief is true'),
      fullMessage: z
        .string()
        .optional()
        .describe('Full briefing message if shouldBrief is true'),
    });

    // Ask LLM to decide
    const decisionPrompt = `Review this work session and decide if the user should be briefed.

Work completed:
${workSummary}

Guidelines for briefing:
- Brief if there are significant findings, insights, or completed user requests
- Brief if there are important market signals or alerts
- DO NOT brief for routine maintenance, minor updates, or no-op sessions
- The user should not be overwhelmed with notifications

If briefing is warranted, provide:
- A concise title
- A brief summary (1-2 sentences for the inbox)
- A full message with details for the conversation`;

    try {
      const decision = await generateLLMObject(
        [{ role: 'user', content: decisionPrompt }],
        BriefingDecisionSchema,
        'You are a thoughtful assistant deciding what warrants user attention.',
        {
          ...this.llmOptions,
          temperature: 0.3,
        }
      );

      if (decision.shouldBrief && decision.title && decision.summary && decision.fullMessage) {
        console.log(`[Agent ${this.name}] Creating briefing: ${decision.title}`);

        // Get user ID
        const { getTeamUserId } = await import('@/lib/db/queries/teams');
        const userId = await getTeamUserId(this.teamId);
        if (!userId) {
          console.error(`[Agent ${this.name}] No user found for team`);
          return;
        }

        // Create inbox item
        const { createInboxItem } = await import('@/lib/db/queries/inboxItems');
        await createInboxItem({
          userId,
          teamId: this.teamId,
          agentId: this.id,
          type: 'briefing',
          title: decision.title,
          content: decision.summary,
        });

        // Add full message to user conversation
        const conversation = await this.ensureConversation();
        await addAssistantMessage(conversation.id, decision.fullMessage);

        console.log(`[Agent ${this.name}] Briefing sent successfully`);
      } else {
        console.log(
          `[Agent ${this.name}] No briefing needed: ${decision.reason}`
        );
      }
    } catch (error) {
      console.error(`[Agent ${this.name}] Failed to decide briefing:`, error);
    }
  }

  /**
   * Schedule the next work session run
   */
  private async scheduleNextRun(hours: number): Promise<void> {
    const { updateAgentNextRunAt } = await import('@/lib/db/queries/agents');
    const nextRun = new Date(Date.now() + hours * 60 * 60 * 1000);
    await updateAgentNextRunAt(this.id, nextRun);
    console.log(`[Agent ${this.name}] Next run scheduled for ${nextRun.toISOString()}`);
  }

  // ============================================================================
  // LEGACY: Message Handling (kept for backwards compatibility)
  // ============================================================================

  /**
   * Handle an incoming message and stream the response
   * Returns an async iterable that yields response chunks
   *
   * @deprecated Use handleUserMessage for the new foreground/background architecture
   */
  async handleMessage(
    content: string,
    _from: 'user' | string = 'user'
  ): Promise<AsyncIterable<string>> {
    // Ensure we have loaded memories and conversation
    await this.loadMemories();
    const conversation = await this.ensureConversation();

    // Add user message to conversation
    await addUserMessage(conversation.id, content);

    // Build context
    const context = await this.buildContext();
    const systemPrompt = this.buildSystemPrompt();

    // Add the new user message to context
    const messagesWithNew: LLMMessage[] = [
      ...context,
      { role: 'user', content },
    ];

    // Stream response from LLM
    const responseStream = await streamLLMResponse(
      messagesWithNew,
      systemPrompt,
      {
        ...this.llmOptions,
        maxOutputTokens: DEFAULT_MAX_RESPONSE_TOKENS,
      }
    );

    // Create a wrapper that collects the full response for memory extraction
    // Use arrow function to preserve 'this' context
    const extractMemories = this.extractMemoriesInBackground.bind(this);
    const wrappedStream = async function* (): AsyncGenerator<string> {
      let fullResponse = '';

      for await (const chunk of responseStream) {
        fullResponse += chunk;
        yield chunk;
      }

      // After streaming completes, persist the response and extract memories
      const assistantMessage = await addAssistantMessage(
        conversation.id,
        fullResponse
      );

      // Extract and persist memories (async, don't block)
      extractMemories(content, fullResponse, assistantMessage.id);
    };

    return wrappedStream();
  }

  /**
   * Handle a message and return the complete response (non-streaming)
   *
   * @deprecated Use handleUserMessage for the new foreground/background architecture
   */
  async handleMessageSync(
    content: string,
    from: 'user' | string = 'user'
  ): Promise<string> {
    const stream = await this.handleMessage(content, from);
    let fullResponse = '';

    for await (const chunk of stream) {
      fullResponse += chunk;
    }

    return fullResponse;
  }

  /**
   * Extract memories in the background (fire and forget)
   */
  private extractMemoriesInBackground(
    userMessage: string,
    assistantResponse: string,
    sourceMessageId: string
  ): void {
    extractAndPersistMemories(
      this.id,
      userMessage,
      assistantResponse,
      this.role,
      sourceMessageId,
      this.llmOptions
    ).catch((error) => {
      console.error(`Memory extraction failed for agent ${this.id}:`, error);
    });
  }

  // ============================================================================
  // Agent Status
  // ============================================================================

  /**
   * Update this agent's status in the database
   */
  async setStatus(status: 'idle' | 'running' | 'paused'): Promise<void> {
    await updateAgentStatus(this.id, status);
  }
}

// ============================================================================
// Agent Factory
// ============================================================================

/**
 * Create an agent from a database ID
 */
export async function createAgent(
  agentId: string,
  llmOptions: StreamOptions = {}
): Promise<Agent | null> {
  return Agent.fromId(agentId, llmOptions);
}

/**
 * Create an agent from data
 */
export function createAgentFromData(
  data: AgentData,
  llmOptions: StreamOptions = {}
): Agent {
  return new Agent(data, llmOptions);
}
