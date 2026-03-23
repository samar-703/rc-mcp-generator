import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { toolHandler } from '../src/tools/create_support_ticket.js';
import { API_PREFIX, createToolContext, getResultText, makeMessage, makeRoom, mswServer } from './test-utils.js';

describe('create_support_ticket', () => {
  it('creates a private support room and posts the summary', async () => {
    mswServer.use(
      http.post(`${API_PREFIX}/groups.create`, async ({ request }) => {
        const body = (await request.json()) as { members: string[]; name: string };

        expect(body.name).toBe('ticket-inc-42');
        expect(body.members).toEqual(['requester', 'support.one', 'support.two']);

        return HttpResponse.json({
          group: makeRoom({ _id: 'ticket-room', name: body.name, t: 'p' }),
          success: true,
        });
      }),
      http.post(`${API_PREFIX}/groups.setTopic`, async ({ request }) => {
        const body = (await request.json()) as { roomId: string; topic: string };
        expect(body.roomId).toBe('ticket-room');

        return HttpResponse.json({ success: true, topic: body.topic });
      }),
      http.post(`${API_PREFIX}/chat.postMessage`, async ({ request }) => {
        const body = (await request.json()) as { roomId: string; text: string };
        expect(body.roomId).toBe('ticket-room');

        return HttpResponse.json({
          channel: '#ticket-inc-42',
          message: makeMessage({ msg: body.text, rid: body.roomId }),
          success: true,
          ts: '2026-03-21T00:00:00.000Z',
        });
      }),
    );

    const result = await toolHandler(
      {
        requesterUsername: 'requester',
        summary: 'Customer cannot access billing',
        supportUsernames: ['support.one', 'support.two'],
        ticketId: 'INC-42',
      },
      createToolContext(),
    );

    expect(result.isError).toBeUndefined();
    expect(getResultText(result)).toContain('Created private support ticket room');
  });

  it('returns an MCP error result when support room creation fails', async () => {
    mswServer.use(
      http.post(`${API_PREFIX}/groups.create`, () =>
        HttpResponse.json(
          {
            error: 'Private room creation blocked',
            errorType: 'create-private-blocked',
            success: false,
          },
          { status: 403 },
        ),
      ),
    );

    const result = await toolHandler(
      {
        requesterUsername: 'requester',
        summary: 'Customer cannot access billing',
        supportUsernames: ['support.one'],
        ticketId: 'INC-42',
      },
      createToolContext(),
    );

    expect(result.isError).toBe(true);
    expect(getResultText(result)).toContain('Private room creation blocked');
  });
});

