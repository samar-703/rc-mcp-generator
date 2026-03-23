import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { URL } from 'node:url';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

import {
  ALL_TOOL_NAMES,
  DEFAULT_PORT,
  ENV_KEYS,
  HTTP_ROUTES,
  SERVER_NAME,
  SERVER_VERSION,
  type ToolName,
} from './constants.js';
import { ConfigurationError } from './errors.js';
import { RocketChatClient } from './rc-client.js';
import { ALL_TOOL_MODULES } from './tool-registry.js';
import type { ToolModule } from './types.js';

loadEnv();

const environmentSchema = z.object({
  [ENV_KEYS.authToken]: z.string().min(1),
  [ENV_KEYS.serverUrl]: z.string().url(),
  [ENV_KEYS.userId]: z.string().min(1),
});

interface SessionRuntime {
  mcpServer: McpServer;
  transport: StreamableHTTPServerTransport;
}

const toJsonRpcError = (message: string) => ({
  error: {
    code: -32603,
    message,
  },
  id: null,
  jsonrpc: '2.0',
});

const sendJson = (res: ServerResponse, statusCode: number, payload: unknown): void => {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
};

const readJsonBody = async (req: IncomingMessage): Promise<unknown> => {
  try {
    const chunks: Buffer[] = [];

    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    if (chunks.length === 0) {
      return undefined;
    }

    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (error) {
    throw new ConfigurationError(
      error instanceof Error ? `Invalid JSON body: ${error.message}` : 'Invalid JSON body.',
    );
  }
};

export const resolveEnabledToolNames = (enabledToolsValue?: string): ToolName[] => {
  if (!enabledToolsValue || enabledToolsValue.trim().length === 0) {
    return ALL_TOOL_NAMES;
  }

  const requestedNames = enabledToolsValue
    .split(',')
    .map((value) => value.trim())
    .filter((value): value is ToolName => value.length > 0) as ToolName[];
  const unknownNames = requestedNames.filter((value) => !ALL_TOOL_NAMES.includes(value));

  if (unknownNames.length > 0) {
    throw new ConfigurationError(
      `Unknown tool names in ${ENV_KEYS.enabledTools}: ${unknownNames.join(', ')}`,
    );
  }

  return requestedNames;
};

export const getEnabledToolModules = (enabledToolsValue?: string): ToolModule[] => {
  const enabledNames = new Set(resolveEnabledToolNames(enabledToolsValue));

  return ALL_TOOL_MODULES.filter((module) => enabledNames.has(module.toolDefinition.name));
};

export const createRocketChatClientFromEnv = (
  environment: NodeJS.ProcessEnv = process.env,
): RocketChatClient => {
  const parsedEnvironment = environmentSchema.safeParse(environment);

  if (!parsedEnvironment.success) {
    throw new ConfigurationError(
      `Missing Rocket.Chat environment variables: ${parsedEnvironment.error.issues
        .map((issue) => issue.path.join('.'))
        .join(', ')}`,
    );
  }

  return new RocketChatClient(
    parsedEnvironment.data[ENV_KEYS.serverUrl],
    parsedEnvironment.data[ENV_KEYS.authToken],
    parsedEnvironment.data[ENV_KEYS.userId],
  );
};

export const createConfiguredServer = (
  client: RocketChatClient,
  enabledToolsValue = process.env[ENV_KEYS.enabledTools],
): McpServer => {
  const server = new McpServer(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION,
    },
    {
      capabilities: {
        logging: {},
      },
    },
  );

  for (const module of getEnabledToolModules(enabledToolsValue)) {
    server.registerTool(
      module.toolDefinition.name,
      {
        description: module.toolDefinition.description,
        inputSchema: module.toolDefinition.inputSchema,
      },
      async (arguments_) => module.toolHandler(arguments_, { client }),
    );
  }

  return server;
};

const createSessionRuntime = async (
  client: RocketChatClient,
  sessions: Map<string, SessionRuntime>,
  enabledToolsValue?: string,
): Promise<SessionRuntime> => {
  const runtime = {
    mcpServer: createConfiguredServer(client, enabledToolsValue),
    transport: new StreamableHTTPServerTransport({
      onsessionclosed: async (sessionId) => {
        const activeRuntime = sessions.get(sessionId);

        if (!activeRuntime) {
          return;
        }

        sessions.delete(sessionId);
        await activeRuntime.transport.close();
        await activeRuntime.mcpServer.close();
      },
      onsessioninitialized: (sessionId) => {
        sessions.set(sessionId, runtime);
      },
      sessionIdGenerator: () => randomUUID(),
    }),
  } satisfies SessionRuntime;

  await runtime.mcpServer.connect(runtime.transport);

  return runtime;
};

const getExistingSessionRuntime = (
  req: IncomingMessage,
  sessions: Map<string, SessionRuntime>,
): SessionRuntime | undefined => {
  const headerValue = req.headers['mcp-session-id'];
  const sessionId = Array.isArray(headerValue) ? headerValue[0] : headerValue;

  if (!sessionId) {
    return undefined;
  }

  return sessions.get(sessionId);
};

export const startServer = async (
  port = Number.parseInt(process.env[ENV_KEYS.port] ?? `${DEFAULT_PORT}`, 10) || DEFAULT_PORT,
): Promise<Server> => {
  const client = createRocketChatClientFromEnv();
  const sessions = new Map<string, SessionRuntime>();
  const server = createServer(async (req, res) => {
    try {
      if (!req.url) {
        sendJson(res, 400, toJsonRpcError('Missing request URL.'));
        return;
      }

      const requestUrl = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);

      if (requestUrl.pathname === HTTP_ROUTES.health) {
        sendJson(res, 200, { ok: true, service: SERVER_NAME });
        return;
      }

      if (requestUrl.pathname !== HTTP_ROUTES.mcp) {
        sendJson(res, 404, { error: 'Not found' });
        return;
      }

      if (req.method === 'POST') {
        const body = await readJsonBody(req);
        const existingRuntime = getExistingSessionRuntime(req, sessions);

        if (existingRuntime) {
          await existingRuntime.transport.handleRequest(req, res, body);
          return;
        }

        if (!isInitializeRequest(body)) {
          sendJson(res, 400, toJsonRpcError('Initialization request required.'));
          return;
        }

        const runtime = await createSessionRuntime(
          client,
          sessions,
          process.env[ENV_KEYS.enabledTools],
        );

        await runtime.transport.handleRequest(req, res, body);
        return;
      }

      if (req.method === 'GET' || req.method === 'DELETE') {
        const existingRuntime = getExistingSessionRuntime(req, sessions);

        if (!existingRuntime) {
          sendJson(res, 404, toJsonRpcError('Unknown MCP session.'));
          return;
        }

        await existingRuntime.transport.handleRequest(req, res);
        return;
      }

      res.setHeader('Allow', 'GET, POST, DELETE');
      sendJson(res, 405, toJsonRpcError('Method not allowed.'));
    } catch (error) {
      sendJson(
        res,
        error instanceof ConfigurationError ? 400 : 500,
        toJsonRpcError(error instanceof Error ? error.message : 'Internal server error'),
      );
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, () => resolve());
  });

  const shutdown = async (): Promise<void> => {
    for (const runtime of sessions.values()) {
      await runtime.transport.close();
      await runtime.mcpServer.close();
    }

    sessions.clear();
    server.close();
  };

  process.once('SIGINT', () => {
    void shutdown();
  });
  process.once('SIGTERM', () => {
    void shutdown();
  });

  return server;
};

