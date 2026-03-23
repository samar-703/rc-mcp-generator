import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { toolHandler } from '../src/tools/onboard_user.js';
import { API_PREFIX, createToolContext, getResultText, makeMessage, makeRoom, mswServer } from './test-utils.js';

describe('onboard_user', () => {
  it('creates a user, adds them to channels, and sends a welcome DM', async () => {
    mswServer.use(
      http.post(`${API_PREFIX}/users.create`, async ({ request }) => {
        const body = (await request.json()) as { username: string };
        expect(body.username).toBe('new.user');

        return HttpResponse.json({
          success: true,
          user: {
            _id: 'user-new',
            name: 'New User',
            username: 'new.user',
          },
        });
      }),
      http.get(`${API_PREFIX}/rooms.info`, ({ request }) => {
        const url = new URL(request.url);
        return HttpResponse.json({
          room: makeRoom({
            _id: `${url.searchParams.get('roomName')}-room`,
            name: url.searchParams.get('roomName') ?? 'general',
          }),
          success: true,
        });
      }),
      http.post(`${API_PREFIX}/channels.invite`, async ({ request }) => {
        const body = (await request.json()) as { roomId: string; userId: string };
        return HttpResponse.json({
          channel: makeRoom({ _id: body.roomId }),
          success: true,
        });
      }),
      http.post(`${API_PREFIX}/dm.create`, () =>
        HttpResponse.json({
          room: { rid: 'dm-room', t: 'd', usernames: ['new.user', 'bot'] },
          success: true,
        }),
      ),
      http.post(`${API_PREFIX}/chat.postMessage`, async ({ request }) => {
        const body = (await request.json()) as { channel: string; text: string };
        expect(body.channel).toBe('@new.user');

        return HttpResponse.json({
          channel: '@new.user',
          message: makeMessage({ msg: body.text, rid: 'dm-room' }),
          success: true,
          ts: '2026-03-21T00:00:00.000Z',
        });
      }),
    );

    const result = await toolHandler(
      {
        defaultChannels: ['general', 'eng'],
        email: 'new.user@example.com',
        name: 'New User',
        password: 'Password123',
        username: 'new.user',
        welcomeMessage: 'Welcome aboard',
      },
      createToolContext(),
    );

    expect(result.isError).toBeUndefined();
    expect(getResultText(result)).toContain('Onboarded new.user');
  });

  it('returns an MCP error result when user creation fails', async () => {
    mswServer.use(
      http.post(`${API_PREFIX}/users.create`, () =>
        HttpResponse.json(
          {
            error: 'Email already exists',
            errorType: 'email-already-exists',
            success: false,
          },
          { status: 400 },
        ),
      ),
    );

    const result = await toolHandler(
      {
        defaultChannels: [],
        email: 'new.user@example.com',
        name: 'New User',
        password: 'Password123',
        username: 'new.user',
        welcomeMessage: 'Welcome aboard',
      },
      createToolContext(),
    );

    expect(result.isError).toBe(true);
    expect(getResultText(result)).toContain('Email already exists');
  });
});

