# rc-mcp-generator

`rc-mcp-generator` exists to solve context bloat for Rocket.Chat MCP deployments. Instead of shipping one oversized server with every Rocket.Chat action enabled, this repo gives you a generator that produces a minimal MCP server containing only the workflows you choose.

It ships as a pnpm monorepo with:

- `packages/mcp-server`: the production template server
- `packages/generator`: the CLI and gemini-cli extension that emits standalone deployable servers

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new)

## Quick start

```bash
pnpm install
pnpm build
pnpm test
pnpm --filter @rc-mcp-generator/generator dev
pnpm --filter @rc-mcp-generator/mcp-server start
```

## Generator CLI

Run the interactive generator:

```bash
pnpm --filter @rc-mcp-generator/generator dev -- --output ./generated/rc-chat-mcp
```

The CLI asks for:

1. `RC_SERVER_URL`
2. `RC_AUTH_TOKEN`
3. `RC_USER_ID`
4. The subset of Rocket.Chat workflows to include

It then generates a standalone folder with:

- only the selected tool files
- `rc-client.ts`, `server.ts`, `index.ts`, and shared helpers
- a `.env.example`
- a production Dockerfile
- a standalone `package.json`, `tsconfig.json`, ESLint config, and Prettier config
- Vitest/MSW tests for the selected tools
- a README with ready-to-use curl examples

## Claude Desktop

Example `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "rocket-chat": {
      "command": "node",
      "args": ["/absolute/path/to/generated-rc-mcp-server/dist/index.js"],
      "env": {
        "RC_SERVER_URL": "https://chat.example.com",
        "RC_AUTH_TOKEN": "your-auth-token",
        "RC_USER_ID": "your-user-id",
        "ENABLED_TOOLS": "send_channel_message,post_standup"
      }
    }
  }
}
```

## Cursor

Example `.cursorrules` / MCP config snippet:

```json
{
  "mcp": {
    "servers": {
      "rocket-chat": {
        "command": "node",
        "args": ["/absolute/path/to/generated-rc-mcp-server/dist/index.js"],
        "env": {
          "RC_SERVER_URL": "https://chat.example.com",
          "RC_AUTH_TOKEN": "your-auth-token",
          "RC_USER_ID": "your-user-id",
          "ENABLED_TOOLS": "send_channel_message,search_messages,export_channel_summary"
        }
      }
    }
  }
}
```

## Workflows

### `send_channel_message`

Purpose: Send a message to a channel by name.

Example input:

```json
{
  "channelName": "engineering",
  "text": "Deploy is complete."
}
```

Example output:

```text
Sent message to #engineering.
```

### `create_project_room`

Purpose: Create a channel, set its topic, and invite users by username.

Example input:

```json
{
  "channelName": "project-atlas",
  "invitees": ["alice", "bob"],
  "topic": "Atlas delivery"
}
```

Example output:

```text
Created project room project-atlas.
```

### `onboard_user`

Purpose: Create a user, add them to default channels, and send a welcome DM.

Example input:

```json
{
  "defaultChannels": ["general", "eng"],
  "email": "new.user@example.com",
  "name": "New User",
  "password": "Password123",
  "username": "new.user",
  "welcomeMessage": "Welcome aboard."
}
```

Example output:

```text
Onboarded new.user and added them to 2 channels.
```

### `search_messages`

Purpose: Search messages across accessible rooms or inside one selected channel.

Example input:

```json
{
  "channelName": "general",
  "limit": 10,
  "query": "deploy"
}
```

Example output:

```text
Found 3 matching messages for "deploy".
```

### `archive_project_channel`

Purpose: Send a final notice to a room and archive it.

Example input:

```json
{
  "channelName": "project-atlas",
  "notice": "This room is being archived.",
  "notifyMembers": true
}
```

Example output:

```text
Archived project-atlas.
```

### `get_user_mentions`

Purpose: Return unread mentions for a specific user.

Example input:

```json
{
  "limit": 20,
  "username": "alice"
}
```

Example output:

```text
Found 2 unread mentions for alice.
```

### `post_standup`

Purpose: Post a formatted standup entry.

Example input:

```json
{
  "blockers": ["Waiting on review"],
  "channelName": "team-sync",
  "today": ["Finish API tests"],
  "username": "alice",
  "yesterday": ["Built the generator"]
}
```

Example output:

```text
Posted standup update to #team-sync.
```

### `create_support_ticket`

Purpose: Create a private support room named `ticket-{id}` and add the support team.

Example input:

```json
{
  "requesterUsername": "requester",
  "summary": "Customer cannot access billing.",
  "supportUsernames": ["support.one", "support.two"],
  "ticketId": "INC-42"
}
```

Example output:

```text
Created private support ticket room ticket-inc-42.
```

### `broadcast_announcement`

Purpose: Send the same announcement to multiple channels.

Example input:

```json
{
  "channelNames": ["engineering", "product"],
  "message": "Deployment at 17:00 UTC."
}
```

Example output:

```text
Broadcast announcement to 2 channels.
```

### `export_channel_summary`

Purpose: Fetch the last N channel messages and return a readable summary.

Example input:

```json
{
  "channelName": "general",
  "limit": 15
}
```

Example output:

```text
Recent summary for general.
```

## gemini-cli extension

The generator package also includes a gemini-cli extension:

- Manifest: `packages/generator/src/gemini-extension/extension.json`
- Entry point: `packages/generator/src/gemini-extension/index.ts`
- Slash command: `/generate-rc-mcp`

The slash command launches the same interactive workflow as the standalone CLI.
