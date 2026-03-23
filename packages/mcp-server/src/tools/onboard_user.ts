import { z } from 'zod';

import { TOOL_METADATA } from '../constants.js';
import {
  createErrorResult,
  createTextResult,
  ensureUsernamePrefix,
  getRoomId,
} from '../tool-utils.js';
import type { ToolDefinition, ToolHandler } from '../types.js';

export const onboardUserInputSchema = z.object({
  defaultChannels: z.array(z.string().min(1)).default([]),
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8),
  username: z.string().min(1),
  welcomeMessage: z.string().min(1),
});

export const toolDefinition: ToolDefinition<typeof onboardUserInputSchema> = {
  description: TOOL_METADATA.onboard_user.description,
  inputSchema: onboardUserInputSchema,
  name: 'onboard_user',
};

export const toolHandler: ToolHandler<typeof onboardUserInputSchema> = async (
  input,
  { client },
) => {
  try {
    const user = await client.createUser({
      email: input.email,
      joinDefaultChannels: false,
      name: input.name,
      password: input.password,
      sendWelcomeEmail: false,
      username: input.username,
      verified: true,
    });

    const invitedRooms = [];

    for (const channelName of input.defaultChannels) {
      const room = await client.getRoomInfo({ roomName: channelName });
      await client.inviteUsersToRoom({
        roomId: getRoomId(room),
        userIds: [user._id],
      });
      invitedRooms.push(room.name ?? channelName);
    }

    await client.createDirectMessage({ username: input.username });
    await client.sendMessage({
      channel: ensureUsernamePrefix(input.username),
      text: input.welcomeMessage,
    });

    return createTextResult(
      `Onboarded ${user.username} and added them to ${invitedRooms.length} channels.`,
      {
        invitedRooms,
        user,
      },
    );
  } catch (error) {
    return createErrorResult('Failed to onboard user', error);
  }
};

