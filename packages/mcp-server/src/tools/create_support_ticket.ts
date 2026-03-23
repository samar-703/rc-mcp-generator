import { z } from 'zod';

import { TOOL_METADATA } from '../constants.js';
import {
  buildTicketRoomName,
  createErrorResult,
  createTextResult,
  getRoomId,
} from '../tool-utils.js';
import type { ToolDefinition, ToolHandler } from '../types.js';

export const createSupportTicketInputSchema = z.object({
  requesterUsername: z.string().min(1),
  summary: z.string().min(1),
  supportUsernames: z.array(z.string().min(1)).min(1),
  ticketId: z.string().min(1),
  topic: z.string().min(1).optional(),
});

export const toolDefinition: ToolDefinition<typeof createSupportTicketInputSchema> = {
  description: TOOL_METADATA.create_support_ticket.description,
  inputSchema: createSupportTicketInputSchema,
  name: 'create_support_ticket',
};

export const toolHandler: ToolHandler<typeof createSupportTicketInputSchema> = async (
  input,
  { client },
) => {
  try {
    const roomName = buildTicketRoomName(input.ticketId);
    const members = [...new Set([input.requesterUsername, ...input.supportUsernames])];
    const room = await client.createChannel({
      isPrivate: true,
      members,
      name: roomName,
    });
    const roomId = getRoomId(room);

    await client.setRoomTopic({
      isPrivate: true,
      roomId,
      topic: input.topic ?? input.summary,
    });
    await client.sendMessage({
      roomId,
      text: `New support ticket from @${input.requesterUsername}\n\n${input.summary}`,
    });

    return createTextResult(
      `Created private support ticket room ${roomName}.`,
      {
        members,
        room,
      },
    );
  } catch (error) {
    return createErrorResult('Failed to create support ticket', error);
  }
};

