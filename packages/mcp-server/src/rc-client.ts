import axios, { AxiosError, type AxiosInstance, type AxiosRequestConfig } from 'axios';
import { z } from 'zod';

import {
  DEFAULT_MESSAGE_LIMIT,
  DEFAULT_SEARCH_LIMIT,
  ROOM_TYPES,
  ROCKET_CHAT_API_PATHS,
} from './constants.js';
import { RocketChatError } from './errors.js';

const rocketChatSuccessSchema = z.object({ success: z.literal(true) }).passthrough();
const rocketChatFailureSchema = z
  .object({
    details: z.unknown().optional(),
    error: z.string().optional(),
    errorType: z.string().optional(),
    message: z.string().optional(),
    status: z.string().optional(),
    success: z.boolean().optional(),
  })
  .passthrough();

export const rocketChatUserReferenceSchema = z
  .object({
    _id: z.string(),
    name: z.string().optional(),
    type: z.string().optional(),
    username: z.string(),
  })
  .passthrough();

export const rocketChatUserSchema = z
  .object({
    _id: z.string(),
    active: z.boolean().optional(),
    emails: z
      .array(
        z
          .object({
            address: z.string(),
            verified: z.boolean().optional(),
          })
          .passthrough(),
      )
      .optional(),
    name: z.string().optional(),
    roles: z.array(z.string()).optional(),
    status: z.string().optional(),
    type: z.string().optional(),
    username: z.string(),
  })
  .passthrough();

export const rocketChatMessageSchema = z
  .object({
    _id: z.string(),
    _updatedAt: z.string().optional(),
    alias: z.string().nullable().optional(),
    attachments: z.array(z.unknown()).optional(),
    channels: z.array(z.unknown()).default([]),
    md: z.array(z.unknown()).optional(),
    mentions: z.array(rocketChatUserReferenceSchema).default([]),
    msg: z.string().default(''),
    rid: z.string(),
    ts: z.string(),
    u: rocketChatUserReferenceSchema,
  })
  .passthrough();

export const rocketChatRoomSchema = z
  .object({
    _id: z.string().optional(),
    _updatedAt: z.string().optional(),
    default: z.boolean().optional(),
    fname: z.string().optional(),
    lastMessage: rocketChatMessageSchema.optional(),
    lm: z.string().optional(),
    msgs: z.number().optional(),
    name: z.string().optional(),
    rid: z.string().optional(),
    ro: z.boolean().optional(),
    sysMes: z.boolean().optional(),
    t: z.enum([ROOM_TYPES.channel, ROOM_TYPES.direct, ROOM_TYPES.group]),
    ts: z.string().optional(),
    u: rocketChatUserReferenceSchema.optional(),
    unread: z.number().optional(),
    userMentions: z.number().optional(),
    usernames: z.array(z.string()).optional(),
    usersCount: z.number().optional(),
  })
  .passthrough();

export const rocketChatRoomMembershipSchema = z
  .object({
    _id: z.string().optional(),
    fname: z.string().optional(),
    ls: z.string().optional(),
    name: z.string().optional(),
    rid: z.string().optional(),
    t: z.enum([ROOM_TYPES.channel, ROOM_TYPES.direct, ROOM_TYPES.group]),
    unread: z.number().optional(),
    userMentions: z.number().optional(),
  })
  .passthrough();

export const rocketChatUserInfoSchema = rocketChatUserSchema.extend({
  rooms: z.array(rocketChatRoomMembershipSchema).optional(),
});

export const postMessageResponseSchema = rocketChatSuccessSchema.extend({
  channel: z.string(),
  message: rocketChatMessageSchema,
  ts: z.union([z.number(), z.string()]),
});

export const createChannelResponseSchema = z.union([
  rocketChatSuccessSchema.extend({ channel: rocketChatRoomSchema }),
  rocketChatSuccessSchema.extend({ group: rocketChatRoomSchema }),
]);

export const getChannelsResponseSchema = rocketChatSuccessSchema.extend({
  channels: z.array(rocketChatRoomSchema),
});

export const getUsersResponseSchema = rocketChatSuccessSchema.extend({
  users: z.array(rocketChatUserSchema),
});

export const searchMessagesResponseSchema = rocketChatSuccessSchema.extend({
  messages: z.array(rocketChatMessageSchema),
});

export const archiveChannelResponseSchema = rocketChatSuccessSchema;

export const createUserResponseSchema = rocketChatSuccessSchema.extend({
  user: rocketChatUserSchema,
});

export const setUserActiveStatusResponseSchema = rocketChatSuccessSchema.extend({
  user: z
    .object({
      _id: z.string(),
      active: z.boolean(),
    })
    .passthrough(),
});

export const uploadFileResponseSchema = rocketChatSuccessSchema.extend({
  file: z
    .object({
      _id: z.string(),
      url: z.string(),
    })
    .passthrough(),
});

export const getUserInfoResponseSchema = rocketChatSuccessSchema.extend({
  user: rocketChatUserInfoSchema,
});

export const getRoomInfoResponseSchema = rocketChatSuccessSchema.extend({
  room: rocketChatRoomSchema,
});

export const setRoomTopicResponseSchema = rocketChatSuccessSchema.extend({
  topic: z.string(),
});

export const inviteUsersResponseSchema = z.union([
  rocketChatSuccessSchema.extend({ channel: rocketChatRoomSchema }),
  rocketChatSuccessSchema.extend({ group: rocketChatRoomSchema }),
]);

export const createDirectMessageResponseSchema = rocketChatSuccessSchema.extend({
  room: z
    .object({
      rid: z.string(),
      t: z.literal(ROOM_TYPES.direct),
      usernames: z.array(z.string()).default([]),
    })
    .passthrough(),
});

export const getRoomsResponseSchema = rocketChatSuccessSchema.extend({
  remove: z.array(z.unknown()),
  update: z.array(rocketChatRoomSchema),
});

export const getRoomMessagesResponseSchema = rocketChatSuccessSchema.extend({
  count: z.number().optional(),
  messages: z.array(rocketChatMessageSchema),
  offset: z.number().optional(),
  total: z.number().optional(),
});

export const rocketChatUnreadMentionSchema = z.object({
  messages: z.array(rocketChatMessageSchema),
  roomId: z.string(),
  roomName: z.string(),
  unreadCount: z.number().int().nonnegative(),
});

export const getUnreadMentionsSummarySchema = z.object({
  mentions: z.array(rocketChatUnreadMentionSchema),
  totalMentions: z.number().int().nonnegative(),
  user: rocketChatUserInfoSchema,
});

export type RocketChatUser = z.infer<typeof rocketChatUserSchema>;
export type RocketChatMessage = z.infer<typeof rocketChatMessageSchema>;
export type RocketChatRoom = z.infer<typeof rocketChatRoomSchema>;
export type RocketChatUserInfo = z.infer<typeof rocketChatUserInfoSchema>;
export type RocketChatUnreadMentionsSummary = z.infer<
  typeof getUnreadMentionsSummarySchema
>;

const queryStringSchema = z.string().min(1);

export class RocketChatClient {
  private readonly http: AxiosInstance;

  public constructor(serverUrl: string, authToken: string, userId: string) {
    const normalizedServerUrl = serverUrl.replace(/\/+$/, '');

    this.http = axios.create({
      baseURL: `${normalizedServerUrl}/api/v1`,
      headers: {
        'X-Auth-Token': authToken,
        'X-User-Id': userId,
      },
      timeout: 15_000,
    });
  }

  public async sendMessage(input: {
    alias?: string;
    channel?: string;
    roomId?: string;
    text: string;
  }): Promise<z.infer<typeof postMessageResponseSchema>> {
    try {
      return await this.request(
        {
          data: input,
          method: 'POST',
          url: ROCKET_CHAT_API_PATHS.postMessage,
        },
        postMessageResponseSchema,
      );
    } catch (error) {
      throw this.toRocketChatError(error, ROCKET_CHAT_API_PATHS.postMessage);
    }
  }

  public async createChannel(input: {
    isPrivate?: boolean;
    members?: string[];
    name: string;
  }): Promise<RocketChatRoom> {
    try {
      const response = await this.request(
        {
          data: {
            members: input.members ?? [],
            name: input.name,
          },
          method: 'POST',
          url: input.isPrivate
            ? ROCKET_CHAT_API_PATHS.groupsCreate
            : ROCKET_CHAT_API_PATHS.channelsCreate,
        },
        createChannelResponseSchema,
      );

      const room =
        (response as { channel?: RocketChatRoom; group?: RocketChatRoom }).channel ??
        (response as { channel?: RocketChatRoom; group?: RocketChatRoom }).group;

      if (!room) {
        throw new RocketChatError({
          message: `${ROCKET_CHAT_API_PATHS.channelsCreate}: Channel response did not include a room.`,
        });
      }

      return room;
    } catch (error) {
      throw this.toRocketChatError(
        error,
        input.isPrivate
          ? ROCKET_CHAT_API_PATHS.groupsCreate
          : ROCKET_CHAT_API_PATHS.channelsCreate,
      );
    }
  }

  public async getChannels(): Promise<RocketChatRoom[]> {
    try {
      const response = await this.request(
        {
          method: 'GET',
          params: { count: 0 },
          url: ROCKET_CHAT_API_PATHS.channelsList,
        },
        getChannelsResponseSchema,
      );

      return response.channels;
    } catch (error) {
      throw this.toRocketChatError(error, ROCKET_CHAT_API_PATHS.channelsList);
    }
  }

  public async getUsers(input?: { usernames?: string[] }): Promise<RocketChatUser[]> {
    try {
      const usernames = input?.usernames?.filter((value) => value.trim().length > 0) ?? [];
      const params =
        usernames.length > 0
          ? {
              query: JSON.stringify({
                username: {
                  $in: usernames,
                },
              }),
            }
          : undefined;

      const response = await this.request(
        {
          method: 'GET',
          params,
          url: ROCKET_CHAT_API_PATHS.usersList,
        },
        getUsersResponseSchema,
      );

      return response.users;
    } catch (error) {
      throw this.toRocketChatError(error, ROCKET_CHAT_API_PATHS.usersList);
    }
  }

  public async searchMessages(input: {
    count?: number;
    offset?: number;
    roomId: string;
    searchText: string;
  }): Promise<RocketChatMessage[]> {
    try {
      const response = await this.request(
        {
          method: 'GET',
          params: {
            count: input.count ?? DEFAULT_SEARCH_LIMIT,
            offset: input.offset ?? 0,
            roomId: input.roomId,
            searchText: queryStringSchema.parse(input.searchText),
          },
          url: ROCKET_CHAT_API_PATHS.searchMessages,
        },
        searchMessagesResponseSchema,
      );

      return response.messages;
    } catch (error) {
      throw this.toRocketChatError(error, ROCKET_CHAT_API_PATHS.searchMessages);
    }
  }

  public async archiveChannel(input: { roomId: string }): Promise<boolean> {
    try {
      await this.request(
        {
          data: { roomId: input.roomId },
          method: 'POST',
          url: ROCKET_CHAT_API_PATHS.channelsArchive,
        },
        archiveChannelResponseSchema,
      );

      return true;
    } catch (error) {
      throw this.toRocketChatError(error, ROCKET_CHAT_API_PATHS.channelsArchive);
    }
  }

  public async createUser(input: {
    active?: boolean;
    email: string;
    joinDefaultChannels?: boolean;
    name: string;
    password: string;
    requirePasswordChange?: boolean;
    roles?: string[];
    sendWelcomeEmail?: boolean;
    username: string;
    verified?: boolean;
  }): Promise<RocketChatUser> {
    try {
      const response = await this.request(
        {
          data: {
            active: input.active ?? true,
            email: input.email,
            joinDefaultChannels: input.joinDefaultChannels ?? true,
            name: input.name,
            password: input.password,
            requirePasswordChange: input.requirePasswordChange ?? false,
            roles: input.roles,
            sendWelcomeEmail: input.sendWelcomeEmail ?? false,
            username: input.username,
            verified: input.verified ?? false,
          },
          method: 'POST',
          url: ROCKET_CHAT_API_PATHS.userCreate,
        },
        createUserResponseSchema,
      );

      return response.user;
    } catch (error) {
      throw this.toRocketChatError(error, ROCKET_CHAT_API_PATHS.userCreate);
    }
  }

  public async setUserActiveStatus(input: {
    activeStatus: boolean;
    confirmRelinquish?: boolean;
    userId: string;
  }): Promise<z.infer<typeof setUserActiveStatusResponseSchema>['user']> {
    try {
      const response = await this.request(
        {
          data: {
            activeStatus: input.activeStatus,
            confirmRelinquish: input.confirmRelinquish ?? false,
            userId: input.userId,
          },
          method: 'POST',
          url: ROCKET_CHAT_API_PATHS.setUserActiveStatus,
        },
        setUserActiveStatusResponseSchema,
      );

      return response.user;
    } catch (error) {
      throw this.toRocketChatError(error, ROCKET_CHAT_API_PATHS.setUserActiveStatus);
    }
  }

  public async getUnreadMentions(input: {
    limit?: number;
    username: string;
  }): Promise<RocketChatUnreadMentionsSummary> {
    try {
      const user = await this.getUserInfo({
        includeUserRooms: true,
        username: input.username,
      });
      const mentionLimit = input.limit ?? DEFAULT_MESSAGE_LIMIT;
      const roomsWithUnreadMentions =
        user.rooms?.filter((room) => (room.userMentions ?? 0) > 0) ?? [];

      const mentionResults = await Promise.all(
        roomsWithUnreadMentions.map(async (room) => {
          const roomId = room._id ?? room.rid;

          if (!roomId) {
            return {
              messages: [],
              roomId: 'unknown-room',
              roomName: room.name ?? room.fname ?? 'unknown-room',
              unreadCount: room.userMentions ?? 0,
            };
          }

          const response = await this.getRoomMessages({
            count: Math.max(room.userMentions ?? 1, 1),
            mentionUserId: user._id,
            roomId,
            roomType: room.t,
          });

          return {
            messages: response.messages.slice(0, mentionLimit),
            roomId,
            roomName: room.name ?? room.fname ?? roomId,
            unreadCount: room.userMentions ?? 0,
          };
        }),
      );

      const totalMentions = mentionResults.reduce(
        (total, room) => total + room.messages.length,
        0,
      );

      return getUnreadMentionsSummarySchema.parse({
        mentions: mentionResults,
        totalMentions,
        user,
      });
    } catch (error) {
      throw this.toRocketChatError(error, ROCKET_CHAT_API_PATHS.getMentionedMessages);
    }
  }

  public async uploadFile(input: {
    content: Buffer;
    filename: string;
    message: string;
    roomId: string;
  }): Promise<z.infer<typeof uploadFileResponseSchema>['file']> {
    try {
      const formData = new FormData();
      formData.append('msg', input.message);
      formData.append(
        'file',
        new Blob([input.content]),
        input.filename,
      );

      const response = await this.request(
        {
          data: formData,
          method: 'POST',
          url: `${ROCKET_CHAT_API_PATHS.roomsMedia}/${input.roomId}`,
        },
        uploadFileResponseSchema,
      );

      return response.file;
    } catch (error) {
      throw this.toRocketChatError(error, ROCKET_CHAT_API_PATHS.roomsMedia);
    }
  }

  public async getUserInfo(input: {
    includeUserRooms?: boolean;
    userId?: string;
    username?: string;
  }): Promise<RocketChatUserInfo> {
    try {
      const response = await this.request(
        {
          method: 'GET',
          params: {
            includeUserRooms: input.includeUserRooms ?? false,
            userId: input.userId,
            username: input.username,
          },
          url: ROCKET_CHAT_API_PATHS.userInfo,
        },
        getUserInfoResponseSchema,
      );

      return response.user;
    } catch (error) {
      throw this.toRocketChatError(error, ROCKET_CHAT_API_PATHS.userInfo);
    }
  }

  public async getRoomInfo(input: {
    roomId?: string;
    roomName?: string;
  }): Promise<RocketChatRoom> {
    try {
      const response = await this.request(
        {
          method: 'GET',
          params: {
            roomId: input.roomId,
            roomName: input.roomName,
          },
          url: ROCKET_CHAT_API_PATHS.roomInfo,
        },
        getRoomInfoResponseSchema,
      );

      return response.room;
    } catch (error) {
      throw this.toRocketChatError(error, ROCKET_CHAT_API_PATHS.roomInfo);
    }
  }

  public async setRoomTopic(input: {
    isPrivate?: boolean;
    roomId: string;
    topic: string;
  }): Promise<string> {
    try {
      const response = await this.request(
        {
          data: {
            roomId: input.roomId,
            topic: input.topic,
          },
          method: 'POST',
          url: input.isPrivate
            ? ROCKET_CHAT_API_PATHS.groupsSetTopic
            : ROCKET_CHAT_API_PATHS.channelsSetTopic,
        },
        setRoomTopicResponseSchema,
      );

      return response.topic;
    } catch (error) {
      throw this.toRocketChatError(
        error,
        input.isPrivate
          ? ROCKET_CHAT_API_PATHS.groupsSetTopic
          : ROCKET_CHAT_API_PATHS.channelsSetTopic,
      );
    }
  }

  public async inviteUsersToRoom(input: {
    isPrivate?: boolean;
    roomId: string;
    userIds: string[];
  }): Promise<RocketChatRoom> {
    try {
      const response = await this.request(
        {
          data:
            input.userIds.length === 1
              ? {
                  roomId: input.roomId,
                  userId: input.userIds[0],
                }
              : {
                  roomId: input.roomId,
                  userIds: input.userIds,
                },
          method: 'POST',
          url: input.isPrivate
            ? ROCKET_CHAT_API_PATHS.groupsInvite
            : ROCKET_CHAT_API_PATHS.channelsInvite,
        },
        inviteUsersResponseSchema,
      );

      const room =
        (response as { channel?: RocketChatRoom; group?: RocketChatRoom }).channel ??
        (response as { channel?: RocketChatRoom; group?: RocketChatRoom }).group;

      if (!room) {
        throw new RocketChatError({
          message: `${ROCKET_CHAT_API_PATHS.channelsInvite}: Invite response did not include a room.`,
        });
      }

      return room;
    } catch (error) {
      throw this.toRocketChatError(
        error,
        input.isPrivate
          ? ROCKET_CHAT_API_PATHS.groupsInvite
          : ROCKET_CHAT_API_PATHS.channelsInvite,
      );
    }
  }

  public async createDirectMessage(input: {
    excludeSelf?: boolean;
    username?: string;
    usernames?: string[];
  }): Promise<z.infer<typeof createDirectMessageResponseSchema>['room']> {
    try {
      const response = await this.request(
        {
          data:
            input.usernames && input.usernames.length > 0
              ? {
                  excludeSelf: input.excludeSelf ?? false,
                  usernames: input.usernames.join(','),
                }
              : {
                  excludeSelf: input.excludeSelf ?? false,
                  username: input.username,
                },
          method: 'POST',
          url: ROCKET_CHAT_API_PATHS.createDirectMessage,
        },
        createDirectMessageResponseSchema,
      );

      return response.room;
    } catch (error) {
      throw this.toRocketChatError(error, ROCKET_CHAT_API_PATHS.createDirectMessage);
    }
  }

  public async getRooms(): Promise<RocketChatRoom[]> {
    try {
      const response = await this.request(
        {
          method: 'GET',
          url: ROCKET_CHAT_API_PATHS.roomsGet,
        },
        getRoomsResponseSchema,
      );

      return response.update;
    } catch (error) {
      throw this.toRocketChatError(error, ROCKET_CHAT_API_PATHS.roomsGet);
    }
  }

  public async getRoomMessages(input: {
    count?: number;
    mentionUserId?: string;
    roomId: string;
    roomType: RocketChatRoom['t'];
  }): Promise<z.infer<typeof getRoomMessagesResponseSchema>> {
    try {
      const url =
        input.roomType === ROOM_TYPES.channel
          ? ROCKET_CHAT_API_PATHS.channelsMessages
          : input.roomType === ROOM_TYPES.group
            ? ROCKET_CHAT_API_PATHS.groupsMessages
            : ROCKET_CHAT_API_PATHS.directMessages;
      const params =
        input.roomType === ROOM_TYPES.direct
          ? {
              count: input.count ?? DEFAULT_MESSAGE_LIMIT,
              roomId: input.roomId,
            }
          : {
              count: input.count ?? DEFAULT_MESSAGE_LIMIT,
              mentionIds: input.mentionUserId,
              roomId: input.roomId,
            };

      return await this.request(
        {
          method: 'GET',
          params,
          url,
        },
        getRoomMessagesResponseSchema,
      );
    } catch (error) {
      throw this.toRocketChatError(error, 'messages.list');
    }
  }

  private async request<TSchema extends z.ZodTypeAny>(
    config: AxiosRequestConfig,
    schema: TSchema,
  ): Promise<z.infer<TSchema>> {
    const response = await this.http.request<unknown>(config);

    return schema.parse(response.data);
  }

  private toRocketChatError(error: unknown, endpoint: string): RocketChatError {
    if (error instanceof RocketChatError) {
      return error;
    }

    if (error instanceof AxiosError) {
      const parsedBody = rocketChatFailureSchema.safeParse(error.response?.data);
      const message =
        parsedBody.success && (parsedBody.data.error ?? parsedBody.data.message)
          ? parsedBody.data.error ?? parsedBody.data.message ?? 'Rocket.Chat request failed.'
          : error.message;

      return new RocketChatError({
        details: parsedBody.success ? parsedBody.data.details : error.response?.data,
        errorType: parsedBody.success ? parsedBody.data.errorType : undefined,
        message: `${endpoint}: ${message}`,
        statusCode: error.response?.status,
      });
    }

    if (error instanceof z.ZodError) {
      return new RocketChatError({
        details: error.flatten(),
        message: `${endpoint}: Failed to parse Rocket.Chat response.`,
      });
    }

    return new RocketChatError({
      details: error,
      message: `${endpoint}: Unknown Rocket.Chat error.`,
    });
  }
}
