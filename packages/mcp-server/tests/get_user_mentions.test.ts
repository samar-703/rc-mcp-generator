import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { toolHandler } from '../src/tools/get_user_mentions.js';
import { API_PREFIX, createToolContext, getResultText, makeMessage, mswServer } from './test-utils.js';

describe('get_user_mentions', () => {
  it('returns unread mentions for a user', async () => {
    mswServer.use(
      http.get(`${API_PREFIX}/users.info`, () =>
        HttpResponse.json({
          success: true,
          user: {
            _id: 'mentioned-user',
            rooms: [
              {
                rid: 'mention-room',
                t: 'c',
                userMentions: 2,
              },
            ],
            username: 'alice',
          },
        }),
      ),
      http.get(`${API_PREFIX}/channels.messages`, ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get('mentionIds')).toBe('mentioned-user');

        return HttpResponse.json({
          messages: [
            makeMessage({
              mentions: [{ _id: 'mentioned-user', username: 'alice' }],
              msg: '@alice please review',
              rid: 'mention-room',
            }),
            makeMessage({
              _id: 'message-2',
              mentions: [{ _id: 'mentioned-user', username: 'alice' }],
              msg: '@alice ship the fix',
              rid: 'mention-room',
            }),
          ],
          success: true,
        });
      }),
    );

    const result = await toolHandler(
      { limit: 5, username: 'alice' },
      createToolContext(),
    );

    expect(result.isError).toBeUndefined();
    expect(getResultText(result)).toContain('Found 2 unread mentions');
  });

  it('returns an MCP error result when mention lookup fails', async () => {
    mswServer.use(
      http.get(`${API_PREFIX}/users.info`, () =>
        HttpResponse.json(
          {
            error: 'Unknown user',
            errorType: 'error-invalid-user',
            success: false,
          },
          { status: 404 },
        ),
      ),
    );

    const result = await toolHandler(
      { limit: 5, username: 'alice' },
      createToolContext(),
    );

    expect(result.isError).toBe(true);
    expect(getResultText(result)).toContain('Unknown user');
  });
});

