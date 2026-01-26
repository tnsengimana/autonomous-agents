/**
 * Agent Core Runtime - re-export all agent modules
 */

// Agent class and factory
export { Agent, createAgent, createAgentFromData } from './agent';

// LLM provider abstraction
export {
  streamLLMResponse,
  generateLLMResponse,
  generateLLMObject,
  isProviderAvailable,
  getDefaultProvider,
  type StreamOptions,
  type GenerateOptions,
} from './llm';

// Memory management
export {
  extractMemories,
  extractAndPersistMemories,
  formatMemoriesForContext,
  buildMemoryContextBlock,
} from './memory';

// Conversation management
export {
  getActiveConversation,
  startNewConversation,
  getCurrentConversation,
  loadConversationHistory,
  loadRecentHistory,
  appendMessage,
  addUserMessage,
  addAssistantMessage,
  getConversationLastMessage,
  messagesToLLMFormat,
  buildMessageContext,
  estimateTokenCount,
  trimMessagesToTokenBudget,
  hasMessages,
  getMessageCount,
  getConversationSummary,
  type ConversationSummary,
} from './conversation';

// Conversation compaction
export {
  shouldCompact,
  compactIfNeeded,
  compactConversation,
  generateConversationSummary,
} from './compaction';

// Tools infrastructure
export {
  registerTool,
  getTool,
  getAllTools,
  getTeamLeadTools,
  getSubordinateTools,
  getToolSchemas,
  executeTool,
  toolSchemasToOpenAIFunctions,
  type Tool,
  type ToolSchema,
  type ToolContext,
  type ToolResult,
  type ToolHandler,
  type ToolParameter,
} from './tools';

// Team lead tools
export {
  registerTeamLeadTools,
  delegateToAgentTool,
  getTeamStatusTool,
  createInboxItemTool,
} from './tools/team-lead-tools';

// Subordinate tools
export {
  registerSubordinateTools,
  reportToLeadTool,
  requestInputTool,
} from './tools/subordinate-tools';

// Knowledge extraction and management
export {
  extractKnowledgeFromMessages,
  extractKnowledgeFromConversation,
  formatKnowledgeForContext,
  buildKnowledgeContextBlock,
  loadKnowledgeContext,
  loadKnowledge,
  type ExtractedKnowledgeItem,
} from './knowledge-items';
