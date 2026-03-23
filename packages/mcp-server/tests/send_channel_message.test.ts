import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { toolHandler } from '../src/tools/send_channel_message.js';
import { API_PREFIX, createToolContext, getResultText, makeMessage, mswServer } from './test-utils.js';

describe('send_channel_message', () => {
  it('sends a message to a named channel', async () => {
    mswServer.use(
      http.post(`${API_PREFIX}/chat.postMessage`, async ({ request }) => {
        const body = (await request.json()) as { channel: string; text: string };

        expect(body.channel).toBe('#engineering');
        expect(body.text).toBe('Ship it');

        return HttpResponse.json({
          channel: '#engineering',
          message: makeMessage({ msg: 'Ship it' }),
          success: true,
          ts: '2026-03-21T00:00:00.000Z',
        });
      }),
    );

    const result = await toolHandler(
      { channelName: 'engineering', text: 'Ship it' },
      createToolContext(),
    );

    expect(result.isError).toBeUndefined();
    expect(getResultText(result)).toContain('Sent message');
  });

  it('returns an MCP error result when Rocket.Chat rejects the request', async () => {
    mswServer.use(
      http.post(`${API_PREFIX}/chat.postMessage`, () =>
        HttpResponse.json(
          {
            error: '[invalid-channel]',
            errorType: 'invalid-channel',
            success: false,
          },
          { status: 400 },
        ),
      ),
    );

    const result = await toolHandler(
      { channelName: 'missing', text: 'Ship it' },
      createToolContext(),
    );

    expect(result.isError).toBe(true);
    expect(getResultText(result)).toContain('invalid-channel');
  });
});

