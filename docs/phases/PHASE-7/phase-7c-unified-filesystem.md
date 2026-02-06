# Phase 7C: Unified Filesystem - Backend as Single Source of Truth

**Phase**: 7C
**Priority**: High
**Duration**: 2-3 days
**Team**: Backend + Tools
**Dependencies**: Phase 7B complete
**Blocks**: Phase 7D, 7E
**Status**: Not Started

---

## Overview

Establish the backend as the **single source of truth** for all filesystem operations. CLI and MCP Server must use the backend API instead of direct filesystem access. This ensures consistency, enables caching, and prepares for container isolation.

## Current Problem

Currently, three clients access blocks differently:
1. **Frontend**: Uses HTTP API → Backend → Filesystem ✅
2. **CLI**: Uses HTTP API → Backend → Filesystem ✅ (partially)
3. **MCP Server**: **Direct filesystem access** ❌

This creates inconsistencies:
- MCP might read stale data if backend cache is updated
- No centralized logging of file operations
- Container isolation cannot intercept MCP operations

---

## Architecture After Phase 7C

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Frontend   │     │    CLI      │     │ MCP Server  │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │ HTTP              │ HTTP              │ HTTP
       ▼                   ▼                   ▼
┌──────────────────────────────────────────────────────┐
│                   Backend API                         │
│  /api/blocks, /api/projects, /api/workflows          │
└──────────────────────────────────────────────────────┘
                           │
                           ▼
                ┌──────────────────────┐
                │  Filesystem / Docker │
                └──────────────────────┘
```

---

## Tasks

### 7C.1 Audit Current CLI Implementation
- [ ] Review `tools/maestro-cli/index.js` for filesystem access
- [ ] Review `tools/shared/api-client.js` for API coverage
- [ ] Document all CLI commands and their current implementation
- [ ] Identify any direct filesystem operations to migrate

### 7C.2 Audit MCP Server Implementation
- [ ] Review `tools/Maestro.McpServer/` for direct filesystem access
- [ ] Review `tools/maestro-mcp/` for any direct file operations
- [ ] List all MCP tools and their data sources
- [ ] Identify migration requirements

### 7C.3 Extend Backend API for CLI/MCP Needs
- [ ] Add any missing endpoints required by CLI
- [ ] Add any missing endpoints required by MCP
- [ ] Ensure all block operations are covered:
  - Create block
  - Read block
  - Update block
  - Delete block
  - List blocks (with filtering)
  - Execute block
- [ ] Ensure all workflow operations are covered
- [ ] Add project context support to all endpoints

### 7C.4 Update CLI to Use API Only
- [ ] Ensure `maestro-cli` uses only `api-client.js`
- [ ] Remove any direct filesystem access
- [ ] Update commands to pass `projectId` when available
- [ ] Add `--project` flag to relevant commands
- [ ] Update CLI documentation

### 7C.5 Update MCP Server to Use API Only
- [ ] Create HTTP client for MCP Server (C# or shared)
- [ ] Replace filesystem reads with API calls
- [ ] Replace filesystem writes with API calls
- [ ] Handle authentication if needed (API keys, tokens)
- [ ] Add project context to MCP tool schemas

### 7C.6 Add Project Context to Shared Client
- [ ] Update `tools/shared/api-client.js` to support `projectId`
- [ ] Create project management functions:
  - `listProjects()`
  - `getProject(id)`
  - `setCurrentProject(id)` (for session)
  - `getBlocks(projectId)`
- [ ] Add proper error handling for project not found

### 7C.7 Add Caching Layer in Backend
- [ ] Implement in-memory cache for block definitions
- [ ] Implement cache invalidation on file changes
- [ ] Add cache headers to API responses
- [ ] Consider Redis for multi-instance scenarios

### 7C.8 Update Integration Tests
- [ ] Update `tests/maestro-cli.integration.test.js`
- [ ] Update `tests/maestro-mcp.integration.test.js`
- [ ] Add tests for project-scoped operations
- [ ] Ensure no tests use direct filesystem

---

## Acceptance Criteria

1. [ ] CLI makes zero direct filesystem calls for block/project operations
2. [ ] MCP Server makes zero direct filesystem calls for block/project operations
3. [ ] All three clients (Frontend, CLI, MCP) use identical API endpoints
4. [ ] Project context flows through all clients
5. [ ] Backend is single source of truth for block discovery
6. [ ] Integration tests pass for all clients
7. [ ] No data inconsistencies between clients

---

## Files to Modify

### CLI
- `tools/maestro-cli/index.js`
- `tools/shared/api-client.js`

### MCP Server
- `tools/Maestro.McpServer/` (various files)
- `tools/maestro-mcp/` (if applicable)

### Backend
- `backend/src/Maestro.Api/Controllers/BlocksController.cs` (add missing endpoints)
- `backend/src/Maestro.Api/Controllers/ProjectsController.cs`

### Tests
- `tests/maestro-cli.integration.test.js`
- `tests/maestro-mcp.integration.test.js`

---

## API Extensions Required

### For CLI

```bash
# Block operations with project context
GET /api/projects/{projectId}/blocks
POST /api/projects/{projectId}/blocks
GET /api/projects/{projectId}/blocks/{blockId}
PUT /api/projects/{projectId}/blocks/{blockId}
DELETE /api/projects/{projectId}/blocks/{blockId}

# Execution with project context
POST /api/projects/{projectId}/execute/{blockId}
```

### For MCP Server

```bash
# MCP tool discovery
GET /api/mcp/tools
GET /api/mcp/tools/{toolId}

# MCP execution (same as blocks but returns MCP-formatted response)
POST /api/mcp/execute
```

---

## Migration Strategy

### Phase 1: Add API Endpoints
1. Add new project-scoped endpoints
2. Keep existing endpoints working (backward compatible)
3. Add deprecation warnings to non-project endpoints

### Phase 2: Update Clients
1. Update CLI to use project endpoints when project is specified
2. Update MCP to use API instead of filesystem
3. Run integration tests

### Phase 3: Deprecation
1. Log usage of deprecated endpoints
2. Plan removal in future version
3. Update documentation

---

## Technical Notes

### MCP Server Considerations
The MCP Server uses stdio for communication. It needs:
1. Backend URL from environment or config
2. HTTP client for API calls
3. Error handling for network failures
4. Fallback behavior if backend is unreachable

### API Authentication (Future)
For now, APIs are unauthenticated. Future phases may add:
- API key for CLI/MCP
- JWT for frontend
- Scoped permissions per project

---

## Related Issues

- Phase 7B: Project Model (provides project context)
- Phase 7D: Container Runtime (uses unified API)
- Phase 6C: CLI/MCP API Clients (related work)
