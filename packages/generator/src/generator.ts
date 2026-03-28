import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fsNative from 'node:fs';

import fs from 'fs-extra';
import Handlebars from 'handlebars';

import { analyzeMinimality } from './core/minimality-analyzer.js';
import { ROCKET_CHAT_PROVIDER } from './core/provider-config.js';
import { SchemaExtractor } from './core/schema-extractor.js';
import type {
  EndpointParameter,
  EndpointSchema,
  GeneratedToolDescriptor,
  JsonSchema,
  MinimalityReport,
  ProviderConfig,
  ValidationSummary,
  WorkflowDefinition,
} from './core/types.js';
import { validateGeneratedServer } from './core/validator.js';
import { resolveWorkflows } from './core/workflow-registry.js';

const execFileAsync = promisify(execFile);

export interface GeneratorConfig {
  installDependencies?: boolean;
  operationIds?: string[];
  outputDirectory: string;
  provider?: ProviderConfig;
  rcAuthToken?: string;
  rcServerUrl?: string;
  rcUserId?: string;
  registerWithGemini?: boolean;
  serverName?: string;
  workflows?: string[];
}

export interface GeneratedProject {
  endpoints: EndpointSchema[];
  generatedTools: GeneratedToolDescriptor[];
  minimalityReport: MinimalityReport;
  outputDirectory: string;
  validation: ValidationSummary;
  workflows: WorkflowDefinition[];
}

const currentFilePath = fileURLToPath(import.meta.url);
const generatorPackageRoot = path.resolve(path.dirname(currentFilePath), '..');
const templatesRootCandidates = [
  path.resolve(process.cwd(), 'packages', 'generator', 'src', 'templates'),
  path.resolve(process.cwd(), 'src', 'templates'),
  path.resolve(generatorPackageRoot, 'src', 'templates'),
];
const mcpServerRootCandidates = [
  path.resolve(process.cwd(), 'packages', 'mcp-server'),
  path.resolve(process.cwd(), '..', 'mcp-server'),
  path.resolve(generatorPackageRoot, '..', 'mcp-server'),
];
const lastTemplatesRootCandidate = templatesRootCandidates[templatesRootCandidates.length - 1]!;
const lastMcpServerRootCandidate = mcpServerRootCandidates[mcpServerRootCandidates.length - 1]!;
const templatesRoot =
  templatesRootCandidates.find((candidate) => fsNative.existsSync(candidate)) ??
  lastTemplatesRootCandidate;
const mcpServerRoot =
  mcpServerRootCandidates.find((candidate) => fsNative.existsSync(candidate)) ??
  lastMcpServerRootCandidate;

const stableJson = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

const sanitizeName = (value: string): string =>
  value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');

const renderTemplate = async (
  templatePath: string,
  data: Record<string, unknown>,
): Promise<string> => {
  const template = await fs.readFile(templatePath, 'utf8');
  return Handlebars.compile(template, { noEscape: true })(data);
};

const ensureFreshOutputDirectory = async (targetDirectory: string): Promise<string> => {
  const absoluteTargetDirectory = path.resolve(targetDirectory);

  if (!(await fs.pathExists(absoluteTargetDirectory))) {
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

const createZodSchema = (schema: JsonSchema | undefined): string => {
  if (!schema) {
    return 'z.any()';
  }

  if (schema.oneOf && schema.oneOf.length > 0) {
    return `z.union([${schema.oneOf.map((value) => createZodSchema(value)).join(', ')}])`;
  }

  if (schema.anyOf && schema.anyOf.length > 0) {
    return `z.union([${schema.anyOf.map((value) => createZodSchema(value)).join(', ')}])`;
  }

  let baseSchema = 'z.any()';

  switch (schema.type) {
    case 'array':
      baseSchema = `z.array(${createZodSchema(schema.items)})`;
      break;
    case 'boolean':
      baseSchema = 'z.boolean()';
      break;
    case 'integer':
    case 'number':
      baseSchema = 'z.number()';
      break;
    case 'object': {
      const properties = Object.entries(schema.properties ?? {})
        .map(([propertyName, propertySchema]) => {
          const isRequired = schema.required?.includes(propertyName) ?? false;
          const propertyZod = createZodSchema(propertySchema);
          return `  ${JSON.stringify(propertyName)}: ${isRequired ? propertyZod : `${propertyZod}.optional()`},`;
        })
        .join('\n');
      const objectSchema = `z.object({\n${properties}\n})`;

      if (schema.additionalProperties === true) {
        baseSchema = `${objectSchema}.passthrough()`;
      } else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
        baseSchema = `${objectSchema}.catchall(${createZodSchema(schema.additionalProperties)})`;
      } else {
        baseSchema = objectSchema;
      }
      break;
    }
    case 'string':
      if (schema.enum && schema.enum.length > 0) {
        baseSchema = `z.enum([${schema.enum.map((value) => JSON.stringify(String(value))).join(', ')}])`;
      } else {
        baseSchema = 'z.string()';
      }
      break;
    default:
      if (schema.enum && schema.enum.length > 0) {
        baseSchema = `z.enum([${schema.enum.map((value) => JSON.stringify(String(value))).join(', ')}])`;
      }
  }

  if (schema.nullable) {
    return `${baseSchema}.nullable()`;
  }

  return baseSchema;
};

const createExampleValue = (schema: JsonSchema | undefined): unknown => {
  if (!schema) {
    return 'value';
  }

  if (schema.oneOf && schema.oneOf.length > 0) {
    return createExampleValue(schema.oneOf[0]);
  }

  if (schema.anyOf && schema.anyOf.length > 0) {
    return createExampleValue(schema.anyOf[0]);
  }

  switch (schema.type) {
    case 'array':
      return [createExampleValue(schema.items)];
    case 'boolean':
      return true;
    case 'integer':
    case 'number':
      return 1;
    case 'object':
      return Object.fromEntries(
        Object.entries(schema.properties ?? {}).map(([propertyName, propertySchema]) => [
          propertyName,
          createExampleValue(propertySchema),
        ]),
      );
    case 'string':
      return typeof schema.default === 'string'
        ? schema.default
        : Array.isArray(schema.enum) && schema.enum.length > 0
          ? schema.enum[0]
          : 'value';
    default:
      return 'value';
  }
};

const pathParams = (parameters: EndpointParameter[]): EndpointParameter[] =>
  parameters.filter((parameter) => parameter.in === 'path');

const queryParams = (parameters: EndpointParameter[]): EndpointParameter[] =>
  parameters.filter((parameter) => parameter.in === 'query');

const createEndpointInputSchema = (endpoint: EndpointSchema): string => {
  const fields = [
    ...pathParams(endpoint.parameters),
    ...queryParams(endpoint.parameters),
    ...(endpoint.requestBody
      ? [
          {
            description: 'Request body',
            in: 'query' as const,
            name: 'body',
            required: true,
            schema: endpoint.requestBody,
          },
        ]
      : []),
  ]
    .map((parameter) => {
      const zodSchema = createZodSchema(parameter.schema);
      return `  ${JSON.stringify(parameter.name)}: ${
        parameter.required ? zodSchema : `${zodSchema}.optional()`
      },`;
    })
    .join('\n');

  return `z.object({\n${fields}\n})`;
};

const renderEndpointToolSource = (endpoint: EndpointSchema): string => {
  const inputSchemaName = `${endpoint.toolName}InputSchema`;
  const responseSchemaName = `${endpoint.toolName}ResponseSchema`;
  const pathParamNames = stableJson(pathParams(endpoint.parameters).map((parameter) => parameter.name)).trim();
  const queryParamNames = stableJson(queryParams(endpoint.parameters).map((parameter) => parameter.name)).trim();
  const responseSchema = createZodSchema(endpoint.responseBody);

  return `import { z } from 'zod';

import { createErrorResult, createTextResult } from '../tool-utils.js';
import type { ToolDefinition, ToolHandler } from '../types.js';

export const ${inputSchemaName} = ${createEndpointInputSchema(endpoint)};
export const ${responseSchemaName} = ${responseSchema};

const PATH_PARAM_NAMES = ${pathParamNames} as const;
const QUERY_PARAM_NAMES = ${queryParamNames} as const;

const compilePath = (templatePath: string, input: Record<string, unknown>): string =>
  PATH_PARAM_NAMES.reduce(
    (resolvedPath, parameterName) =>
      resolvedPath.replace(\`{\${parameterName}}\`, encodeURIComponent(String(input[parameterName]))),
    templatePath,
  );

export const toolDefinition: ToolDefinition<typeof ${inputSchemaName}> = {
  description: ${JSON.stringify(endpoint.description || endpoint.summary)},
  inputSchema: ${inputSchemaName},
  name: ${JSON.stringify(endpoint.toolName)},
};

export const toolHandler: ToolHandler<typeof ${inputSchemaName}> = async (input, { client }) => {
  try {
    const query = Object.fromEntries(
      QUERY_PARAM_NAMES
        .filter((parameterName) => input[parameterName] !== undefined)
        .map((parameterName) => [parameterName, input[parameterName]]),
    );
    const response = await client.callApi(
      {
        data: 'body' in input ? input.body : undefined,
        method: ${JSON.stringify(endpoint.method.toUpperCase())},
        params: Object.keys(query).length > 0 ? query : undefined,
        url: compilePath(${JSON.stringify(endpoint.path)}, input as Record<string, unknown>),
      },
      ${responseSchemaName},
    );

    return createTextResult(
      ${JSON.stringify(`Executed ${endpoint.operationId}.`)},
      response as Record<string, unknown>,
    );
  } catch (error) {
    return createErrorResult(${JSON.stringify(`Failed to execute ${endpoint.operationId}`)}, error);
  }
};
`;
};

const renderEndpointToolTest = (endpoint: EndpointSchema): string => {
  const inputSchemaName = `${endpoint.toolName}InputSchema`;
  const validInput = Object.fromEntries([
    ...pathParams(endpoint.parameters).map((parameter) => [
      parameter.name,
      createExampleValue(parameter.schema),
    ]),
    ...queryParams(endpoint.parameters).map((parameter) => [
      parameter.name,
      createExampleValue(parameter.schema),
    ]),
    ...(endpoint.requestBody ? [['body', createExampleValue(endpoint.requestBody)]] : []),
  ]);

  return `import { describe, expect, it, vi } from 'vitest';

import { toolDefinition, toolHandler, ${inputSchemaName} } from '../src/tools/${endpoint.toolName}.js';

describe(${JSON.stringify(endpoint.toolName)}, () => {
  it('exposes a zod input schema and calls the Rocket.Chat client', async () => {
    const callApi = vi.fn().mockResolvedValue({ success: true });
    const result = await toolHandler(
      ${JSON.stringify(validInput, null, 2)},
      { client: { callApi } } as never,
    );

    expect(toolDefinition.name).toBe(${JSON.stringify(endpoint.toolName)});
    expect(${inputSchemaName}.safeParse(${JSON.stringify(validInput, null, 2)}).success).toBe(true);
    expect(callApi).toHaveBeenCalledOnce();
    expect(result.isError).toBeUndefined();
  });
});
`;
};

const renderConstantsFile = (generatedTools: GeneratedToolDescriptor[]): string => {
  const toolMetadata = generatedTools.reduce<Record<string, { description: string; fileName: string }>>(
    (accumulator, tool) => {
      accumulator[tool.name] = {
        description: tool.description,
        fileName: tool.fileName,
      };
      return accumulator;
    },
    {},
  );

  return `export const PACKAGE_NAME = 'generated-rc-mcp-server';
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

const renderToolRegistryFile = (generatedTools: GeneratedToolDescriptor[]): string => {
  const imports = generatedTools
    .map((tool) => `import * as ${tool.fileName} from './tools/${tool.fileName}.js';`)
    .join('\n');
  const registry = generatedTools.map((tool) => tool.fileName).join(',\n  ');

  return `import type { ToolModule } from './types.js';

${imports}

export const ALL_TOOL_MODULES: ToolModule[] = [
  ${registry}
];
`;
};

const renderPackageJson = (serverName: string): string =>
  stableJson({
    name: sanitizeName(serverName),
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
      '@modelcontextprotocol/sdk': '^1.27.1',
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

const renderEnvExample = (config: GeneratorConfig): string => `RC_SERVER_URL=${config.rcServerUrl ?? 'http://localhost:3000'}
RC_AUTH_TOKEN=${config.rcAuthToken ?? 'YOUR_TOKEN_HERE'}
RC_USER_ID=${config.rcUserId ?? 'YOUR_USERID_HERE'}
ENABLED_TOOLS=
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

const renderGeneratedExtensionManifest = (serverName: string): string =>
  stableJson({
    contextFileName: 'GEMINI.md',
    mcpServers: {
      [sanitizeName(serverName)]: {
        args: ['${extensionPath}${/}dist${/}index.js'],
        command: 'node',
        cwd: '${extensionPath}',
      },
    },
    name: sanitizeName(serverName),
    version: '1.0.0',
  });

const renderGeneratedGeminiContext = (
  serverName: string,
  generatedTools: GeneratedToolDescriptor[],
): string => `Use the ${serverName} MCP server for Rocket.Chat operations.

Available tools:
${generatedTools.map((tool) => `- ${tool.name}: ${tool.description}`).join('\n')}
`;

const renderReadme = (
  serverName: string,
  workflows: WorkflowDefinition[],
  endpoints: EndpointSchema[],
): string => {
  const workflowSection = workflows
    .map(
      (workflow) => `### \`${workflow.name}\`

${workflow.description}

\`\`\`json
${JSON.stringify(workflow.exampleArgs, null, 2)}
\`\`\`
`,
    )
    .join('\n');
  const endpointSection = endpoints
    .map(
      (endpoint) => `- \`${endpoint.toolName}\` → \`${endpoint.method.toUpperCase()} ${endpoint.path}\` (${endpoint.operationId})`,
    )
    .join('\n');

  return `# ${serverName}

This standalone Rocket.Chat MCP server was generated by rc-mcp-generator. It contains only the workflows and endpoint tools selected for your project, reducing context bloat for agentic coding workflows.

## Why this exists

Traditional MCP servers expose a large static catalog of tools on every prompt. This generated server keeps only the Rocket.Chat capabilities your project actually needs, which reduces token waste, lowers tool confusion, and makes agentic loops cheaper and more reliable.

## Quick start

\`\`\`bash
npm install
cp .env.example .env
npm run build
npm test
npm start
\`\`\`

## Environment

- \`RC_SERVER_URL\`
- \`RC_AUTH_TOKEN\`
- \`RC_USER_ID\`
- \`PORT\`
- \`ENABLED_TOOLS\`

## Included workflow tools

${workflowSection || 'No workflow tools selected.'}

## Included endpoint tools

${endpointSection || 'No direct endpoint tools selected.'}

## Gemini CLI

This project ships with \`gemini-extension.json\` and \`GEMINI.md\`, so it can be linked as a Gemini CLI extension after build:

\`\`\`bash
npm run build
gemini extensions link .
\`\`\`
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
  kind: 'test' | 'tool',
  workflow: WorkflowDefinition,
): Promise<string> => {
  const source = await fs.readFile(
    kind === 'tool' ? workflow.sourceToolFile : workflow.sourceTestFile,
    'utf8',
  );
  const templatePath = path.resolve(
    templatesRoot,
    kind === 'tool' ? 'tools' : 'tests',
    `${workflow.name}.${kind === 'tool' ? 'ts' : 'test.ts'}.hbs`,
  );

  return renderTemplate(templatePath, { source });
};

const createGeneratedToolDescriptors = (
  workflows: WorkflowDefinition[],
  endpoints: EndpointSchema[],
): GeneratedToolDescriptor[] => [
  ...workflows.map((workflow) => ({
    description: workflow.description,
    fileName: workflow.name,
    name: workflow.name,
    testFileName: `${workflow.name}.test.ts`,
    type: 'workflow' as const,
  })),
  ...endpoints.map((endpoint) => ({
    description: endpoint.description || endpoint.summary,
    fileName: endpoint.toolName,
    name: endpoint.toolName,
    testFileName: `${endpoint.toolName}.test.ts`,
    type: 'endpoint' as const,
  })),
];

const registerWithGemini = async (
  serverDir: string,
  serverName: string,
): Promise<void> => {
  const settingsPath = path.resolve(os.homedir(), '.gemini', 'settings.json');
  const settings = (await fs.pathExists(settingsPath))
    ? ((await fs.readJson(settingsPath)) as Record<string, unknown>)
    : {};
  const mcpServers = ((settings.mcpServers as Record<string, unknown> | undefined) ?? {});

  mcpServers[sanitizeName(serverName)] = {
    args: [path.resolve(serverDir, 'dist', 'index.js')],
    command: 'node',
  };

  await fs.ensureDir(path.dirname(settingsPath));
  await fs.writeJson(
    settingsPath,
    {
      ...settings,
      mcpServers,
    },
    { spaces: 2 },
  );
};

const installAndBuildGeneratedServer = async (serverDir: string): Promise<void> => {
  await execFileAsync('npm', ['install'], { cwd: serverDir });
  await execFileAsync('npm', ['run', 'build'], { cwd: serverDir });
};

export const generateProject = async (
  config: GeneratorConfig,
): Promise<GeneratedProject> => {
  const provider = config.provider ?? ROCKET_CHAT_PROVIDER;
  const schemaExtractor = new SchemaExtractor(provider);
  const selectedEndpoints =
    config.operationIds && config.operationIds.length > 0
      ? await schemaExtractor.getEndpointsByOperationId(config.operationIds)
      : [];
  const selectedWorkflows = resolveWorkflows(config.workflows ?? []);
  const outputDirectory = await ensureFreshOutputDirectory(config.outputDirectory);
  const generatedTools = createGeneratedToolDescriptors(selectedWorkflows, selectedEndpoints);
  const serverName = config.serverName ?? 'generated-rc-mcp-server';

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
    renderConstantsFile(generatedTools),
  );
  await fs.writeFile(
    path.resolve(outputDirectory, 'src', 'tool-registry.ts'),
    renderToolRegistryFile(generatedTools),
  );

  for (const workflow of selectedWorkflows) {
    await fs.writeFile(
      path.resolve(outputDirectory, 'src', 'tools', `${workflow.name}.ts`),
      await renderWorkflowTemplate('tool', workflow),
    );
    await fs.writeFile(
      path.resolve(outputDirectory, 'tests', `${workflow.name}.test.ts`),
      await renderWorkflowTemplate('test', workflow),
    );
  }

  for (const endpoint of selectedEndpoints) {
    await fs.writeFile(
      path.resolve(outputDirectory, 'src', 'tools', `${endpoint.toolName}.ts`),
      renderEndpointToolSource(endpoint),
    );
    await fs.writeFile(
      path.resolve(outputDirectory, 'tests', `${endpoint.toolName}.test.ts`),
      renderEndpointToolTest(endpoint),
    );
  }

  await fs.writeFile(path.resolve(outputDirectory, 'package.json'), renderPackageJson(serverName));
  await fs.writeFile(path.resolve(outputDirectory, 'tsconfig.json'), renderTsConfig());
  await fs.writeFile(path.resolve(outputDirectory, '.env.example'), renderEnvExample(config));
  await fs.writeFile(path.resolve(outputDirectory, '.env'), renderEnvExample(config));
  await fs.writeFile(path.resolve(outputDirectory, 'Dockerfile'), renderDockerfile());
  await fs.writeFile(
    path.resolve(outputDirectory, 'README.md'),
    renderReadme(serverName, selectedWorkflows, selectedEndpoints),
  );
  await fs.writeFile(path.resolve(outputDirectory, 'GEMINI.md'), renderGeneratedGeminiContext(serverName, generatedTools));
  await fs.writeFile(
    path.resolve(outputDirectory, 'gemini-extension.json'),
    renderGeneratedExtensionManifest(serverName),
  );
  await fs.writeFile(path.resolve(outputDirectory, 'eslint.config.js'), renderEslintConfig());
  await fs.writeFile(path.resolve(outputDirectory, '.gitignore'), renderGitignore());
  await fs.writeFile(path.resolve(outputDirectory, '.prettierrc.json'), renderPrettierConfig());

  if (config.installDependencies) {
    await installAndBuildGeneratedServer(outputDirectory);
  }

  if (config.registerWithGemini) {
    await registerWithGemini(outputDirectory, serverName);
  }

  const validation = await validateGeneratedServer(outputDirectory, {
    deep: Boolean(config.installDependencies),
  });
  const fullEndpointCatalog = await schemaExtractor.getEndpoints();
  const minimalityReport = analyzeMinimality(fullEndpointCatalog, selectedEndpoints);

  return {
    endpoints: selectedEndpoints,
    generatedTools,
    minimalityReport,
    outputDirectory,
    validation,
    workflows: selectedWorkflows,
  };
};

export const validateServer = validateGeneratedServer;
export const analyzeMinimalityForOperationIds = async (
  operationIds: string[],
  provider: ProviderConfig = ROCKET_CHAT_PROVIDER,
): Promise<MinimalityReport> => {
  const extractor = new SchemaExtractor(provider);
  const [allEndpoints, selectedEndpoints] = await Promise.all([
    extractor.getEndpoints(),
    extractor.getEndpointsByOperationId(operationIds),
  ]);

  return analyzeMinimality(allEndpoints, selectedEndpoints);
};
