# MCP Server Setup (Maestro)

This document describes how to run Maestro as an MCP server for VS Code integration.

Basic example `.vscode/mcp.json`:

```json
{
  "servers": {
    "maestro": {
      "command": "maestro",
      "args": ["mcp-server"],
      "env": {
        "MAESTRO_ROOT": "${workspaceFolder}/.maestro"
      }
    }
  }
}
```

The MCP server should implement the `execute-workflow`, `list-workflows`, and `get-workflow` tools and expose a `workflows://` resource scheme.

See `tools/Maestro.McpServer/README.md` for scaffolding notes.

## Project-level blocks (.maestro)

- Place project-specific blocks under `.maestro/blocks/` and workflows under `.maestro/workflows/`.
- Project blocks override global blocks by path precedence: project first, then repo/global.
