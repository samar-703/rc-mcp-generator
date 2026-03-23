import type { ToolModule } from './types.js';

import * as archiveProjectChannel from './tools/archive_project_channel.js';
import * as broadcastAnnouncement from './tools/broadcast_announcement.js';
import * as createProjectRoom from './tools/create_project_room.js';
import * as createSupportTicket from './tools/create_support_ticket.js';
import * as exportChannelSummary from './tools/export_channel_summary.js';
import * as getUserMentions from './tools/get_user_mentions.js';
import * as onboardUser from './tools/onboard_user.js';
import * as postStandup from './tools/post_standup.js';
import * as searchMessages from './tools/search_messages.js';
import * as sendChannelMessage from './tools/send_channel_message.js';

export const ALL_TOOL_MODULES: ToolModule[] = [
  sendChannelMessage,
  createProjectRoom,
  onboardUser,
  searchMessages,
  archiveProjectChannel,
  getUserMentions,
  postStandup,
  createSupportTicket,
  broadcastAnnouncement,
  exportChannelSummary,
];

