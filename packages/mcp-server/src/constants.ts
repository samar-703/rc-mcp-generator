export const PACKAGE_NAME = '@rc-mcp-generator/mcp-server';
export const SERVER_NAME = 'rc-mcp-server';
export const SERVER_VERSION = '1.0.0';
export const DEFAULT_PORT = 3000;
export const DEFAULT_MESSAGE_LIMIT = 20;
export const DEFAULT_SEARCH_LIMIT = 10;
export const DEFAULT_SUMMARY_LIMIT = 15;
export const DEFAULT_SUPPORT_CHANNEL_PREFIX = 'ticket-';
export const CHANNEL_PREFIX = '#';
export const USERNAME_PREFIX = '@';

export const HTTP_ROUTES = {
  health: '/health',
  mcp: '/mcp',
} as const;

export const ENV_KEYS = {
  serverUrl: 'RC_SERVER_URL',
  authToken: 'RC_AUTH_TOKEN',
  userId: 'RC_USER_ID',
  enabledTools: 'ENABLED_TOOLS',
  port: 'PORT',
} as const;

export const ROCKET_CHAT_API_PATHS = {
  channelsArchive: '/channels.archive',
  channelsCreate: '/channels.create',
  channelsInvite: '/channels.invite',
  channelsList: '/channels.list',
  channelsMessages: '/channels.messages',
  channelsSetTopic: '/channels.setTopic',
  createDirectMessage: '/dm.create',
  directMessages: '/dm.messages.others',
  getMentionedMessages: '/chat.getMentionedMessages',
  groupsCreate: '/groups.create',
  groupsInvite: '/groups.invite',
  groupsMessages: '/groups.messages',
  groupsSetTopic: '/groups.setTopic',
  postMessage: '/chat.postMessage',
  roomInfo: '/rooms.info',
  roomsGet: '/rooms.get',
  roomsMedia: '/rooms.media',
  searchMessages: '/chat.search',
  setUserActiveStatus: '/users.setActiveStatus',
  userCreate: '/users.create',
  userInfo: '/users.info',
  usersList: '/users.list',
} as const;

export const ROOM_TYPES = {
  channel: 'c',
  direct: 'd',
  group: 'p',
} as const;

export const TOOL_METADATA = {
  send_channel_message: {
    description: 'Send a message to a Rocket.Chat channel by name.',
    fileName: 'send_channel_message',
  },
  create_project_room: {
    description: 'Create a project room, set its topic, and invite teammates.',
    fileName: 'create_project_room',
  },
  onboard_user: {
    description:
      'Create a user, place them into their default channels, and send a welcome DM.',
    fileName: 'onboard_user',
  },
  search_messages: {
    description: 'Search messages across accessible rooms or within a specific channel.',
    fileName: 'search_messages',
  },
  archive_project_channel: {
    description: 'Notify a project channel and archive it.',
    fileName: 'archive_project_channel',
  },
  get_user_mentions: {
    description: 'Fetch unread mentions for a workspace user.',
    fileName: 'get_user_mentions',
  },
  post_standup: {
    description: 'Post a structured standup update into a channel.',
    fileName: 'post_standup',
  },
  create_support_ticket: {
    description:
      'Create a private support ticket room and seed it with the requester and support team.',
    fileName: 'create_support_ticket',
  },
  broadcast_announcement: {
    description: 'Broadcast the same announcement to multiple channels.',
    fileName: 'broadcast_announcement',
  },
  export_channel_summary: {
    description: 'Fetch recent channel messages and return a formatted summary.',
    fileName: 'export_channel_summary',
  },
} as const;

export type ToolName = keyof typeof TOOL_METADATA;
export const ALL_TOOL_NAMES = Object.keys(TOOL_METADATA) as ToolName[];
