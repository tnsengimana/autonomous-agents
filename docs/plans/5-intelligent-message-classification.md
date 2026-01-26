# Intelligent Message Classification

## Overview

Currently, every user message unconditionally queues a background task. This wastes resources when users are just chatting, asking simple questions, or providing feedback.

This design adds intelligent classification to determine whether a message is a work request or regular chat, responding appropriately for each.

## Message Classification

**Binary classification:**

| Type | Description | Example |
|------|-------------|---------|
| `work_request` | User explicitly asks for work/research/analysis | "Research NVIDIA earnings", "Analyze my portfolio" |
| `regular_chat` | Questions, greetings, feedback, discussion | "Hi", "Thanks!", "What do you think about tech stocks?" |

## Flow

```
User Message
    │
    ▼
┌─────────────────────────┐
│  LLM classifies intent  │
│  (work_request or       │
│   regular_chat)         │
└─────────────────────────┘
    │
    ├─── work_request ───────────────────┐
    │                                    │
    ▼                                    ▼
┌─────────────────────┐      ┌─────────────────────────┐
│ Quick ack:          │      │ Queue background task   │
│ "I'll research that │      │                         │
│  and notify you via │      │ Background worker       │
│  your inbox..."     │      │ processes later         │
└─────────────────────┘      └─────────────────────────┘
    │
    ├─── regular_chat ───────────────────┐
    │                                    │
    ▼                                    ▼
┌─────────────────────┐      ┌─────────────────────────┐
│ Full response       │      │ No task queued          │
│ (with tools if      │      │                         │
│  needed)            │      │ Agent may suggest:      │
│                     │      │ "Want me to research    │
└─────────────────────┘      │  this more deeply?"     │
                             └─────────────────────────┘
```

## Implementation

### Phase 1: Update Foreground Tools

**File: `src/lib/agents/tools/index.ts`**

Update `getForegroundTools()` to include research tools:

```typescript
export function getForegroundTools(): Tool[] {
  // All tools except background coordination tools
  const backgroundOnlyTools = [
    'delegateToAgent',
    'createInboxItem',
    'reportToLead',
    'requestInput',
  ];

  return getAllTools().filter(
    (tool) => !backgroundOnlyTools.includes(tool.schema.name)
  );
}
```

**Tool availability:**

| Tool | Foreground | Background |
|------|------------|------------|
| `tavilySearch` | ✅ | ✅ |
| `tavilyExtract` | ✅ | ✅ |
| `tavilyResearch` | ✅ | ✅ |
| `getTeamStatus` | ✅ | ✅ |
| `addKnowledgeItem` | ✅ | ✅ |
| `listKnowledgeItems` | ✅ | ✅ |
| `removeKnowledgeItem` | ✅ | ✅ |
| `delegateToAgent` | ❌ | ✅ |
| `createInboxItem` | ❌ | ✅ |
| `reportToLead` | ❌ | ✅ |
| `requestInput` | ❌ | ✅ |

---

### Phase 2: Add Intent Classification

**File: `src/lib/agents/agent.ts`**

Add new method to classify user intent:

```typescript
const UserIntentSchema = z.object({
  intent: z.enum(['work_request', 'regular_chat']),
  reasoning: z.string().describe('Brief explanation of classification'),
});

type UserIntent = 'work_request' | 'regular_chat';

async classifyUserIntent(content: string): Promise<UserIntent> {
  const prompt = `Classify this user message:
"${content}"

- work_request: User explicitly asks for work, research, or analysis to be done
  Examples: "Research NVIDIA earnings", "Analyze my portfolio", "Find articles about AI"

- regular_chat: Questions, greetings, feedback, discussion, simple lookups
  Examples: "Hi", "Thanks!", "What do you think about tech stocks?", "What's TSLA at?"`;

  const result = await generateLLMObject(
    [{ role: 'user', content: prompt }],
    UserIntentSchema,
    'Classify user intent',
    { maxOutputTokens: 100, temperature: 0 }
  );

  return result.intent;
}
```

---

### Phase 3: Add Response Generation Methods

**File: `src/lib/agents/agent.ts`**

Add method for work request acknowledgment:

```typescript
async generateWorkAcknowledgment(content: string): Promise<string> {
  const prompt = `The user just submitted this work request:
"${content}"

Generate a brief acknowledgment (1-2 sentences) that:
1. Shows you understand what they're asking for
2. Mentions you'll work on it and notify them via their inbox when done

Examples:
- "I'll research the latest NVIDIA earnings and notify you via your inbox when I have results."
- "I'll analyze your portfolio performance. You'll get a notification in your inbox once I'm done."`;

  const response = await generateLLMResponse(
    [{ role: 'user', content: prompt }],
    this.buildSystemPrompt(),
    { ...this.llmOptions, maxOutputTokens: 100, temperature: 0.7 }
  );

  return response.content;
}
```

Add method for regular chat response:

```typescript
async generateChatResponse(
  content: string,
  conversation: Conversation
): Promise<string> {
  const history = await getConversationMessages(conversation.id);

  const systemPrompt = this.buildForegroundSystemPrompt();
  // Includes instruction to suggest work submission if topic warrants deeper research

  const tools = getForegroundTools();
  const toolContext: ToolContext = {
    agentId: this.id,
    teamId: this.teamId,
    isTeamLead: this.isTeamLead(),
  };

  const response = await generateLLMResponseWithTools(
    history,
    systemPrompt,
    tools,
    toolContext,
    this.llmOptions
  );

  return response.content;
}
```

---

### Phase 4: Refactor handleUserMessage

**File: `src/lib/agents/agent.ts`**

Refactor main handler to use classification:

```typescript
async handleUserMessage(content: string): Promise<AsyncIterable<string>> {
  // 1. Load memories for user context
  await this.loadMemories();
  const conversation = await this.ensureConversation();

  // 2. Add user message to conversation
  await addUserMessage(conversation.id, content);

  // 3. Classify intent
  const intent = await this.classifyUserIntent(content);

  let response: string;

  if (intent === 'work_request') {
    // 4a. Work request: Quick ack + queue task
    response = await this.generateWorkAcknowledgment(content);
    await addAssistantMessage(conversation.id, response);
    await queueUserTask(this.id, this.teamId, content);
  } else {
    // 4b. Regular chat: Full response with tools
    response = await this.generateChatResponse(content, conversation);
    await addAssistantMessage(conversation.id, response);
    // No task queued
  }

  // 5. Extract memories in background
  this.extractMemoriesInBackground(content, response, '');

  // 6. Return response as stream
  return this.streamResponse(response);
}
```

---

### Phase 5: Update System Prompt

**File: `src/lib/agents/agent.ts`**

Add/update `buildForegroundSystemPrompt()` to include guidance:

```typescript
buildForegroundSystemPrompt(): string {
  const basePrompt = this.buildSystemPrompt();

  const foregroundGuidance = `
## Chat Guidelines

You are chatting directly with the user. You have access to tools for looking up information.

If the user's question would benefit from deeper research or extended analysis:
- Answer what you can now
- Suggest: "Would you like me to research this more thoroughly? I can work on it in the background and notify you when I have results."

Do NOT automatically queue background work - let the user decide if they want deeper research.`;

  return basePrompt + foregroundGuidance;
}
```

---

## Verification

1. **Build**: `npm run build` - no compilation errors
2. **Lint**: `npm run lint` - no warnings
3. **Test scenarios**:
   - "Research NVIDIA earnings" → work_request → ack + task queued
   - "Hi, how are you?" → regular_chat → direct response, no task
   - "What's TSLA at?" → regular_chat → uses tool, responds directly
   - "Can you analyze my portfolio?" → work_request → ack + task queued

---

## Summary

| Phase | File | Changes |
|-------|------|---------|
| 1 | `src/lib/agents/tools/index.ts` | Update `getForegroundTools()` |
| 2 | `src/lib/agents/agent.ts` | Add `classifyUserIntent()` |
| 3 | `src/lib/agents/agent.ts` | Add `generateWorkAcknowledgment()`, `generateChatResponse()` |
| 4 | `src/lib/agents/agent.ts` | Refactor `handleUserMessage()` |
| 5 | `src/lib/agents/agent.ts` | Add `buildForegroundSystemPrompt()` |
