import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { toolHandler } from '../src/tools/create_project_room.js';
import { API_PREFIX, createToolContext, getResultText, makeRoom, mswServer } from './test-utils.js';

describe('create_project_room', () => {
  it('creates a room and sets its topic', async () => {
    mswServer.use(
      http.post(`${API_PREFIX}/channels.create`, async ({ request }) => {
        const body = (await request.json()) as { members: string[]; name: string };

        expect(body.name).toBe('project-atlas');
        expect(body.members).toEqual(['alice', 'bob']);

        return HttpResponse.json({
          channel: makeRoom({ _id: 'room-project', name: 'project-atlas' }),
          success: true,
        });
      }),
      http.post(`${API_PREFIX}/channels.setTopic`, async ({ request }) => {
        const body = (await request.json()) as { roomId: string; topic: string };

        expect(body.roomId).toBe('room-project');
        expect(body.topic).toBe('Atlas delivery');

        return HttpResponse.json({ success: true, topic: body.topic });
      }),
    );

    const result = await toolHandler(
      {
        channelName: 'project atlas',
        invitees: ['alice', 'bob'],
        topic: 'Atlas delivery',
      },
      createToolContext(),
    );

    expect(result.isError).toBeUndefined();
    expect(getResultText(result)).toContain('Created project room');
  });

  it('returns an MCP error result if the room cannot be created', async () => {
    mswServer.use(
      http.post(`${API_PREFIX}/channels.create`, () =>
        HttpResponse.json(
          {
            error: 'Room name already exists',
            errorType: 'duplicate-channel-name',
            success: false,
          },
          { status: 400 },
        ),
      ),
    );

    const result = await toolHandler(
      { channelName: 'project atlas', invitees: [], topic: 'Atlas delivery' },
      createToolContext(),
    );

    expect(result.isError).toBe(true);
    expect(getResultText(result)).toContain('Room name already exists');
  });
});

