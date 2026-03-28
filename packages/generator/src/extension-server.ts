import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { AVAILABLE_WORKFLOWS } from './constants.js';
import { analyzeMinimality } from './core/minimality-analyzer.js';
import { ROCKET_CHAT_PROVIDER } from './core/provider-config.js';
import { SchemaExtractor } from './core/schema-extractor.js';
import {
  buildSuggestionClusters,
  searchEndpoints,
  suggestWorkflows,
} from './core/suggest-engine.js';
import { validateGeneratedServer } from './core/validator.js';
import { generateProject } from './generator.js';

const server = new McpServer({
  name: 'rc-mcp-generator',
  version: '1.0.0',
});

const extractor = new SchemaExtractor(ROCKET_CHAT_PROVIDER);

const createResult = (text: string, structuredContent?: Record<string, unknown>) => ({
  content: [{ text, type: 'text' as const }],
  structuredContent,
});

server.registerTool(
  'rc_list_workflows',
  {
    description: 'List predefined Rocket.Chat platform workflows.',
    inputSchema: z.object({}),
  },
  async () =>
    createResult(
      `Found ${AVAILABLE_WORKFLOWS.length} workflow definitions.`,
      {
        workflows: AVAILABLE_WORKFLOWS,
      },
    ),
);

server.registerTool(
  'rc_search_endpoints',
  {
    description: 'Keyword search across Rocket.Chat OpenAPI endpoints.',
    inputSchema: z.object({
      domains: z.array(z.string()).optional(),
      limit: z.number().int().positive().max(50).default(10),
      query: z.string().min(1),
    }),
  },
  async ({ domains, limit, query }) => {
    const endpoints = await extractor.getEndpoints();
    const results = searchEndpoints(endpoints, query, limit, domains);

    return createResult(`Found ${results.length} endpoint matches.`, {
      results,
    });
  },
);

server.registerTool(
  'rc_discover_endpoints',
  {
    description: 'Browse Rocket.Chat domains and tags from the OpenAPI catalog.',
    inputSchema: z.object({
      domains: z.array(z.string()).optional(),
      expand: z.array(z.string()).optional(),
    }),
  },
  async ({ domains, expand }) => {
    const [summary, expanded] = await Promise.all([
      extractor.getTagSummary(domains),
      expand && expand.length > 0
        ? extractor.getEndpointsByTag({ domains, tags: expand })
        : Promise.resolve({}),
    ]);

    return createResult('Loaded endpoint discovery summary.', {
      expanded,
      summary,
    });
  },
);

server.registerTool(
  'rc_suggest_endpoints',
  {
    description: 'Suggest endpoint clusters and workflows from a plain-English intent.',
    inputSchema: z.object({
      intent: z.string().min(1),
    }),
  },
  async ({ intent }) => {
    const endpoints = await extractor.getEndpoints();
    const clusters = buildSuggestionClusters(searchEndpoints(endpoints, intent, 12));
    const workflows = suggestWorkflows(AVAILABLE_WORKFLOWS, intent);

    return createResult('Generated endpoint and workflow suggestions.', {
      clusters,
      workflows,
    });
  },
);

server.registerTool(
  'rc_generate_server',
  {
    description:
      'Generate a standalone minimal Rocket.Chat MCP server from selected workflows and/or operationIds.',
    inputSchema: z.object({
      installDependencies: z.boolean().default(false),
      operationIds: z.array(z.string()).default([]),
      outputDir: z.string().min(1),
      rcAuthToken: z.string().optional(),
      rcServerUrl: z.string().url().optional(),
      rcUserId: z.string().optional(),
      registerWithGemini: z.boolean().default(false),
      serverName: z.string().min(1).default('generated-rc-mcp-server'),
      workflows: z.array(z.string()).default([]),
    }),
  },
  async ({
    installDependencies,
    operationIds,
    outputDir,
    rcAuthToken,
    rcServerUrl,
    rcUserId,
    registerWithGemini,
    serverName,
    workflows,
  }) => {
    const result = await generateProject({
      installDependencies,
      operationIds,
      outputDirectory: outputDir,
      rcAuthToken,
      rcServerUrl,
      rcUserId,
      registerWithGemini,
      serverName,
      workflows,
    });

    return createResult(`Generated minimal server at ${result.outputDirectory}.`, result as unknown as Record<string, unknown>);
  },
);

server.registerTool(
  'rc_validate_server',
  {
    description: 'Validate a generated Rocket.Chat MCP server directory.',
    inputSchema: z.object({
      deep: z.boolean().default(false),
      serverDir: z.string().min(1),
    }),
  },
  async ({ deep, serverDir }) => {
    const result = await validateGeneratedServer(serverDir, { deep });
    return createResult(
      result.valid ? 'Generated server validation passed.' : 'Generated server validation failed.',
      result as unknown as Record<string, unknown>,
    );
  },
);

server.registerTool(
  'rc_analyze_minimality',
  {
    description: 'Compute minimality metrics for a selected endpoint subset.',
    inputSchema: z.object({
      operationIds: z.array(z.string()).min(1),
    }),
  },
  async ({ operationIds }) => {
    const [allEndpoints, selectedEndpoints] = await Promise.all([
      extractor.getEndpoints(),
      extractor.getEndpointsByOperationId(operationIds),
    ]);
    const report = analyzeMinimality(allEndpoints, selectedEndpoints);

    return createResult('Computed minimality report.', report as unknown as Record<string, unknown>);
  },
);

export const startExtensionServer = async (): Promise<void> => {
  const transport = new StdioServerTransport();
  await server.connect(transport);
};

if (import.meta.url === `file://${process.argv[1]}`) {
  await startExtensionServer();
}
