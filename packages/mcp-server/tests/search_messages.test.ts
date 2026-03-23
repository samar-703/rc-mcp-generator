import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { toolHandler } from '../src/tools/search_messages.js';
import { API_PREFIX, createToolContext, getResultText, makeMessage, makeRoom, mswServer } from './test-utils.js';

describe('search_messages', () => {
  it('searches messages inside a selected room', async () => {
    mswServer.use(
      http.get(`${API_PREFIX}/rooms.info`, ({ request }) =>
        HttpResponse.json({
          room: makeRoom({ _id: 'room-search', name: new URL(request.url).searchParams.get('roomName') ?? 'general' }),
          success: true,
        }),
      ),
      http.get(`${API_PREFIX}/chat.search`, ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get('roomId')).toBe('room-search');
        expect(url.searchParams.get('searchText')).toBe('deploy');

        return HttpResponse.json({
          messages: [makeMessage({ msg: 'deploy complete', rid: 'room-search' })],
          success: true,
        });
      }),
    );

    const result = await toolHandler(
      { channelName: 'general', limit: 5, query: 'deploy' },
      createToolContext(),
    );

    expect(result.isError).toBeUndefined();
    expect(getResultText(result)).toContain('Found 1 matching messages');
  });

  it('returns an MCP error result when search fails', async () => {
    mswServer.use(
      http.get(`${API_PREFIX}/rooms.info`, () =>
        HttpResponse.json({
          room: makeRoom({ _id: 'room-search' }),
          success: true,
        }),
      ),
      http.get(`${API_PREFIX}/chat.search`, () =>
        HttpResponse.json(
          {
            error: 'search unavailable',
            errorType: 'search-disabled',
            success: false,
          },
          { status: 500 },
        ),
      ),
    );

    const result = await toolHandler(
      { channelName: 'general', limit: 5, query: 'deploy' },
      createToolContext(),
    );

    expect(result.isError).toBe(true);
    expect(getResultText(result)).toContain('search unavailable');
  });
});

