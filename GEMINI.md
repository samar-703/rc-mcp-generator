Use the `rc-mcp-generator` extension tools to discover Rocket.Chat APIs, list high-level workflows, generate standalone minimal MCP servers, validate generated servers, and analyze context reduction.

Preferred flow:
1. Use `rc_suggest_endpoints` or `rc_search_endpoints` to identify candidate operationIds.
2. Use `rc_list_workflows` when the user wants platform-level operations instead of raw API tools.
3. Use `rc_generate_server` to scaffold the standalone server.
4. Use `rc_validate_server` and `rc_analyze_minimality` to confirm correctness and reduction.
