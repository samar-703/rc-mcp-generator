import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import {
  CHANNEL_PREFIX,
  DEFAULT_SUPPORT_CHANNEL_PREFIX,
  USERNAME_PREFIX,
} from './constants.js';
import {
  getErrorMessage,
  isRocketChatError,
  ToolExecutionError,
} from './errors.js';
import type {
  RocketChatMessage,
  RocketChatRoom,
  RocketChatUser,
} from './rc-client.js';

export const createTextResult = (
  text: string,
  structuredContent?: Record<string, unknown>,
): CallToolResult => ({
  content: [{ text, type: 'text' }],
  structuredContent,
});

export const createErrorResult = (
  contextMessage: string,
  error: unknown,
): CallToolResult => ({
  content: [
    {
      text: `${contextMessage}: ${getErrorMessage(error)}`,
      type: 'text',
    },
  ],
  isError: true,
  structuredContent: {
    details:
      error instanceof ToolExecutionError || isRocketChatError(error)
        ? error.details
        : undefined,
    error:
      error instanceof Error
        ? { message: error.message, name: error.name }
        : { message: getErrorMessage(error), name: 'UnknownError' },
  },
});

export const ensureChannelPrefix = (channelName: string): string =>
  channelName.startsWith(CHANNEL_PREFIX)
    ? channelName
    : `${CHANNEL_PREFIX}${channelName}`;

export const ensureUsernamePrefix = (username: string): string =>
  username.startsWith(USERNAME_PREFIX)
    ? username
    : `${USERNAME_PREFIX}${username}`;

export const getRoomId = (room: Pick<RocketChatRoom, '_id' | 'rid'>): string => {
  const roomId = room._id ?? room.rid;

  if (!roomId) {
    throw new ToolExecutionError('Room response did not include a room identifier.');
  }

  return roomId;
};

export const getRoomLabel = (room: Pick<RocketChatRoom, 'fname' | 'name' | 'rid'>): string =>
  room.name ?? room.fname ?? room.rid ?? 'unknown-room';

export const sanitizeRoomName = (name: string): string =>
  name.trim().toLowerCase().replace(/[^0-9a-z-_.]+/g, '-').replace(/^-+|-+$/g, '');

export const buildTicketRoomName = (ticketId: string): string =>
  `${DEFAULT_SUPPORT_CHANNEL_PREFIX}${sanitizeRoomName(ticketId)}`;

export const formatMessageLine = (message: RocketChatMessage): string => {
  const author = message.u.username ?? message.u.name ?? 'unknown-user';
  const timestamp = new Date(message.ts).toISOString();
  const content = message.msg.trim().length > 0 ? message.msg : '[non-text message]';

  return `- ${timestamp} ${author}: ${content}`;
};

export const formatUserList = (users: ReadonlyArray<Pick<RocketChatUser, 'username'>>): string =>
  users.map((user) => user.username).join(', ');

