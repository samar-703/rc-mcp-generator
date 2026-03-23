import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { toolHandler } from '../src/tools/post_standup.js';
import { API_PREFIX, createToolContext, getResultText, makeMessage, mswServer } from './test-utils.js';

describe('post_standup', () => {
  it('posts a formatted standup message', async () => {
    mswServer.use(
      http.post(`${API_PREFIX}/chat.postMessage`, async ({ request }) => {
        const body = (await request.json()) as { channel: string; text: string };

        expect(body.channel).toBe('#team-sync');
        expect(body.text).toContain('What I did');
        expect(body.text).toContain('What I\'ll do');

        return HttpResponse.json({
          channel: '#team-sync',
          message: makeMessage({ msg: body.text }),
          success: true,
          ts: '2026-03-21T00:00:00.000Z',
        });
      }),
    );

    const result = await toolHandler(
      {
        blockers: ['Waiting on review'],
        channelName: 'team-sync',
        today: ['Finish API tests'],
        username: 'alice',
        yesterday: ['Built the generator'],
      },
      createToolContext(),
    );

    expect(result.isError).toBeUndefined();
    expect(getResultText(result)).toContain('Posted standup update');
  });

  it('returns an MCP error result when posting fails', async () => {
    mswServer.use(
      http.post(`${API_PREFIX}/chat.postMessage`, () =>
        HttpResponse.json(
          {
            error: 'Cannot post message',
            errorType: 'cannot-post-message',
            success: false,
          },
          { status: 403 },
        ),
      ),
    );

    const result = await toolHandler(
      {
        blockers: [],
        channelName: 'team-sync',
        today: ['Finish API tests'],
        yesterday: ['Built the generator'],
      },
      createToolContext(),
    );

    expect(result.isError).toBe(true);
    expect(getResultText(result)).toContain('Cannot post message');
  });
});

