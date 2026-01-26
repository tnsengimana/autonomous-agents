import { z } from 'zod';
import { generateLLMObject } from './llm';

/**
 * Schema for the generated aide configuration
 */
const AideConfigurationSchema = z.object({
  aideDescription: z.string().describe('A one sentence description of what this aide does'),
  leadAgentName: z.string().describe('A professional name for the aide (the lead agent)'),
  leadAgentSystemPrompt: z.string().describe('System prompt defining the aide personality and approach'),
});

export type AideConfiguration = z.infer<typeof AideConfigurationSchema>;

/**
 * Generate aide configuration (description, lead agent name, system prompt) from aide name and purpose.
 * Uses LLM to create appropriate values based on the purpose.
 *
 * Key difference from team configuration: Aides are personal professional extensions of the user,
 * not representatives of an organization.
 */
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
