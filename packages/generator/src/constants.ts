export interface WorkflowMetadata {
  description: string;
  exampleArgs: Record<string, unknown>;
  exampleResultSummary: string;
  fileName: string;
  name: string;
  title: string;
}

export const GENERATOR_NAME = 'rc-mcp-generator';
export const GENERATED_SERVER_NAME = 'generated-rc-mcp-server';

export const AVAILABLE_WORKFLOWS: readonly WorkflowMetadata[] = [
  {
    description: 'Send a message to a Rocket.Chat channel by name.',
    exampleArgs: {
      channelName: 'engineering',
      text: 'Deploy is complete.',
    },
    exampleResultSummary: 'Sent message to #engineering.',
    fileName: 'send_channel_message',
    name: 'send_channel_message',
    title: 'Send Channel Message',
  },
  {
    description: 'Create a project room, set its topic, and invite teammates.',
    exampleArgs: {
      channelName: 'project-atlas',
      invitees: ['alice', 'bob'],
      topic: 'Atlas delivery',
    },
    exampleResultSummary: 'Created project room project-atlas.',
    fileName: 'create_project_room',
    name: 'create_project_room',
    title: 'Create Project Room',
  },
  {
    description: 'Create a user, add them to default channels, and send a welcome DM.',
    exampleArgs: {
      defaultChannels: ['general', 'eng'],
      email: 'new.user@example.com',
      name: 'New User',
      password: 'Password123',
      username: 'new.user',
      welcomeMessage: 'Welcome aboard.',
    },
    exampleResultSummary: 'Onboarded new.user and added them to 2 channels.',
    fileName: 'onboard_user',
    name: 'onboard_user',
    title: 'Onboard User',
  },
  {
    description: 'Search messages across accessible rooms or within a specific channel.',
    exampleArgs: {
      channelName: 'general',
      limit: 10,
      query: 'deploy',
    },
    exampleResultSummary: 'Found 3 matching messages for "deploy".',
    fileName: 'search_messages',
    name: 'search_messages',
    title: 'Search Messages',
  },
  {
    description: 'Notify a project channel and archive it.',
    exampleArgs: {
      channelName: 'project-atlas',
      notice: 'This room is being archived.',
      notifyMembers: true,
    },
    exampleResultSummary: 'Archived project-atlas.',
    fileName: 'archive_project_channel',
    name: 'archive_project_channel',
    title: 'Archive Project Channel',
  },
  {
    description: 'Fetch unread mentions for a workspace user.',
    exampleArgs: {
      limit: 20,
      username: 'alice',
    },
    exampleResultSummary: 'Found 2 unread mentions for alice.',
    fileName: 'get_user_mentions',
    name: 'get_user_mentions',
    title: 'Get User Mentions',
  },
  {
    description: 'Post a structured standup update into a channel.',
    exampleArgs: {
      blockers: ['Waiting on review'],
      channelName: 'team-sync',
      today: ['Finish API tests'],
      username: 'alice',
      yesterday: ['Built the generator'],
    },
    exampleResultSummary: 'Posted standup update to #team-sync.',
    fileName: 'post_standup',
    name: 'post_standup',
    title: 'Post Standup',
  },
  {
    description:
      'Create a private support ticket room and seed it with the requester and support team.',
    exampleArgs: {
      requesterUsername: 'requester',
      summary: 'Customer cannot access billing.',
      supportUsernames: ['support.one', 'support.two'],
      ticketId: 'INC-42',
    },
    exampleResultSummary: 'Created private support ticket room ticket-inc-42.',
    fileName: 'create_support_ticket',
    name: 'create_support_ticket',
    title: 'Create Support Ticket',
  },
  {
    description: 'Broadcast the same announcement to multiple channels.',
    exampleArgs: {
      channelNames: ['engineering', 'product'],
      message: 'Deployment at 17:00 UTC.',
    },
    exampleResultSummary: 'Broadcast announcement to 2 channels.',
    fileName: 'broadcast_announcement',
    name: 'broadcast_announcement',
    title: 'Broadcast Announcement',
  },
  {
    description: 'Fetch recent channel messages and return a formatted summary.',
    exampleArgs: {
      channelName: 'general',
      limit: 15,
    },
    exampleResultSummary: 'Recent summary for general.',
    fileName: 'export_channel_summary',
    name: 'export_channel_summary',
    title: 'Export Channel Summary',
  },
] as const;

export type WorkflowName = (typeof AVAILABLE_WORKFLOWS)[number]['name'];

export const WORKFLOW_MAP = new Map(
  AVAILABLE_WORKFLOWS.map((workflow) => [workflow.name, workflow]),
);

