import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { toolHandler } from '../src/tools/broadcast_announcement.js';
import { API_PREFIX, createToolContext, getResultText, makeMessage, mswServer } from './test-utils.js';

describe('broadcast_announcement', () => {
  it('broadcasts one message to many channels', async () => {
    mswServer.use(
      http.post(`${API_PREFIX}/chat.postMessage`, async ({ request }) => {
        const body = (await request.json()) as { channel: string; text: string };

        return HttpResponse.json({
          channel: body.channel,
          message: makeMessage({ _id: `${body.channel}-message`, msg: body.text }),
          success: true,
          ts: '2026-03-21T00:00:00.000Z',
        });
      }),
    );

    const result = await toolHandler(
      {
        channelNames: ['engineering', 'product'],
        message: 'Deployment at 17:00 UTC',
      },
      createToolContext(),
    );

    expect(result.isError).toBeUndefined();
    expect(getResultText(result)).toContain('Broadcast announcement to 2 channels');
  });

  it('returns an MCP error result when one delivery fails', async () => {
    let callCount = 0;

    mswServer.use(
      http.post(`${API_PREFIX}/chat.postMessage`, async ({ request }) => {
        callCount += 1;

        if (callCount === 2) {
          return HttpResponse.json(
            {
              error: 'Rate limit exceeded',
              errorType: 'too-many-requests',
              success: false,
            },
            { status: 429 },
          );
        }

        const body = (await request.json()) as { channel: string; text: string };

        return HttpResponse.json({
          channel: body.channel,
          message: makeMessage({ _id: `${body.channel}-message`, msg: body.text }),
          success: true,
          ts: '2026-03-21T00:00:00.000Z',
        });
      }),
    );

    const result = await toolHandler(
      {
        channelNames: ['engineering', 'product'],
        message: 'Deployment at 17:00 UTC',
      },
      createToolContext(),
    );

    expect(result.isError).toBe(true);
    expect(getResultText(result)).toContain('Rate limit exceeded');
  });
});

