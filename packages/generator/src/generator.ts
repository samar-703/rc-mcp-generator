import path from 'node:path';
import { fileURLToPath } from 'node:url';

import fs from 'fs-extra';
import Handlebars from 'handlebars';

import {
  AVAILABLE_WORKFLOWS,
  GENERATED_SERVER_NAME,
  WORKFLOW_MAP,
  type WorkflowMetadata,
  type WorkflowName,
} from './constants.js';

export interface GeneratorConfig {
  authToken: string;
  outputDirectory: string;
  selectedWorkflows: WorkflowName[];
  serverUrl: string;
  userId: string;
}

export interface GeneratedProject {
  outputDirectory: string;
  selectedWorkflows: WorkflowMetadata[];
}

const currentFilePath = fileURLToPath(import.meta.url);
const generatorPackageRoot = path.resolve(path.dirname(currentFilePath), '..');
const templatesRoot = path.resolve(generatorPackageRoot, 'src', 'templates');
const mcpServerRoot = path.resolve(generatorPackageRoot, '..', 'mcp-server');

const stableJson = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

const renderTemplate = async (
  templatePath: string,
  data: Record<string, unknown>,
): Promise<string> => {
  const template = await fs.readFile(templatePath, 'utf8');
  return Handlebars.compile(template, { noEscape: true })(data);
};

const ensureFreshOutputDirectory = async (targetDirectory: string): Promise<string> => {
  const absoluteTargetDirectory = path.resolve(targetDirectory);
  const exists = await fs.pathExists(absoluteTargetDirectory);

  if (!exists) {
    return absoluteTargetDirectory;
  }

  let suffix = 1;
  let candidate = `${absoluteTargetDirectory}-${suffix}`;

  while (await fs.pathExists(candidate)) {
    suffix += 1;
    candidate = `${absoluteTargetDirectory}-${suffix}`;
  }

  return candidate;
};

const resolveSelectedWorkflows = (
  selectedWorkflows: WorkflowName[],
): WorkflowMetadata[] =>
  selectedWorkflows.map((workflowName) => {
    const workflow = WORKFLOW_MAP.get(workflowName);

    if (!workflow) {
      throw new Error(`Unknown workflow: ${workflowName}`);
    }

    return workflow;
  });

const renderConstantsFile = (selectedWorkflows: WorkflowMetadata[]): string => {
  const toolMetadata = selectedWorkflows.reduce<Record<string, { description: string; fileName: string }>>(
    (accumulator, workflow) => {
      accumulator[workflow.name] = {
        description: workflow.description,
        fileName: workflow.fileName,
      };

      return accumulator;
    },
    {},
  );

  return `export const PACKAGE_NAME = '${GENERATED_SERVER_NAME}';
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

export const TOOL_METADATA = ${JSON.stringify(toolMetadata, null, 2)} as const;

export type ToolName = keyof typeof TOOL_METADATA;
export const ALL_TOOL_NAMES = Object.keys(TOOL_METADATA) as ToolName[];
`;
};

const renderToolRegistryFile = (selectedWorkflows: WorkflowMetadata[]): string => {
  const imports = selectedWorkflows
    .map(
      (workflow) =>
        `import * as ${workflow.fileName} from './tools/${workflow.fileName}.js';`,
    )
    .join('\n');
  const registry = selectedWorkflows.map((workflow) => workflow.fileName).join(',\n  ');

  return `import type { ToolModule } from './types.js';

${imports}

export const ALL_TOOL_MODULES: ToolModule[] = [
  ${registry}
];
`;
};

const renderPackageJson = (): string =>
  stableJson({
    name: GENERATED_SERVER_NAME,
    private: true,
    type: 'module',
    version: '1.0.0',
    scripts: {
      build: 'tsup src/index.ts src/server.ts --format esm --dts --clean',
      clean: 'rm -rf dist coverage',
      lint: 'eslint src tests --ext .ts',
      start: 'node dist/index.js',
      test: 'vitest run',
      typecheck: 'tsc --project tsconfig.json --noEmit',
    },
    dependencies: {
      '@modelcontextprotocol/sdk': '^1.17.0',
      axios: '^1.11.0',
      dotenv: '^17.2.2',
      zod: '^4.1.5',
    },
    devDependencies: {
      '@eslint/js': '^9.35.0',
      '@types/node': '^24.5.2',
      eslint: '^9.35.0',
      msw: '^2.11.2',
      prettier: '^3.6.2',
      tsup: '^8.5.0',
      typescript: '^5.9.2',
      'typescript-eslint': '^8.44.0',
      vitest: '^3.2.4',
    },
  });

const renderTsConfig = (): string =>
  stableJson({
    compilerOptions: {
      declaration: true,
      esModuleInterop: true,
      forceConsistentCasingInFileNames: true,
      lib: ['ES2022'],
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      noFallthroughCasesInSwitch: true,
      noImplicitOverride: true,
      noUncheckedIndexedAccess: true,
      outDir: 'dist',
      resolveJsonModule: true,
      rootDir: '.',
      skipLibCheck: true,
      sourceMap: true,
      strict: true,
      target: 'ES2022',
      types: ['node', 'vitest/globals'],
    },
    include: ['src/**/*.ts', 'tests/**/*.ts'],
  });

const renderEslintConfig = (): string => `const js = require('@eslint/js');
const tseslint = require('typescript-eslint');

module.exports = tseslint.config(
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json'],
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
    },
  },
);
`;

const renderPrettierConfig = (): string =>
  stableJson({
    semi: true,
    singleQuote: true,
    trailingComma: 'all',
  });

const renderGitignore = (): string => `dist
coverage
node_modules
.env
`;

const renderEnvExample = (config: GeneratorConfig): string => `RC_SERVER_URL=${config.serverUrl}
RC_AUTH_TOKEN=${config.authToken}
RC_USER_ID=${config.userId}
ENABLED_TOOLS=${config.selectedWorkflows.join(',')}
PORT=3000
`;

const renderDockerfile = (): string => `FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist/ ./dist/
EXPOSE 3000
CMD ["node", "dist/index.js"]
`;

const renderCurlExample = (workflow: WorkflowMetadata): string => `\`\`\`bash
curl -X POST http://localhost:3000/mcp \\
  -H "Content-Type: application/json" \\
  -H "Mcp-Session-Id: <SESSION_ID>" \\
  -d '{
    "jsonrpc": "2.0",
    "id": "${workflow.name}",
    "method": "tools/call",
    "params": {
      "name": "${workflow.name}",
      "arguments": ${JSON.stringify(workflow.exampleArgs, null, 8).replace(/\n/g, '\n      ')}
    }
  }'
\`\`\``;

const renderReadme = (selectedWorkflows: WorkflowMetadata[]): string => {
  const workflowSections = selectedWorkflows
    .map(
      (workflow) => `### \`${workflow.name}\`

${workflow.description}

Example input:
\`\`\`json
${JSON.stringify(workflow.exampleArgs, null, 2)}
\`\`\`

Example output summary:
\`\`\`text
${workflow.exampleResultSummary}
\`\`\`

Curl example:
${renderCurlExample(workflow)}
`,
    )
    .join('\n');

  return `# ${GENERATED_SERVER_NAME}

This is a generated minimal Rocket.Chat MCP server. It exists to avoid context bloat: instead of handing a general-purpose assistant a giant server with every Rocket.Chat action, you deploy only the workflows you actually need.

## Quick start

\`\`\`bash
npm install
cp .env.example .env
npm run build
npm run test
npm start
\`\`\`

## Included workflows

${selectedWorkflows.map((workflow) => `- \`${workflow.name}\` - ${workflow.description}`).join('\n')}

## MCP bootstrap

Initialize once to get an \`Mcp-Session-Id\` header, then use that session for tool calls:

\`\`\`bash
curl -i -X POST http://localhost:3000/mcp \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0",
    "id": "init",
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-03-26",
      "capabilities": {},
      "clientInfo": { "name": "curl", "version": "1.0.0" }
    }
  }'
\`\`\`

## Workflow examples

${workflowSections}
`;
};

const copySharedFile = async (
  sourceRelativePath: string,
  destinationDirectory: string,
  destinationRelativePath = sourceRelativePath,
): Promise<void> => {
  const sourcePath = path.resolve(mcpServerRoot, sourceRelativePath);
  const destinationPath = path.resolve(destinationDirectory, destinationRelativePath);

  await fs.ensureDir(path.dirname(destinationPath));
  await fs.copyFile(sourcePath, destinationPath);
};

const renderWorkflowTemplate = async (
  category: 'tools' | 'tests',
  workflow: WorkflowMetadata,
): Promise<string> => {
  const templatePath = path.resolve(templatesRoot, category, `${workflow.fileName}.${category === 'tools' ? 'ts' : 'test.ts'}.hbs`);
  const sourcePath = path.resolve(
    mcpServerRoot,
    category === 'tools'
      ? path.join('src', 'tools', `${workflow.fileName}.ts`)
      : path.join('tests', `${workflow.fileName}.test.ts`),
  );
  const source = await fs.readFile(sourcePath, 'utf8');

  return renderTemplate(templatePath, { source });
};

export const generateProject = async (
  config: GeneratorConfig,
): Promise<GeneratedProject> => {
  const selectedWorkflows = resolveSelectedWorkflows(config.selectedWorkflows);
  const outputDirectory = await ensureFreshOutputDirectory(config.outputDirectory);

  await fs.ensureDir(path.resolve(outputDirectory, 'src', 'tools'));
  await fs.ensureDir(path.resolve(outputDirectory, 'tests'));

  for (const sharedSourceFile of [
    'src/errors.ts',
    'src/index.ts',
    'src/rc-client.ts',
    'src/server.ts',
    'src/tool-utils.ts',
    'src/types.ts',
  ]) {
    await copySharedFile(sharedSourceFile, outputDirectory);
  }

  await copySharedFile('tests/server.test.ts', outputDirectory);
  await copySharedFile('tests/test-utils.ts', outputDirectory);

  await fs.writeFile(
    path.resolve(outputDirectory, 'src', 'constants.ts'),
    renderConstantsFile(selectedWorkflows),
  );
  await fs.writeFile(
    path.resolve(outputDirectory, 'src', 'tool-registry.ts'),
    renderToolRegistryFile(selectedWorkflows),
  );

  for (const workflow of selectedWorkflows) {
    const renderedToolSource = await renderWorkflowTemplate('tools', workflow);
    const renderedTestSource = await renderWorkflowTemplate('tests', workflow);

    await fs.writeFile(
      path.resolve(outputDirectory, 'src', 'tools', `${workflow.fileName}.ts`),
      renderedToolSource,
    );
    await fs.writeFile(
      path.resolve(outputDirectory, 'tests', `${workflow.fileName}.test.ts`),
      renderedTestSource,
    );
  }

  await fs.writeFile(path.resolve(outputDirectory, 'package.json'), renderPackageJson());
  await fs.writeFile(path.resolve(outputDirectory, 'tsconfig.json'), renderTsConfig());
  await fs.writeFile(path.resolve(outputDirectory, '.env.example'), renderEnvExample(config));
  await fs.writeFile(path.resolve(outputDirectory, 'Dockerfile'), renderDockerfile());
  await fs.writeFile(path.resolve(outputDirectory, 'README.md'), renderReadme(selectedWorkflows));
  await fs.writeFile(path.resolve(outputDirectory, 'eslint.config.js'), renderEslintConfig());
  await fs.writeFile(path.resolve(outputDirectory, '.gitignore'), renderGitignore());
  await fs.writeFile(path.resolve(outputDirectory, '.prettierrc.json'), renderPrettierConfig());

  return {
    outputDirectory,
    selectedWorkflows,
  };
};
