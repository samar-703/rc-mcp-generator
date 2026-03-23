import { z } from 'zod';

import { TOOL_METADATA } from '../constants.js';
import { createErrorResult, createTextResult, ensureChannelPrefix } from '../tool-utils.js';
import type { ToolDefinition, ToolHandler } from '../types.js';

export const postStandupInputSchema = z.object({
  blockers: z.array(z.string().min(1)).default([]),
  channelName: z.string().min(1),
  today: z.array(z.string().min(1)).min(1),
  username: z.string().min(1).optional(),
  yesterday: z.array(z.string().min(1)).min(1),
});

export const toolDefinition: ToolDefinition<typeof postStandupInputSchema> = {
  description: TOOL_METADATA.post_standup.description,
  inputSchema: postStandupInputSchema,
  name: 'post_standup',
};

const formatList = (items: string[]): string => items.map((item) => `- ${item}`).join('\n');

export const toolHandler: ToolHandler<typeof postStandupInputSchema> = async (
  input,
  { client },
) => {
  try {
    const heading = input.username ? `Standup update from @${input.username}` : 'Standup update';
    const blockers =
      input.blockers.length > 0 ? formatList(input.blockers) : '- None';
    const message = [
      `**${heading}**`,
      '',
      '*What I did*',
      formatList(input.yesterday),
      '',
      "*What I'll do*",
      formatList(input.today),
      '',
      '*Blockers*',
      blockers,
    ].join('\n');

    const response = await client.sendMessage({
      channel: ensureChannelPrefix(input.channelName),
      text: message,
    });

    return createTextResult(
      `Posted standup update to ${response.channel}.`,
      {
        channel: response.channel,
        message: response.message,
      },
    );
  } catch (error) {
    return createErrorResult('Failed to post standup', error);
  }
};

