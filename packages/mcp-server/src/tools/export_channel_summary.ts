import { z } from 'zod';

import { DEFAULT_SUMMARY_LIMIT, TOOL_METADATA } from '../constants.js';
import {
  createErrorResult,
  createTextResult,
  formatMessageLine,
  getRoomId,
} from '../tool-utils.js';
import type { ToolDefinition, ToolHandler } from '../types.js';

export const exportChannelSummaryInputSchema = z.object({
  channelName: z.string().min(1),
  limit: z.number().int().positive().max(100).default(DEFAULT_SUMMARY_LIMIT),
});

export const toolDefinition: ToolDefinition<typeof exportChannelSummaryInputSchema> = {
  description: TOOL_METADATA.export_channel_summary.description,
  inputSchema: exportChannelSummaryInputSchema,
  name: 'export_channel_summary',
};

export const toolHandler: ToolHandler<typeof exportChannelSummaryInputSchema> = async (
  input,
  { client },
) => {
  try {
    const room = await client.getRoomInfo({ roomName: input.channelName });
    const messagesResponse = await client.getRoomMessages({
      count: input.limit,
      roomId: getRoomId(room),
      roomType: room.t,
    });
    const summaryBody = messagesResponse.messages.map(formatMessageLine).join('\n');
    const summary = [`Recent summary for ${room.name ?? input.channelName}:`, summaryBody].join(
      '\n',
    );

    return createTextResult(summary, {
      messages: messagesResponse.messages,
      room,
    });
  } catch (error) {
    return createErrorResult('Failed to export channel summary', error);
  }
};

