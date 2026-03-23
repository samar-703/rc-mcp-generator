import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { toolHandler } from '../src/tools/export_channel_summary.js';
import { API_PREFIX, createToolContext, getResultText, makeMessage, makeRoom, mswServer } from './test-utils.js';

describe('export_channel_summary', () => {
  it('returns a formatted recent summary', async () => {
    mswServer.use(
      http.get(`${API_PREFIX}/rooms.info`, () =>
        HttpResponse.json({
          room: makeRoom({ _id: 'summary-room', name: 'general' }),
          success: true,
        }),
      ),
      http.get(`${API_PREFIX}/channels.messages`, () =>
        HttpResponse.json({
          messages: [
            makeMessage({ _id: 'summary-1', msg: 'Shipped the fix', rid: 'summary-room' }),
            makeMessage({ _id: 'summary-2', msg: 'Monitoring rollout', rid: 'summary-room' }),
          ],
          success: true,
        }),
      ),
    );

    const result = await toolHandler(
      { channelName: 'general', limit: 2 },
      createToolContext(),
    );

    expect(result.isError).toBeUndefined();
    expect(getResultText(result)).toContain('Recent summary for general');
    expect(getResultText(result)).toContain('Shipped the fix');
  });

  it('returns an MCP error result when messages cannot be fetched', async () => {
    mswServer.use(
      http.get(`${API_PREFIX}/rooms.info`, () =>
        HttpResponse.json({
          room: makeRoom({ _id: 'summary-room', name: 'general' }),
          success: true,
        }),
      ),
      http.get(`${API_PREFIX}/channels.messages`, () =>
        HttpResponse.json(
          {
            error: 'Unable to fetch messages',
            errorType: 'messages-unavailable',
            success: false,
          },
          { status: 500 },
        ),
      ),
    );

    const result = await toolHandler(
      { channelName: 'general', limit: 2 },
      createToolContext(),
    );

    expect(result.isError).toBe(true);
    expect(getResultText(result)).toContain('Unable to fetch messages');
  });
});

