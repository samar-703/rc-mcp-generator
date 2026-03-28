#!/usr/bin/env node
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { checkbox, input, password } from '@inquirer/prompts';
import chalk from 'chalk';
import { Command } from 'commander';

import { AVAILABLE_WORKFLOWS, GENERATED_SERVER_NAME, type WorkflowName } from './constants.js';
import { ROCKET_CHAT_PROVIDER } from './core/provider-config.js';
import { SchemaExtractor } from './core/schema-extractor.js';
import {
  buildSuggestionClusters,
  searchEndpoints,
  suggestWorkflows,
} from './core/suggest-engine.js';
import { generateProject, validateServer, analyzeMinimalityForOperationIds } from './generator.js';

export interface CliOptions {
  output?: string;
}

export const runInteractiveGenerator = async (
  options: CliOptions = {},
): Promise<string> => {
  const rcServerUrl = await input({
    default: 'http://localhost:3000',
    message: 'Rocket.Chat server URL',
    validate: (value) => (value.trim().length > 0 ? true : 'Server URL is required.'),
  });
  const rcAuthToken = await password({
    message: 'Rocket.Chat auth token',
  });
  const rcUserId = await input({
    message: 'Rocket.Chat user ID',
    validate: (value) => (value.trim().length > 0 ? true : 'User ID is required.'),
  });
  const workflows = await checkbox<WorkflowName>({
    choices: AVAILABLE_WORKFLOWS.map((workflow) => ({
      checked: false,
      name: `${workflow.title} — ${workflow.description}`,
      value: workflow.name,
    })),
    message: 'Select workflow tools to include',
  });
  const operationIdsInput = await input({
    default: '',
    message: 'Optional OpenAPI operationIds to include (comma-separated)',
  });
  const operationIds = parseCsv(operationIdsInput);

  const defaultOutput = path.resolve(process.cwd(), 'generated', GENERATED_SERVER_NAME);
  const generatedProject = await generateProject({
    operationIds,
    outputDirectory: options.output ? path.resolve(options.output) : defaultOutput,
    rcAuthToken,
    rcServerUrl,
    rcUserId,
    workflows,
  });

  console.log(chalk.green(`Generated server at ${generatedProject.outputDirectory}`));
  console.log(
    chalk.cyan(
      `Included tools: ${generatedProject.generatedTools.map((tool) => tool.name).join(', ')}`,
    ),
  );

  return generatedProject.outputDirectory;
};

const parseCsv = (value?: string): string[] =>
  value
    ? value
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
    : [];

export const createCli = (): Command => {
  const extractor = new SchemaExtractor(ROCKET_CHAT_PROVIDER);
  const program = new Command()
    .name('rc-mcp')
    .description('Generate minimal Rocket.Chat MCP servers.')
    .action(async (commandOptions: CliOptions) => {
      await runInteractiveGenerator(commandOptions);
    });

  program
    .command('list-workflows')
    .description('List predefined Rocket.Chat workflows.')
    .action(() => {
      for (const workflow of AVAILABLE_WORKFLOWS) {
        console.log(`${workflow.name}: ${workflow.description}`);
      }
    });

  program
    .command('search')
    .description('Search Rocket.Chat endpoints by keyword.')
    .argument('<query>', 'Search query')
    .option('-d, --domains <domains>', 'Comma-separated domain names')
    .option('-l, --limit <limit>', 'Result limit', '10')
    .action(async (query: string, commandOptions: { domains?: string; limit: string }) => {
      const endpoints = await extractor.getEndpoints();
      const results = searchEndpoints(
        endpoints,
        query,
        Number.parseInt(commandOptions.limit, 10),
        parseCsv(commandOptions.domains),
      );

      console.log(JSON.stringify(results, null, 2));
    });

  program
    .command('suggest')
    .description('Suggest workflows and endpoint clusters from plain English intent.')
    .argument('<intent>', 'Plain-English intent')
    .action(async (intent: string) => {
      const [endpoints, workflows] = await Promise.all([
        extractor.getEndpoints(),
        Promise.resolve(AVAILABLE_WORKFLOWS),
      ]);
      const clusters = buildSuggestionClusters(searchEndpoints(endpoints, intent, 12));
      const suggestedWorkflows = suggestWorkflows(workflows, intent);

      console.log(
        JSON.stringify(
          {
            clusters,
            workflows: suggestedWorkflows,
          },
          null,
          2,
        ),
      );
    });

  program
    .command('discover')
    .description('Browse domains and tags in the Rocket.Chat OpenAPI catalog.')
    .option('-d, --domains <domains>', 'Comma-separated domain names')
    .option('-e, --expand <tags>', 'Comma-separated tag names to expand')
    .action(async (commandOptions: { domains?: string; expand?: string }) => {
      const domains = parseCsv(commandOptions.domains);
      const expand = parseCsv(commandOptions.expand);
      const [summary, expanded] = await Promise.all([
        extractor.getTagSummary(domains),
        expand.length > 0
          ? extractor.getEndpointsByTag({ domains, tags: expand })
          : Promise.resolve({}),
      ]);
      console.log(JSON.stringify({ expanded, summary }, null, 2));
    });

  program
    .command('generate')
    .description('Generate a standalone minimal MCP server.')
    .requiredOption('-o, --output <path>', 'Output directory')
    .option('-w, --workflows <workflows>', 'Comma-separated workflow names')
    .option('-p, --operation-ids <operationIds>', 'Comma-separated OpenAPI operationIds')
    .option('--server-name <serverName>', 'Generated server package name', GENERATED_SERVER_NAME)
    .option('--rc-url <rcServerUrl>', 'Rocket.Chat base URL', 'http://localhost:3000')
    .option('--rc-auth-token <rcAuthToken>', 'Rocket.Chat PAT/token')
    .option('--rc-user-id <rcUserId>', 'Rocket.Chat user ID')
    .option('--install-dependencies', 'Run npm install and npm run build in generated output')
    .option('--register-with-gemini', 'Register generated server into ~/.gemini/settings.json')
    .action(
      async (commandOptions: {
        installDependencies?: boolean;
        operationIds?: string;
        output: string;
        rcAuthToken?: string;
        rcServerUrl: string;
        rcUserId?: string;
        registerWithGemini?: boolean;
        serverName: string;
        workflows?: string;
      }) => {
        const result = await generateProject({
          installDependencies: commandOptions.installDependencies,
          operationIds: parseCsv(commandOptions.operationIds),
          outputDirectory: commandOptions.output,
          rcAuthToken: commandOptions.rcAuthToken,
          rcServerUrl: commandOptions.rcServerUrl,
          rcUserId: commandOptions.rcUserId,
          registerWithGemini: commandOptions.registerWithGemini,
          serverName: commandOptions.serverName,
          workflows: parseCsv(commandOptions.workflows),
        });

        console.log(JSON.stringify(result, null, 2));
      },
    );

  program
    .command('validate')
    .description('Validate a generated server directory.')
    .argument('<serverDir>', 'Generated server directory')
    .option('--deep', 'Run `npx tsc --noEmit` inside the generated project')
    .action(async (serverDir: string, commandOptions: { deep?: boolean }) => {
      const result = await validateServer(path.resolve(serverDir), {
        deep: commandOptions.deep,
      });
      console.log(JSON.stringify(result, null, 2));
    });

  program
    .command('analyze')
    .description('Analyze minimality for a selected endpoint set.')
    .requiredOption('-p, --operation-ids <operationIds>', 'Comma-separated operationIds')
    .action(async (commandOptions: { operationIds: string }) => {
      const report = await analyzeMinimalityForOperationIds(parseCsv(commandOptions.operationIds));
      console.log(JSON.stringify(report, null, 2));
    });

  return program;
};

const entryPoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : undefined;

if (entryPoint && import.meta.url === entryPoint) {
  await createCli().parseAsync(process.argv);
}
