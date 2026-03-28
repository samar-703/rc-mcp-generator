import path from 'node:path';

import fs from 'fs-extra';
import { describe, expect, it } from 'vitest';

import { generateProject } from '../src/generator.js';
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

describe('generateProject', () => {
  it('generates standalone output with selected workflow and endpoint tools', async () => {
    const outputDirectory = path.resolve(process.cwd(), 'tmp-generated');
    await fs.remove(outputDirectory);

    const result = await generateProject({
      operationIds: ['searchMessages'],
      outputDirectory,
      provider: fixtureProvider,
      rcServerUrl: 'http://localhost:3000',
      workflows: ['send_channel_message'],
    });

    expect(result.validation.valid).toBe(true);
    expect(
      await fs.pathExists(path.resolve(result.outputDirectory, 'src', 'tools', 'send_channel_message.ts')),
    ).toBe(true);
    expect(
      await fs.pathExists(path.resolve(result.outputDirectory, 'src', 'tools', 'search_messages.ts')),
    ).toBe(true);
    expect(result.generatedTools.map((tool) => tool.name)).toEqual([
      'send_channel_message',
      'search_messages',
    ]);

    await fs.remove(result.outputDirectory);
  });

  it('generates endpoint tests with valid nested request body samples', async () => {
    const outputDirectory = path.resolve(process.cwd(), 'tmp-generated-nested');
    await fs.remove(outputDirectory);

    const result = await generateProject({
      operationIds: ['postMessage'],
      outputDirectory,
      provider: fixtureProvider,
      rcServerUrl: 'http://localhost:3000',
    });
    const generatedTest = await fs.readFile(
      path.resolve(result.outputDirectory, 'tests', 'post_message.test.ts'),
      'utf8',
    );

    expect(generatedTest).toContain('"channel": "value"');
    expect(generatedTest).toContain('"text": "value"');

    await fs.remove(result.outputDirectory);
  });
});
