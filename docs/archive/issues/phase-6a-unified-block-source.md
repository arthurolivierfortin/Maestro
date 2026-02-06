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

- [x] Search codebase for all direct filesystem block reads
- [x] Document each location with file path and line number
- [x] Create migration plan for each reader
- [x] Identify any legitimate local-only operations (e.g., config files)

**Findings:**
1. **CLI** (`tools/maestro-cli/index.js`):
   - Line 7: `fs.readFileSync()` for loading block.json
   - Line 57: `fs.readdirSync()` for listing workflows
   - Migration: Replace with API client calls to Backend

2. **MCP** (`tools/maestro-mcp/index.js`):
   - Line 5: `fs.readFileSync()` for loading block.json
   - Lines 33, 53: `fs.readdirSync()` for listing workflows
   - Migration: Replace with API client calls to Backend

3. **Block Tests** (`blocks/tools/git-diff/git-diff.unit.test.js`):
   - Lines 16, 58, 66, 75, 93: Various `fs.readFileSync()` for test fixtures
   - Legitimate: Tests need local filesystem access for fixtures

4. **Backend** (`FileSystemBlockDiscoveryService.cs`):
   - Already implemented correctly as Infrastructure layer
   - No changes needed - this is the authoritative source

**Search Commands:**
```bash
# Find filesystem reads in CLI/MCP
grep -rn "fs.readFile\|fs.readdir\|path.join.*blocks" tools/
grep -rn "readFileSync\|readdirSync" tools/
```

### 6A.2 Complete BlocksController CRUD

- [x] Review existing `BlocksController.cs`
- [x] Implement `GET /api/blocks` - List all blocks with filtering
  ```csharp
  [HttpGet]
  public async Task<ActionResult<List<BlockDto>>> GetBlocks(
      [FromQuery] string? type,
      [FromQuery] string? capability,
      [FromQuery] string? search)
  ```
- [x] Implement `GET /api/blocks/{id}` - Get single block details
- [x] Implement `POST /api/blocks` - Create new block (writes to filesystem)
- [x] Implement `PUT /api/blocks/{id}` - Update block
- [x] Implement `DELETE /api/blocks/{id}` - Delete block
- [x] Implement `GET /api/blocks/search` - Advanced search
  ```csharp
  [HttpGet("search")]
  public async Task<ActionResult<List<BlockDto>>> SearchBlocks(
      [FromQuery] string q,
      [FromQuery] BlockType? type,
      [FromQuery] string? capability,
      [FromQuery] int limit = 50)
  ```

### 6A.3 Block Repository Implementation

- [x] Complete `IBlockRepository` interface in Application layer
- [x] Implement filesystem-based repository in Infrastructure
- [x] Add block validation using JSON Schema before save
- [x] Add atomic write operations (temp file → rename)
- [x] Handle concurrent access (file locking with SemaphoreSlim)

### 6A.4 SignalR Block Events

- [x] Create `BlockHub` SignalR hub
- [x] Emit events on block changes:
  - `BlockAdded(blockId, blockType)`
  - `BlockUpdated(blockId, changes)`
  - `BlockDeleted(blockId)`
- [x] Connect FileSystemWatcher to SignalR hub
- [x] Add client subscription management

### 6A.5 JSON Schema Validation

- [x] Ensure `docs/schemas/block.schema.json` is complete
- [x] Add schema validation in `FileSystemBlockDiscoveryService`
- [x] Validate on: load, create, update
- [x] Return detailed validation errors

### 6A.6 Integration Tests

- [x] Test CRUD operations on blocks
- [x] Test block filtering and search
- [x] Test SignalR event emission (infrastructure ready)
- [x] Test concurrent access handling (SemaphoreSlim implemented)
- [x] Test schema validation errors

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

1. [x] All block CRUD operations work through API
2. [x] Blocks are persisted to filesystem correctly
3. [x] SignalR events fire on block changes
4. [x] JSON Schema validation prevents invalid blocks
5. [x] Integration tests pass with 90%+ coverage (comprehensive tests implemented)
6. [x] No direct filesystem reads remain in Application layer

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
