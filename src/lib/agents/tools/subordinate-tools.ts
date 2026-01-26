/**
 * Subordinate Agent Tools
 *
 * Tools available to subordinate agents for reporting back to team leads.
 */

import {
  registerTool,
  type Tool,
  type ToolResult,
  ReportToLeadParamsSchema,
  RequestInputParamsSchema,
} from './index';
import {
  getInProgressTasksForAgent,
  completeTask,
} from '@/lib/db/queries/agentTasks';
import { getAgentById } from '@/lib/db/queries/agents';
import { getOrCreateConversation } from '@/lib/db/queries/conversations';
import { appendMessage } from '@/lib/db/queries/messages';

// ============================================================================
// reportToLead
// ============================================================================

const reportToLeadTool: Tool = {
  schema: {
    name: 'reportToLead',
    description:
      'Send the results of your current task back to the team lead. Use this when you have completed or failed a task.',
    parameters: [
      {
        name: 'result',
        type: 'string',
        description:
          'A detailed description of the task result or the reason for failure',
        required: true,
      },
      {
        name: 'status',
        type: 'string',
        description: 'Whether the task was completed successfully or failed',
        required: true,
        enum: ['success', 'failure'],
      },
    ],
  },
  handler: async (params, context): Promise<ToolResult> => {
    // Validate params
    const parsed = ReportToLeadParamsSchema.safeParse(params);
    if (!parsed.success) {
      return {
        success: false,
        error: `Invalid parameters: ${parsed.error.message}`,
      };
    }

    const { result, status } = parsed.data;

    // Only subordinates can report to lead
    if (context.isTeamLead) {
      return {
        success: false,
        error: 'Team leads cannot use this tool',
      };
    }

    // Get the current in-progress task for this agent
    const tasks = await getInProgressTasksForAgent(context.agentId);

    if (tasks.length === 0) {
      return {
        success: false,
        error: 'No in-progress task found to report on',
      };
    }

    // Complete the most recent task
    const task = tasks[0];
    const taskStatus = status === 'success' ? 'completed' : 'failed';

    await completeTask(task.id, result, taskStatus);

    // Get the team lead info for the response
    const agent = await getAgentById(context.agentId);
    const parentAgentId = agent?.parentAgentId;

    // Add message to lead's background conversation
    if (parentAgentId) {
      const backgroundConv = await getOrCreateConversation(
        parentAgentId,
        'background'
      );
      await appendMessage(
        backgroundConv.id,
        'user',
        `Subordinate ${agent.name} reports: ${result}`
      );
    }

    return {
      success: true,
      data: {
        taskId: task.id,
        reportedTo: parentAgentId,
        message: `Task ${taskStatus}. Result reported to team lead.`,
      },
    };
  },
};

// ============================================================================
// requestInput
// ============================================================================

const requestInputTool: Tool = {
  schema: {
    name: 'requestInput',
    description:
      'Ask the team lead for clarification or additional input when you need more information to complete a task.',
    parameters: [
      {
        name: 'question',
        type: 'string',
        description: 'The question or clarification you need from the team lead',
        required: true,
      },
    ],
  },
  handler: async (params, context): Promise<ToolResult> => {
    // Validate params
    const parsed = RequestInputParamsSchema.safeParse(params);
    if (!parsed.success) {
      return {
        success: false,
        error: `Invalid parameters: ${parsed.error.message}`,
      };
    }

    const { question } = parsed.data;

    // Only subordinates can request input from lead
    if (context.isTeamLead) {
      return {
        success: false,
        error: 'Team leads cannot use this tool',
      };
    }

    // Get the agent to find the team lead
    const agent = await getAgentById(context.agentId);
    if (!agent || !agent.parentAgentId) {
      return {
        success: false,
        error: 'Could not find team lead',
      };
    }

    // Add message to lead's background conversation
    const backgroundConv = await getOrCreateConversation(
      agent.parentAgentId,
      'background'
    );

    await appendMessage(
      backgroundConv.id,
      'user',
      `Subordinate ${agent.name} asks: ${question}`
    );

    return {
      success: true,
      data: {
        questionId: backgroundConv.id, // Using conversation ID as reference
        message: 'Question sent to team lead. Awaiting response.',
      },
    };
  },
};

// ============================================================================
// Registration
// ============================================================================

/**
 * Register all subordinate tools
 */
export function registerSubordinateTools(): void {
  registerTool(reportToLeadTool);
  registerTool(requestInputTool);
}

// Export individual tools for testing
export { reportToLeadTool, requestInputTool };
