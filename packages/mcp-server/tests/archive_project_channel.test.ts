import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { toolHandler } from '../src/tools/archive_project_channel.js';
import { API_PREFIX, createToolContext, getResultText, makeMessage, makeRoom, mswServer } from './test-utils.js';

describe('archive_project_channel', () => {
  it('notifies the room and archives it', async () => {
    mswServer.use(
      http.get(`${API_PREFIX}/rooms.info`, () =>
        HttpResponse.json({
          room: makeRoom({ _id: 'archive-room', name: 'project-archive' }),
          success: true,
        }),
      ),
      http.post(`${API_PREFIX}/chat.postMessage`, async ({ request }) => {
        const body = (await request.json()) as { channel: string; text: string };
        expect(body.channel).toBe('#project-archive');

        return HttpResponse.json({
          channel: '#project-archive',
          message: makeMessage({ msg: body.text, rid: 'archive-room' }),
          success: true,
          ts: '2026-03-21T00:00:00.000Z',
        });
      }),
      http.post(`${API_PREFIX}/channels.archive`, async ({ request }) => {
        const body = (await request.json()) as { roomId: string };
        expect(body.roomId).toBe('archive-room');

        return HttpResponse.json({ success: true });
      }),
    );

    const result = await toolHandler(
      {
        channelName: 'project-archive',
        notice: 'Archiving this room now.',
        notifyMembers: true,
      },
      createToolContext(),
    );

    expect(result.isError).toBeUndefined();
    expect(getResultText(result)).toContain('Archived');
  });

  it('returns an MCP error result when archive fails', async () => {
    mswServer.use(
      http.get(`${API_PREFIX}/rooms.info`, () =>
        HttpResponse.json({
          room: makeRoom({ _id: 'archive-room', name: 'project-archive' }),
          success: true,
        }),
      ),
      http.post(`${API_PREFIX}/chat.postMessage`, () =>
        HttpResponse.json({
          channel: '#project-archive',
          message: makeMessage(),
          success: true,
          ts: '2026-03-21T00:00:00.000Z',
        }),
      ),
      http.post(`${API_PREFIX}/channels.archive`, () =>
        HttpResponse.json(
          {
            error: 'archive blocked',
            errorType: 'archive-not-allowed',
            success: false,
          },
          { status: 403 },
        ),
      ),
    );

    const result = await toolHandler(
      {
        channelName: 'project-archive',
        notice: 'Archiving this room now.',
        notifyMembers: true,
      },
      createToolContext(),
    );

    expect(result.isError).toBe(true);
    expect(getResultText(result)).toContain('archive blocked');
  });
});

