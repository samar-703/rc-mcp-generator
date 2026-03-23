import { z } from 'zod';

import { TOOL_METADATA } from '../constants.js';
import { createErrorResult, createTextResult, ensureChannelPrefix, getRoomId } from '../tool-utils.js';
import type { ToolDefinition, ToolHandler } from '../types.js';

export const archiveProjectChannelInputSchema = z.object({
  channelName: z.string().min(1),
  notice: z.string().min(1).default('This project room is being archived.'),
  notifyMembers: z.boolean().default(true),
});

export const toolDefinition: ToolDefinition<typeof archiveProjectChannelInputSchema> = {
  description: TOOL_METADATA.archive_project_channel.description,
  inputSchema: archiveProjectChannelInputSchema,
  name: 'archive_project_channel',
};

export const toolHandler: ToolHandler<typeof archiveProjectChannelInputSchema> = async (
  input,
  { client },
) => {
  try {
    const room = await client.getRoomInfo({ roomName: input.channelName });

    if (input.notifyMembers) {
      await client.sendMessage({
        channel: ensureChannelPrefix(input.channelName),
        text: input.notice,
      });
    }

    await client.archiveChannel({ roomId: getRoomId(room) });

    return createTextResult(
      `Archived ${room.name ?? input.channelName}.`,
      {
        noticeSent: input.notifyMembers,
        room,
      },
    );
  } catch (error) {
    return createErrorResult('Failed to archive project channel', error);
  }
};

