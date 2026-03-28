import { describe, expect, it } from 'vitest';

import { searchEndpoints, suggestWorkflows } from '../src/core/suggest-engine.js';
import { getWorkflowDefinitions } from '../src/core/workflow-registry.js';
import type { EndpointSchema } from '../src/core/types.js';

const endpoints: EndpointSchema[] = [
  {
    description: 'Post a message into a channel',
    domain: 'chat',
    method: 'post',
    operationId: 'postMessage',
    parameters: [],
    path: '/chat.postMessage',
    summary: 'Send a message',
    tags: ['messaging'],
    toolName: 'post_message',
  },
  {
    description: 'Search workspace messages',
    domain: 'chat',
    method: 'get',
    operationId: 'searchMessages',
    parameters: [],
    path: '/chat.search',
    summary: 'Search messages',
    tags: ['messaging'],
    toolName: 'search_messages',
  },
];

describe('suggest-engine', () => {
  it('ranks matching endpoints by intent keywords', () => {
    const results = searchEndpoints(endpoints, 'search messages', 5);

    expect(results[0]?.endpoint.operationId).toBe('searchMessages');
  });

  it('suggests relevant workflows from plain language', () => {
    const workflows = suggestWorkflows(
      getWorkflowDefinitions(),
      'broadcast an announcement to multiple channels',
    );

    expect(workflows[0]?.name).toBe('broadcast_announcement');
  });
});

