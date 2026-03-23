#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { checkbox, input, password } from '@inquirer/prompts';
import chalk from 'chalk';
import { Command } from 'commander';

import {
  AVAILABLE_WORKFLOWS,
  GENERATED_SERVER_NAME,
  type WorkflowName,
} from './constants.js';
import { generateProject } from './generator.js';

export interface CliOptions {
  output?: string;
}

export const runInteractiveGenerator = async (
  options: CliOptions = {},
): Promise<string> => {
  const serverUrl = await input({
    default: 'https://chat.example.com',
    message: 'Rocket.Chat server URL',
    validate: (value) => (value.trim().length > 0 ? true : 'Server URL is required.'),
  });
  const authToken = await password({
    message: 'Rocket.Chat auth token',
    validate: (value) => (value.trim().length > 0 ? true : 'Auth token is required.'),
  });
  const userId = await input({
    message: 'Rocket.Chat user ID',
    validate: (value) => (value.trim().length > 0 ? true : 'User ID is required.'),
  });
  const selectedWorkflows = await checkbox<WorkflowName>({
    choices: AVAILABLE_WORKFLOWS.map((workflow) => ({
      checked: false,
      name: `${workflow.title} — ${workflow.description}`,
      value: workflow.name,
    })),
    message: 'Select Rocket.Chat workflows to include',
    validate: (value) =>
      value.length > 0 ? true : 'Select at least one workflow to generate.',
  });

  const defaultOutput = path.resolve(
    process.cwd(),
    'generated',
    GENERATED_SERVER_NAME,
  );
  const generatedProject = await generateProject({
    authToken,
    outputDirectory: options.output
      ? path.resolve(options.output)
      : defaultOutput,
    selectedWorkflows,
    serverUrl,
    userId,
  });

  console.log(
    chalk.green(`Generated Rocket.Chat MCP server at ${generatedProject.outputDirectory}`),
  );
  console.log(
    chalk.cyan(
      `Included workflows: ${generatedProject.selectedWorkflows
        .map((workflow) => workflow.name)
        .join(', ')}`,
    ),
  );

  return generatedProject.outputDirectory;
};

export const createCli = (): Command =>
  new Command()
    .name('rc-mcp-generator')
    .description('Generate a minimal Rocket.Chat MCP server.')
    .option('-o, --output <path>', 'Output directory for the generated server')
    .action(async (commandOptions: CliOptions) => {
      await runInteractiveGenerator(commandOptions);
    });

const currentFile = fileURLToPath(import.meta.url);
const entryPoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : undefined;

if (entryPoint && import.meta.url === entryPoint) {
  await createCli().parseAsync(process.argv);
}

