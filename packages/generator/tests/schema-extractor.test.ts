import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { SchemaExtractor } from '../src/core/schema-extractor.js';
import type { ProviderConfig } from '../src/core/types.js';

const fixtureProvider: ProviderConfig = {
  apiBasePath: '/api/v1',
  authHeaderKeys: ['X-Auth-Token', 'X-User-Id'],
  name: 'fixture',
  specSource: {
    baseUrl: path.resolve(process.cwd(), 'tests', 'fixtures'),
    files: ['chat.json', 'users.json'],
  },
};

describe('SchemaExtractor', () => {
  it('loads endpoint schemas and strips auth headers', async () => {
    const extractor = new SchemaExtractor(fixtureProvider);
    const endpoints = await extractor.getEndpoints();

    expect(endpoints.map((endpoint) => endpoint.operationId)).toEqual([
      'getUserInfo',
      'postMessage',
      'searchMessages',
    ]);
    expect(
      endpoints.find((endpoint) => endpoint.operationId === 'postMessage')?.parameters,
    ).toEqual([]);
  });

  it('resolves selected operationIds', async () => {
    const extractor = new SchemaExtractor(fixtureProvider);
    const endpoints = await extractor.getEndpointsByOperationId(['searchMessages']);

    expect(endpoints).toHaveLength(1);
    expect(endpoints[0]?.toolName).toBe('search_messages');
  });

  it('expands endpoints by tag', async () => {
    const extractor = new SchemaExtractor(fixtureProvider);
    const expanded = await extractor.getEndpointsByTag({ tags: ['messaging'] });

    expect(Object.keys(expanded)).toEqual(['chat']);
    expect(expanded.chat?.messaging?.map((endpoint) => endpoint.operationId)).toEqual([
      'postMessage',
      'searchMessages',
    ]);
  });
});
