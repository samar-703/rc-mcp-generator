import { z } from 'zod';

import { TOOL_METADATA } from '../constants.js';
import { createErrorResult, createTextResult, ensureChannelPrefix } from '../tool-utils.js';
import type { ToolDefinition, ToolHandler } from '../types.js';

export const sendChannelMessageInputSchema = z.object({
  alias: z.string().min(1).optional(),
  channelName: z.string().min(1),
  text: z.string().min(1),
});

export const toolDefinition: ToolDefinition<typeof sendChannelMessageInputSchema> = {
  description: TOOL_METADATA.send_channel_message.description,
  inputSchema: sendChannelMessageInputSchema,
  name: 'send_channel_message',
};

export const toolHandler: ToolHandler<typeof sendChannelMessageInputSchema> = async (
  input,
  { client },
) => {
  try {
    const response = await client.sendMessage({
      alias: input.alias,
      channel: ensureChannelPrefix(input.channelName),
      text: input.text,
    });

    return createTextResult(
      `Sent message to ${response.channel}.`,
      {
        channel: response.channel,
        message: response.message,
        ts: response.ts,
      },
    );
  } catch (error) {
    return createErrorResult('Failed to send channel message', error);
  }
};

