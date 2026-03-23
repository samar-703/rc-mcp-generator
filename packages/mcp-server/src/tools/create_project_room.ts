import { z } from 'zod';

import { TOOL_METADATA } from '../constants.js';
import {
  createErrorResult,
  createTextResult,
  getRoomId,
  sanitizeRoomName,
} from '../tool-utils.js';
import type { ToolDefinition, ToolHandler } from '../types.js';

export const createProjectRoomInputSchema = z.object({
  channelName: z.string().min(1),
  invitees: z.array(z.string().min(1)).default([]),
  topic: z.string().min(1).optional(),
});

export const toolDefinition: ToolDefinition<typeof createProjectRoomInputSchema> = {
  description: TOOL_METADATA.create_project_room.description,
  inputSchema: createProjectRoomInputSchema,
  name: 'create_project_room',
};

export const toolHandler: ToolHandler<typeof createProjectRoomInputSchema> = async (
  input,
  { client },
) => {
  try {
    const room = await client.createChannel({
      members: input.invitees,
      name: sanitizeRoomName(input.channelName),
    });

    if (input.topic) {
      await client.setRoomTopic({
        roomId: getRoomId(room),
        topic: input.topic,
      });
    }

    return createTextResult(
      `Created project room ${room.name ?? input.channelName}.`,
      {
        invitees: input.invitees,
        room,
        topic: input.topic,
      },
    );
  } catch (error) {
    return createErrorResult('Failed to create project room', error);
  }
};

