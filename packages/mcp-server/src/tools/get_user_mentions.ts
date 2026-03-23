import { z } from 'zod';

import { DEFAULT_MESSAGE_LIMIT, TOOL_METADATA } from '../constants.js';
import { createErrorResult, createTextResult } from '../tool-utils.js';
import type { ToolDefinition, ToolHandler } from '../types.js';

export const getUserMentionsInputSchema = z.object({
  limit: z.number().int().positive().max(100).default(DEFAULT_MESSAGE_LIMIT),
  username: z.string().min(1),
});

export const toolDefinition: ToolDefinition<typeof getUserMentionsInputSchema> = {
  description: TOOL_METADATA.get_user_mentions.description,
  inputSchema: getUserMentionsInputSchema,
  name: 'get_user_mentions',
};

export const toolHandler: ToolHandler<typeof getUserMentionsInputSchema> = async (
  input,
  { client },
) => {
  try {
    const mentionSummary = await client.getUnreadMentions({
      limit: input.limit,
      username: input.username,
    });

    return createTextResult(
      `Found ${mentionSummary.totalMentions} unread mentions for ${input.username}.`,
      mentionSummary as Record<string, unknown>,
    );
  } catch (error) {
    return createErrorResult('Failed to fetch user mentions', error);
  }
};

