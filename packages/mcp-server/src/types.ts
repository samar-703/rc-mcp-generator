import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { z } from 'zod';

import type { ToolName } from './constants.js';
import type { RocketChatClient } from './rc-client.js';

export interface ToolContext {
  client: RocketChatClient;
}

export interface ToolDefinition<TSchema extends z.ZodTypeAny = z.ZodTypeAny> {
  description: string;
  inputSchema: TSchema;
  name: ToolName;
}

export type ToolHandler<TSchema extends z.ZodTypeAny = z.ZodTypeAny> = (
  input: z.infer<TSchema>,
  context: ToolContext,
) => Promise<CallToolResult>;

export interface ToolModule<TSchema extends z.ZodTypeAny = z.ZodTypeAny> {
  toolDefinition: ToolDefinition<TSchema>;
  toolHandler: ToolHandler<TSchema>;
}

