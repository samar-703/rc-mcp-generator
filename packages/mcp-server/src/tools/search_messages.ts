import { z } from 'zod';

import { DEFAULT_SEARCH_LIMIT, ROOM_TYPES, TOOL_METADATA } from '../constants.js';
import { createErrorResult, createTextResult, getRoomId, getRoomLabel } from '../tool-utils.js';
import type { ToolDefinition, ToolHandler } from '../types.js';

export const searchMessagesInputSchema = z.object({
  channelName: z.string().min(1).optional(),
  limit: z.number().int().positive().max(100).default(DEFAULT_SEARCH_LIMIT),
  query: z.string().min(1),
});

export const toolDefinition: ToolDefinition<typeof searchMessagesInputSchema> = {
  description: TOOL_METADATA.search_messages.description,
  inputSchema: searchMessagesInputSchema,
  name: 'search_messages',
};

export const toolHandler: ToolHandler<typeof searchMessagesInputSchema> = async (
  input,
  { client },
) => {
  try {
    const rooms = input.channelName
      ? [await client.getRoomInfo({ roomName: input.channelName })]
      : (await client.getRooms()).filter(
          (room) => room.t === ROOM_TYPES.channel || room.t === ROOM_TYPES.group,
        );

    const searchResults = await Promise.all(
      rooms.map(async (room) => {
        const roomId = getRoomId(room);
        const messages = await client.searchMessages({
          count: input.limit,
          roomId,
          searchText: input.query,
        });

        return {
          messages,
          roomId,
          roomName: getRoomLabel(room),
        };
      }),
    );

    const matches = searchResults.flatMap((room) =>
      room.messages.map((message) => ({
        message,
        roomId: room.roomId,
        roomName: room.roomName,
      })),
    );

    return createTextResult(
      `Found ${matches.length} matching messages for "${input.query}".`,
      {
        matches,
      },
    );
  } catch (error) {
    return createErrorResult('Failed to search messages', error);
  }
};

