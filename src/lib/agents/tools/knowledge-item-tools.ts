/**
 * Knowledge Item Management Tools
 *
 * Tools available during user conversations for managing professional knowledge.
 * Knowledge items are facts, techniques, patterns, and lessons learned during work.
 */

import {
  registerTool,
  type Tool,
  type ToolResult,
} from './index';
import {
  createKnowledgeItem,
  deleteKnowledgeItem,
  getRecentKnowledgeItems,
} from '@/lib/db/queries/knowledge-items';
import { z } from 'zod';
import type { KnowledgeItemType } from '@/lib/types';

// ============================================================================
// Parameter Schemas
// ============================================================================

export const AddKnowledgeItemParamsSchema = z.object({
  type: z
    .enum(['fact', 'technique', 'pattern', 'lesson'])
    .describe('The type of knowledge item'),
  content: z.string().min(1).describe('The knowledge item content to store'),
  confidence: z.number().min(0).max(1).optional().describe('Confidence level (0-1)'),
});

export const ListKnowledgeItemsParamsSchema = z.object({
  type: z
    .enum(['fact', 'technique', 'pattern', 'lesson'])
    .optional()
    .describe('Filter by knowledge item type'),
  limit: z.number().min(1).max(50).optional().describe('Maximum number of knowledge items to return'),
});

export const RemoveKnowledgeItemParamsSchema = z.object({
  knowledgeItemId: z.string().uuid().describe('The ID of the knowledge item to remove'),
});

export type AddKnowledgeItemParams = z.infer<typeof AddKnowledgeItemParamsSchema>;
export type ListKnowledgeItemsParams = z.infer<typeof ListKnowledgeItemsParamsSchema>;
export type RemoveKnowledgeItemParams = z.infer<typeof RemoveKnowledgeItemParamsSchema>;

// ============================================================================
// addKnowledgeItem Tool
// ============================================================================

const addKnowledgeItemTool: Tool = {
  schema: {
    name: 'addKnowledgeItem',
    description:
      'Store professional knowledge or a learning. Use this when the user shares valuable information about their domain, techniques that work, patterns observed, or lessons learned.',
    parameters: [
      {
        name: 'type',
        type: 'string',
        description: 'The type of knowledge item: fact (domain knowledge), technique (how to do something), pattern (observed trend), lesson (learning from experience)',
        required: true,
        enum: ['fact', 'technique', 'pattern', 'lesson'],
      },
      {
        name: 'content',
        type: 'string',
        description: 'The knowledge item content to store',
        required: true,
      },
      {
        name: 'confidence',
        type: 'number',
        description: 'Confidence level from 0 to 1 (optional)',
        required: false,
      },
    ],
  },
  handler: async (params, context): Promise<ToolResult> => {
    const parsed = AddKnowledgeItemParamsSchema.safeParse(params);
    if (!parsed.success) {
      return {
        success: false,
        error: `Invalid parameters: ${parsed.error.message}`,
      };
    }

    const { type, content, confidence } = parsed.data;

    try {
      const knowledgeItem = await createKnowledgeItem(
        context.agentId,
        type as KnowledgeItemType,
        content,
        undefined, // sourceThreadId - not available in foreground
        confidence
      );

      return {
        success: true,
        data: {
          knowledgeItemId: knowledgeItem.id,
          message: `Stored ${type} knowledge item successfully`,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to store knowledge item',
      };
    }
  },
};

// ============================================================================
// listKnowledgeItems Tool
// ============================================================================

const listKnowledgeItemsTool: Tool = {
  schema: {
    name: 'listKnowledgeItems',
    description:
      'List stored knowledge items for this agent. Useful for reviewing what professional knowledge has been accumulated.',
    parameters: [
      {
        name: 'type',
        type: 'string',
        description: 'Filter by knowledge item type (optional)',
        required: false,
        enum: ['fact', 'technique', 'pattern', 'lesson'],
      },
      {
        name: 'limit',
        type: 'number',
        description: 'Maximum number of knowledge items to return (default: 20)',
        required: false,
      },
    ],
  },
  handler: async (params, context): Promise<ToolResult> => {
    const parsed = ListKnowledgeItemsParamsSchema.safeParse(params);
    if (!parsed.success) {
      return {
        success: false,
        error: `Invalid parameters: ${parsed.error.message}`,
      };
    }

    const { type, limit = 20 } = parsed.data;

    try {
      let knowledgeItems;
      if (type) {
        const { getKnowledgeItemsByType } = await import('@/lib/db/queries/knowledge-items');
        knowledgeItems = await getKnowledgeItemsByType(context.agentId, type as KnowledgeItemType);
        knowledgeItems = knowledgeItems.slice(0, limit);
      } else {
        knowledgeItems = await getRecentKnowledgeItems(context.agentId, limit);
      }

      return {
        success: true,
        data: {
          count: knowledgeItems.length,
          knowledgeItems: knowledgeItems.map((i) => ({
            id: i.id,
            type: i.type,
            content: i.content,
            confidence: i.confidence,
            createdAt: i.createdAt,
          })),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list knowledge items',
      };
    }
  },
};

// ============================================================================
// removeKnowledgeItem Tool
// ============================================================================

const removeKnowledgeItemTool: Tool = {
  schema: {
    name: 'removeKnowledgeItem',
    description:
      'Remove a knowledge item that is no longer accurate or relevant.',
    parameters: [
      {
        name: 'knowledgeItemId',
        type: 'string',
        description: 'The UUID of the knowledge item to remove',
        required: true,
      },
    ],
  },
  handler: async (params, context): Promise<ToolResult> => {
    const parsed = RemoveKnowledgeItemParamsSchema.safeParse(params);
    if (!parsed.success) {
      return {
        success: false,
        error: `Invalid parameters: ${parsed.error.message}`,
      };
    }

    const { knowledgeItemId } = parsed.data;

    try {
      // Verify the knowledge item belongs to this agent
      const { getKnowledgeItemById } = await import('@/lib/db/queries/knowledge-items');
      const knowledgeItem = await getKnowledgeItemById(knowledgeItemId);

      if (!knowledgeItem) {
        return {
          success: false,
          error: 'Knowledge item not found',
        };
      }

      if (knowledgeItem.agentId !== context.agentId) {
        return {
          success: false,
          error: 'Cannot remove knowledge items belonging to other agents',
        };
      }

      await deleteKnowledgeItem(knowledgeItemId);

      return {
        success: true,
        data: {
          message: 'Knowledge item removed successfully',
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove knowledge item',
      };
    }
  },
};

// ============================================================================
// Registration
// ============================================================================

/**
 * Register all knowledge item management tools
 */
export function registerKnowledgeItemTools(): void {
  registerTool(addKnowledgeItemTool);
  registerTool(listKnowledgeItemsTool);
  registerTool(removeKnowledgeItemTool);
}

// Export individual tools for testing
export { addKnowledgeItemTool, listKnowledgeItemsTool, removeKnowledgeItemTool };
