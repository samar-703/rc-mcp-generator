# rc-mcp-generator

`rc-mcp-generator` is a Gemini CLI extension and deterministic code-generation engine for building minimal Rocket.Chat MCP servers.

The generated server is a standalone Node.js project that contains only the workflow tools and OpenAPI operation tools you select. The extension itself exposes discovery, generation, validation, and minimality-analysis tools so the selection process happens inside Gemini CLI without dumping Rocket.Chat's full API surface into every prompt.

This is the MVP form of the Rocket.Chat GSoC idea:

- official Gemini CLI extension structure at the repo root
- deterministic generation of standalone MCP servers
- support for arbitrary OpenAPI operation subsets and curated platform workflows
- tests emitted with the generated output
- validation and minimality checks inside the generator product

## Architecture

The repo now has two distinct layers:

- `packages/generator`: the actual product
  - Gemini CLI extension MCP server over stdio
  - OpenAPI extraction
  - endpoint search and suggestion
  - workflow registry
  - deterministic server scaffolding
  - validation and minimality analysis
- `packages/mcp-server`: reusable generated-server foundation
  - Rocket.Chat client
  - Streamable HTTP MCP server
  - high-level Rocket.Chat workflow tools used as generation templates

## Gemini CLI extension

The root extension manifest is [gemini-extension.json](/home/samar/Projects/rc-mcp-generator/gemini-extension.json). After building, Gemini CLI can load the extension MCP server from:

- [packages/generator/dist/extension-server.js](/home/samar/Projects/rc-mcp-generator/packages/generator/dist/extension-server.js)

Available generator tools:

- `rc_list_workflows`
- `rc_search_endpoints`
- `rc_discover_endpoints` with optional tag expansion
- `rc_suggest_endpoints`
- `rc_generate_server`
- `rc_validate_server` with optional deep TypeScript check
- `rc_analyze_minimality`

## Quick start

```bash
pnpm install
pnpm build
gemini extensions link .
gemini
```

Inside Gemini, the intended flow is:

1. Use `rc_suggest_endpoints` or `rc_search_endpoints`
2. Use `rc_discover_endpoints` to browse domains/tags and expand specific tags
3. Use `rc_list_workflows` if you want platform-level Rocket.Chat operations
4. Run `rc_generate_server`
5. Validate with `rc_validate_server`
6. Check reduction with `rc_analyze_minimality`

## Direct CLI

You can also use the generator without Gemini:

```bash
pnpm dev:cli -- list-workflows
pnpm dev:cli -- search "send messages and search chat"
pnpm dev:cli -- discover --domains chat,users --expand messaging
pnpm dev:cli -- suggest "create a support bot that posts announcements and exports history"
pnpm dev:cli -- generate -o ./generated/my-server -w send_channel_message,post_standup -p searchMessages
pnpm dev:cli -- validate ./generated/my-server --deep
pnpm dev:cli -- analyze -p postMessage,searchMessages
```

## Generated server output

`rc_generate_server` produces a standalone project with:

- `src/server.ts`
- `src/rc-client.ts`
- `src/tools/*.ts`
- `tests/*.test.ts`
- `.env` and `.env.example`
- `README.md`
- `GEMINI.md`
- `gemini-extension.json`
- `Dockerfile`

The generated server is deployable independently and uses env-based pre-authentication:

- `RC_SERVER_URL`
- `RC_AUTH_TOKEN`
- `RC_USER_ID`
- `PORT`
- `ENABLED_TOOLS`

## Current Rocket.Chat workflows

The workflow registry currently includes 10 platform-level operations:

- `send_channel_message`
- `create_project_room`
- `onboard_user`
- `search_messages`
- `archive_project_channel`
- `get_user_mentions`
- `post_standup`
- `create_support_ticket`
- `broadcast_announcement`
- `export_channel_summary`

## Validation

Workspace validation currently passes:

- `pnpm typecheck`
- `pnpm build`
- `pnpm test`

The generated server path has also been validated previously against a live local Rocket.Chat instance, and the MCP server output is usable from MCP Inspector. The generator-side validator now checks:

- required project structure
- MCP/Zod dependencies
- one test file per generated tool
- presence of a Zod object input schema in each generated tool
- optional `npx tsc --noEmit` deep validation
