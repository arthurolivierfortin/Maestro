# Phase 6A: Unified Block Source Architecture

**Phase**: 6A  
**Priority**: ⚠️ CRITICAL  
**Duration**: 1 week  
**Team**: Backend (2 developers)  
**Dependencies**: Phase 5A complete  
**Blocks**: Phase 6B, 6C, 6D  
**Status**: Not Started

---

## Overview

Establish the Backend as the **single authoritative source** for all block operations. Currently, blocks are read from filesystem by multiple independent components (Backend, Frontend mocks, CLI, MCP), causing data inconsistencies and blocking Docker deployment.

## Current Architecture (Problem)

```
┌──────────────────────────────────────────────────────────────────┐
│                    FILESYSTEM (blocks/)                          │
└──────┬────────────────────┬───────────────────┬────────────────┬─┘
       │                    │                   │                │
       ▼                    ▼                   ▼                ▼
┌──────────────┐   ┌────────────────┐   ┌───────────┐   ┌────────────┐
│   Backend    │   │ Frontend Mock  │   │    CLI    │   │    MCP     │
│ FileSystem   │   │ (hardcoded)    │   │ (fs read) │   │ (fs read)  │
│ Discovery    │   │                │   │           │   │            │
└──────────────┘   └────────────────┘   └───────────┘   └────────────┘
       ❌ Multiple independent readers — NO SINGLE SOURCE OF TRUTH
```

## Target Architecture (Solution)

```
┌──────────────────────────────────────────────────────────────────┐
│                    FILESYSTEM (blocks/)                          │
└─────────────────────────┬────────────────────────────────────────┘
                          │ READ/WRITE (exclusive)
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│                  BACKEND (Single Source of Truth)                │
│  FileSystemBlockDiscoveryService → BlocksController → REST API   │
└─────────────────────────┬────────────────────────────────────────┘
                          │ HTTP API
          ┌───────────────┼───────────────┬────────────────┐
          ▼               ▼               ▼                ▼
    ┌──────────┐   ┌──────────────┐   ┌─────────┐   ┌───────────┐
    │ Frontend │   │     CLI      │   │   MCP   │   │  Future   │
    └──────────┘   └──────────────┘   └─────────┘   └───────────┘
         ✅ ALL CLIENTS USE HTTP API — SINGLE SOURCE OF TRUTH
```

## Problem Analysis

### Current Issues Found

1. **Backend** (`FileSystemBlockDiscoveryService`):
   - Reads from: project `.maestro/blocks`, user `~/.maestro/blocks`, global `AppContext.BaseDirectory/blocks`
   - Status: Partially implemented, needs CRUD completion

2. **Frontend Mock** (`mockBlockService.ts`):
   - Uses hardcoded `MOCK_BLOCKS` array
   - Completely independent of filesystem
   - Real service (`realBlockService.ts`) expects API that's incomplete

3. **CLI** (`tools/maestro-cli/index.js`):
   - Line: `const blocksDir = path.join(__dirname, '../../blocks')`
   - Direct filesystem read, bypasses backend entirely

4. **MCP** (`tools/maestro-mcp/index.js`):
   - Same pattern: `path.join(__dirname, '../../blocks')`
   - Direct filesystem read, no backend dependency

### Impact

- ❌ Cannot run backend in Docker (CLI/MCP expect local filesystem)
- ❌ Frontend mocks never see real blocks
- ❌ Block changes in one client not visible to others
- ❌ Auto-training blocked (agents can't reliably create blocks)

## Tasks

### 6A.1 Audit Filesystem Reads

- [ ] Search codebase for all direct filesystem block reads
- [ ] Document each location with file path and line number
- [ ] Create migration plan for each reader
- [ ] Identify any legitimate local-only operations (e.g., config files)

**Search Commands:**
```bash
# Find filesystem reads in CLI/MCP
grep -rn "fs.readFile\|fs.readdir\|path.join.*blocks" tools/
grep -rn "readFileSync\|readdirSync" tools/
```

### 6A.2 Complete BlocksController CRUD

- [ ] Review existing `BlocksController.cs`
- [ ] Implement `GET /api/blocks` - List all blocks with filtering
  ```csharp
  [HttpGet]
  public async Task<ActionResult<List<BlockDto>>> GetBlocks(
      [FromQuery] string? type,
      [FromQuery] string? capability,
      [FromQuery] string? search)
  ```
- [ ] Implement `GET /api/blocks/{id}` - Get single block details
- [ ] Implement `POST /api/blocks` - Create new block (writes to filesystem)
- [ ] Implement `PUT /api/blocks/{id}` - Update block
- [ ] Implement `DELETE /api/blocks/{id}` - Delete block
- [ ] Implement `GET /api/blocks/search` - Advanced search
  ```csharp
  [HttpGet("search")]
  public async Task<ActionResult<List<BlockDto>>> SearchBlocks(
      [FromQuery] string q,
      [FromQuery] BlockType? type,
      [FromQuery] string? capability,
      [FromQuery] int limit = 50)
  ```

### 6A.3 Block Repository Implementation

- [ ] Complete `IBlockRepository` interface in Application layer
- [ ] Implement filesystem-based repository in Infrastructure
- [ ] Add block validation using JSON Schema before save
- [ ] Add atomic write operations (temp file → rename)
- [ ] Handle concurrent access (file locking)

### 6A.4 SignalR Block Events

- [ ] Create `BlockHub` SignalR hub
- [ ] Emit events on block changes:
  - `BlockAdded(blockId, blockType)`
  - `BlockUpdated(blockId, changes)`
  - `BlockDeleted(blockId)`
- [ ] Connect FileSystemWatcher to SignalR hub
- [ ] Add client subscription management

### 6A.5 JSON Schema Validation

- [ ] Ensure `docs/schemas/block.schema.json` is complete
- [ ] Add schema validation in `FileSystemBlockDiscoveryService`
- [ ] Validate on: load, create, update
- [ ] Return detailed validation errors

### 6A.6 Integration Tests

- [ ] Test CRUD operations on blocks
- [ ] Test block filtering and search
- [ ] Test SignalR event emission
- [ ] Test concurrent access handling
- [ ] Test schema validation errors

## API Specification

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/blocks` | List all blocks (with query filters) |
| GET | `/api/blocks/{id}` | Get block by ID |
| POST | `/api/blocks` | Create new block |
| PUT | `/api/blocks/{id}` | Update existing block |
| DELETE | `/api/blocks/{id}` | Delete block |
| GET | `/api/blocks/search` | Advanced search |
| GET | `/api/blocks/types` | List available block types |

### Response DTOs

```csharp
public record BlockDto
{
    public string Id { get; init; }
    public string Name { get; init; }
    public BlockType Type { get; init; }
    public string Description { get; init; }
    public string Version { get; init; }
    public List<string> Tags { get; init; }
    public List<string> Capabilities { get; init; }
    public JsonDocument Config { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime UpdatedAt { get; init; }
    public string SourcePath { get; init; } // Where on filesystem
}

public record CreateBlockRequest
{
    public string Name { get; init; }
    public BlockType Type { get; init; }
    public string Description { get; init; }
    public List<string> Tags { get; init; }
    public JsonDocument Config { get; init; }
    public string? TargetLocation { get; init; } // project/user/global
}
```

## Acceptance Criteria

1. [ ] All block CRUD operations work through API
2. [ ] Blocks are persisted to filesystem correctly
3. [ ] SignalR events fire on block changes
4. [ ] JSON Schema validation prevents invalid blocks
5. [ ] Integration tests pass with 90%+ coverage
6. [ ] No direct filesystem reads remain in Application layer

## Files to Modify/Create

### Create
- `backend/src/Maestro.Api/Hubs/BlockHub.cs`
- `backend/src/Maestro.Application/DTOs/CreateBlockRequest.cs`
- `backend/src/Maestro.Application/DTOs/UpdateBlockRequest.cs`
- `backend/tests/Maestro.Api.Tests/Controllers/BlocksControllerTests.cs`

### Modify
- `backend/src/Maestro.Api/Controllers/BlocksController.cs`
- `backend/src/Maestro.Infrastructure/BlockStore/FileSystemBlockDiscoveryService.cs`
- `backend/src/Maestro.Application/Interfaces/IBlockRepository.cs`

## Testing Strategy

1. **Unit Tests**: Repository methods, validation logic
2. **Integration Tests**: Full CRUD through controller
3. **E2E Tests**: API calls with real filesystem operations

## Notes

- Block IDs should be derived from folder name or block.json `id` field
- Consider supporting both `blocks/` (global) and `.maestro/blocks/` (project) paths
- FileSystemWatcher may have platform-specific behavior to handle

---

**Related Issues:**
- Phase 6B: [Discovery API](phase-6b-discovery-api.md)
- Phase 6C: [CLI/MCP Migration](phase-6c-cli-mcp-api-clients.md)
- Phase 5A: [Filesystem Block Architecture](phase-5a-filesystem-block-architecture.md)
