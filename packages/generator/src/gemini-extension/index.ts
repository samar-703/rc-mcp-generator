import { runInteractiveGenerator } from '../cli.js';

export interface GeminiSlashCommandContext {
  registerSlashCommand(command: {
    description: string;
    execute: () => Promise<void>;
    name: string;
  }): void;
}

export const activate = (context: GeminiSlashCommandContext): void => {
  context.registerSlashCommand({
    description: 'Generate a minimal Rocket.Chat MCP server.',
    execute: async () => {
      await runInteractiveGenerator();
    },
    name: 'generate-rc-mcp',
  });
};

