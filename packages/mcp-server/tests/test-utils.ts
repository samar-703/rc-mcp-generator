import { afterAll, afterEach, beforeAll } from 'vitest';
import { setupServer } from 'msw/node';

import { ROOM_TYPES } from '../src/constants.js';
import { RocketChatClient, type RocketChatMessage, type RocketChatRoom } from '../src/rc-client.js';
import type { ToolContext } from '../src/types.js';

export const API_BASE_URL = 'https://rocketchat.example.com';
export const API_PREFIX = `${API_BASE_URL}/api/v1`;
export const TEST_AUTH_TOKEN = 'test-auth-token';
export const TEST_USER_ID = 'test-user-id';

export const mswServer = setupServer();

beforeAll(() => {
  mswServer.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  mswServer.resetHandlers();
});

afterAll(() => {
  mswServer.close();
});

export const createToolContext = (): ToolContext => ({
  client: new RocketChatClient(API_BASE_URL, TEST_AUTH_TOKEN, TEST_USER_ID),
});

export const makeRoom = (overrides: Partial<RocketChatRoom> = {}): RocketChatRoom => ({
  _id: 'room-1',
  fname: 'General',
  name: 'general',
  t: ROOM_TYPES.channel,
  ...overrides,
});

export const makeMessage = (
  overrides: Partial<RocketChatMessage> = {},
): RocketChatMessage => ({
  _id: 'message-1',
  channels: [],
  mentions: [],
  msg: 'Hello from Rocket.Chat',
  rid: 'room-1',
  ts: '2026-03-21T00:00:00.000Z',
  u: {
    _id: 'author-1',
    name: 'Author One',
    username: 'author.one',
  },
  ...overrides,
});

export const getResultText = (result: {
  content?: ReadonlyArray<{ text?: string; type?: string }>;
}): string => {
  const firstTextItem = result.content?.find(
    (item) => item.type === 'text' && typeof item.text === 'string',
  );

  return firstTextItem?.text ?? '';
};
