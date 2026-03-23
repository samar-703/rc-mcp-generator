import { z } from 'zod';

import { TOOL_METADATA } from '../constants.js';
import { createErrorResult, createTextResult, ensureChannelPrefix } from '../tool-utils.js';
import type { ToolDefinition, ToolHandler } from '../types.js';

export const broadcastAnnouncementInputSchema = z.object({
  channelNames: z.array(z.string().min(1)).min(1),
  message: z.string().min(1),
});

export const toolDefinition: ToolDefinition<typeof broadcastAnnouncementInputSchema> = {
  description: TOOL_METADATA.broadcast_announcement.description,
  inputSchema: broadcastAnnouncementInputSchema,
  name: 'broadcast_announcement',
};

export const toolHandler: ToolHandler<typeof broadcastAnnouncementInputSchema> = async (
  input,
  { client },
) => {
  try {
    const deliveries = [];

    for (const channelName of input.channelNames) {
      const response = await client.sendMessage({
        channel: ensureChannelPrefix(channelName),
        text: input.message,
      });
      deliveries.push({ channel: response.channel, messageId: response.message._id });
    }

    return createTextResult(
      `Broadcast announcement to ${deliveries.length} channels.`,
      {
        deliveries,
      },
    );
  } catch (error) {
    return createErrorResult('Failed to broadcast announcement', error);
  }
};

