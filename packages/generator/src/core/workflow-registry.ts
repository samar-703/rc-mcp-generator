import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

import type { WorkflowDefinition } from './types.js';

const currentFilePath = fileURLToPath(import.meta.url);
const generatorPackageRoot = path.resolve(path.dirname(currentFilePath), '..', '..');
const workflowSourceRootCandidates = [
  path.resolve(process.cwd(), 'packages', 'mcp-server'),
  path.resolve(process.cwd(), '..', 'mcp-server'),
  path.resolve(generatorPackageRoot, '..', 'mcp-server'),
];
const lastWorkflowSourceRootCandidate =
  workflowSourceRootCandidates[workflowSourceRootCandidates.length - 1]!;
const workflowSourceRoot =
  workflowSourceRootCandidates.find((candidate) => fs.existsSync(candidate)) ??
  lastWorkflowSourceRootCandidate;

const resolveWorkflowPath = (kind: 'test' | 'tool', fileName: string): string =>
  kind === 'tool'
    ? path.resolve(workflowSourceRoot, 'src', 'tools', `${fileName}.ts`)
    : path.resolve(workflowSourceRoot, 'tests', `${fileName}.test.ts`);

export const WORKFLOW_REGISTRY: readonly WorkflowDefinition[] = [
  {
    description: 'Send a message to a Rocket.Chat channel by name.',
    exampleArgs: {
      channelName: 'engineering',
      text: 'Deploy is complete.',
    },
    exampleResultSummary: 'Sent message to #engineering.',
    name: 'send_channel_message',
    relatedApiMethods: ['sendMessage'],
    sourceTestFile: resolveWorkflowPath('test', 'send_channel_message'),
    sourceToolFile: resolveWorkflowPath('tool', 'send_channel_message'),
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
    name: 'create_project_room',
    relatedApiMethods: ['createChannel', 'setRoomTopic'],
    sourceTestFile: resolveWorkflowPath('test', 'create_project_room'),
    sourceToolFile: resolveWorkflowPath('tool', 'create_project_room'),
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
    name: 'onboard_user',
    relatedApiMethods: ['createUser', 'getRoomInfo', 'inviteUsersToRoom', 'createDirectMessage', 'sendMessage'],
    sourceTestFile: resolveWorkflowPath('test', 'onboard_user'),
    sourceToolFile: resolveWorkflowPath('tool', 'onboard_user'),
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
    name: 'search_messages',
    relatedApiMethods: ['getRooms', 'getRoomInfo', 'searchMessages'],
    sourceTestFile: resolveWorkflowPath('test', 'search_messages'),
    sourceToolFile: resolveWorkflowPath('tool', 'search_messages'),
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
    name: 'archive_project_channel',
    relatedApiMethods: ['getRoomInfo', 'sendMessage', 'archiveChannel'],
    sourceTestFile: resolveWorkflowPath('test', 'archive_project_channel'),
    sourceToolFile: resolveWorkflowPath('tool', 'archive_project_channel'),
    title: 'Archive Project Channel',
  },
  {
    description: 'Fetch unread mentions for a workspace user.',
    exampleArgs: {
      limit: 20,
      username: 'alice',
    },
    exampleResultSummary: 'Found 2 unread mentions for alice.',
    name: 'get_user_mentions',
    relatedApiMethods: ['getUserInfo', 'getRoomMessages'],
    sourceTestFile: resolveWorkflowPath('test', 'get_user_mentions'),
    sourceToolFile: resolveWorkflowPath('tool', 'get_user_mentions'),
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
    name: 'post_standup',
    relatedApiMethods: ['sendMessage'],
    sourceTestFile: resolveWorkflowPath('test', 'post_standup'),
    sourceToolFile: resolveWorkflowPath('tool', 'post_standup'),
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
    name: 'create_support_ticket',
    relatedApiMethods: ['createChannel', 'setRoomTopic', 'sendMessage'],
    sourceTestFile: resolveWorkflowPath('test', 'create_support_ticket'),
    sourceToolFile: resolveWorkflowPath('tool', 'create_support_ticket'),
    title: 'Create Support Ticket',
  },
  {
    description: 'Broadcast the same announcement to multiple channels.',
    exampleArgs: {
      channelNames: ['engineering', 'product'],
      message: 'Deployment at 17:00 UTC.',
    },
    exampleResultSummary: 'Broadcast announcement to 2 channels.',
    name: 'broadcast_announcement',
    relatedApiMethods: ['sendMessage'],
    sourceTestFile: resolveWorkflowPath('test', 'broadcast_announcement'),
    sourceToolFile: resolveWorkflowPath('tool', 'broadcast_announcement'),
    title: 'Broadcast Announcement',
  },
  {
    description: 'Fetch recent channel messages and return a formatted summary.',
    exampleArgs: {
      channelName: 'general',
      limit: 15,
    },
    exampleResultSummary: 'Recent summary for general.',
    name: 'export_channel_summary',
    relatedApiMethods: ['getRoomInfo', 'getRoomMessages'],
    sourceTestFile: resolveWorkflowPath('test', 'export_channel_summary'),
    sourceToolFile: resolveWorkflowPath('tool', 'export_channel_summary'),
    title: 'Export Channel Summary',
  },
] as const;

export const getWorkflowDefinitions = (): WorkflowDefinition[] => [...WORKFLOW_REGISTRY];

export const resolveWorkflows = (workflowNames: string[]): WorkflowDefinition[] => {
  const workflowMap = new Map(WORKFLOW_REGISTRY.map((workflow) => [workflow.name, workflow]));

  return workflowNames.map((workflowName) => {
    const workflow = workflowMap.get(workflowName);

    if (!workflow) {
      throw new Error(`Unknown workflow: ${workflowName}`);
    }

    return workflow;
  });
};
