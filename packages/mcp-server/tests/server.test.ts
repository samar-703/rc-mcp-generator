import { describe, expect, it } from 'vitest';

import { ALL_TOOL_NAMES } from '../src/constants.js';
import { getEnabledToolModules, resolveEnabledToolNames } from '../src/server.js';

describe('server tool filtering', () => {
  it('loads every tool by default', () => {
    expect(resolveEnabledToolNames()).toEqual(ALL_TOOL_NAMES);
    expect(getEnabledToolModules().map((module) => module.toolDefinition.name)).toEqual(
      ALL_TOOL_NAMES,
    );
  });

  it('filters tools from ENABLED_TOOLS', () => {
    expect(resolveEnabledToolNames('send_channel_message,post_standup')).toEqual([
      'send_channel_message',
      'post_standup',
    ]);
    expect(
      getEnabledToolModules('send_channel_message,post_standup').map(
        (module) => module.toolDefinition.name,
      ),
    ).toEqual(['send_channel_message', 'post_standup']);
  });

  it('throws for unknown tools', () => {
    expect(() => resolveEnabledToolNames('missing_tool')).toThrow(/Unknown tool names/);
  });
});
