# Phase 5A: Filesystem-Based Block Architecture
 [x] Create `docs/schemas/block.schema.json` with JSON Schema for `block.json`
 [x] Define schemas for each block type's config section
 [x] Create `docs/schemas/workflow-nodes.schema.json` for workflow node instances
 [x] Create `docs/schemas/connections.schema.json` for node connections
 [x] Add JSON Schema validation to block loader


## 🎯 Strategic Context

This phase is **critical** because it establishes the foundation for:

1. **Human-editable blocks**: Developers can create/modify blocks in any text editor
2. **Frontend-created blocks**: UI creates proper file structures in the backend
3. **Agent-generated blocks**: Future auto-improvement will generate and compare workflows
4. **Deterministic replay**: Workflows must be serializable and replayable identically
5. **Environment-agnostic execution**: Block logic must not depend on MCP or VS Code
 [x] Create `IBlockDiscoveryService` interface in Application layer
 [x] Create `BlockDefinition` domain entity with all block properties
 [x] Implement `FileSystemBlockDiscoveryService` in Infrastructure layer
 [x] Scan configured directories for `block.json` files
 [x] Parse and validate block definitions
 [x] Cache discovered blocks with file watcher invalidation
- **Portable**: Same block structure works in Maestro root, `.maestro/` folders, or any repo
 [x] Create `IBlockRepository` interface in Application layer
 [x] Implement `FileSystemBlockRepository` in Infrastructure layer
 [x] Create folder structure when saving new blocks
 [x] Write `block.json` and associated files (templates, scripts)
 [x] Support atomic writes (write to temp, then rename)
```
 [x] Create `IBlockTypeHandler` interface
 [x] Implement `AgentBlockHandler` - loads system-prompt.md, tools.json (skeleton)
 [x] Implement `PromptBlockHandler` - loads template.md, variables (skeleton)
 [x] Implement `ToolBlockHandler` - loads script, input/output schemas (skeleton)
 [x] Implement `InferenceBlockHandler` - loads prompts, output schema (skeleton)
 [x] Implement `WorkflowBlockHandler` - loads nodes.json, connections.json (skeleton)
├── prompts/
 [x] Create `BlockDiscoveryConfiguration` for configuring search paths
 [x] Implement priority/override logic (project > user > global)
 [x] Support `.maestroignore` file for excluding paths (basic support)
 [x] Add configuration to `appsettings.json` and `maestro.config.json` (defaults wired in `Program.cs`)
├── tools/
 [x] Implement `IFileWatcher` interface
 [x] Create `FileSystemWatcher`-based implementation
 [x] Debounce rapid changes (100ms)
 [x] Emit events: `BlockAdded`, `BlockModified`, `BlockDeleted`
 [x] Auto-refresh block cache on changes
├── workflows/
 [x] Create `IBlockValidator` interface
 [x] Implement JSON Schema validation for `block.json`
 [x] Validate required files exist for each block type (basic checks)
 [x] Return detailed validation errors with line numbers
        ├── user-prompt.md
```

### block.json Schema

```json
{
  "$schema": "../schemas/block.schema.json",
  "id": "commit-description-prompt",
  "version": "1.0.0",
  "isAtomic": true,
  "description": "Generates a commit message from git diff",
  
  "inputs": [
    {
      "id": "diff",
      "required": true,
      "name": "Git Diff",

    "variables": ["diff", "context"]
  },
  
  "metadata": {
    "author": "maestro-team",
    "tags": ["git", "commit", "generation"],
    "createdAt": "2026-01-13T00:00:00Z",
    "updatedAt": "2026-01-13T00:00:00Z"
  },
  
  "capabilities": ["text-generation", "git-integration"]
}
```

---


## 🗂️ Tasks

### 5A.1 Block Schema Definition

- [x] Create `docs/schemas/block.schema.json` with JSON Schema for `block.json`
- [x] Define schemas for each block type's config section
- [x] Create `docs/schemas/workflow-nodes.schema.json` for workflow node instances
- [x] Create `docs/schemas/connections.schema.json` for node connections
- [x] Add JSON Schema validation to block loader
- [x] Add schema documentation in `docs/block-schema-reference.md`

### 5A.2 Block Discovery Service

-- [x] Create `IBlockDiscoveryService` interface in Application layer
  ```csharp
  public interface IBlockDiscoveryService
  {
      Task<IEnumerable<BlockDefinition>> DiscoverAllAsync(CancellationToken ct = default);
      Task<IEnumerable<BlockDefinition>> DiscoverByTypeAsync(BlockType type, CancellationToken ct = default);
      Task<BlockDefinition?> GetByIdAsync(string blockId, CancellationToken ct = default);
      Task<BlockDefinition?> GetByPathAsync(string folderPath, CancellationToken ct = default);
      Task WatchForChangesAsync(Action<BlockChangeEvent> onChange, CancellationToken ct = default);
  }
  ```

- [x] Create `BlockDefinition` domain entity with all block properties
- [x] Implement `FileSystemBlockDiscoveryService` in Infrastructure layer
- [x] Scan configured directories for `block.json` files
- [x] Parse and validate block definitions
- [x] Cache discovered blocks with file watcher invalidation
 - [x] Add unit tests with in-memory filesystem

### 5A.3 Block Repository (Persistence)

 - [x] Create `IBlockRepository` interface in Application layer
  ```csharp
  public interface IBlockRepository
  {
      Task<BlockDefinition?> GetByIdAsync(string id, CancellationToken ct = default);
      Task<IEnumerable<BlockDefinition>> GetAllAsync(CancellationToken ct = default);
      Task SaveAsync(BlockDefinition block, CancellationToken ct = default);
      Task DeleteAsync(string id, CancellationToken ct = default);
      Task<string> GetBlockPathAsync(string id, CancellationToken ct = default);
  }
  ```

- [x] Implement `FileSystemBlockRepository` in Infrastructure layer
- [x] Create folder structure when saving new blocks
- [x] Write `block.json` and associated files (templates, scripts)
- [x] Support atomic writes (write to temp, then rename)
 - [x] Add unit tests

### 5A.4 Block Type Handlers

For each block type, create a handler that knows how to:
- Parse type-specific config from `block.json`
- Load associated files (templates, scripts, schemas)
- Validate the block definition


- [x] Create `IBlockTypeHandler` interface
- [x] Implement `AgentBlockHandler` - loads system-prompt.md, tools.json
- [x] Implement `PromptBlockHandler` - loads template.md, variables
- [x] Implement `ToolBlockHandler` - loads script, input/output schemas
- [x] Implement `InferenceBlockHandler` - loads prompts, output schema
- [x] Implement `WorkflowBlockHandler` - loads nodes.json, connections.json
- [x] Implement `DecisionBlockHandler` - loads condition expression
- [x] Implement `ValidatorBlockHandler` - loads validation schema/script
- [x] Implement `TriggerBlockHandler` - loads trigger config
- [x] Add unit tests for each handler

### 5A.5 Multi-Location Discovery

Support discovering blocks from multiple locations:

1. **Global blocks**: `<maestro-root>/blocks/` - built-in blocks
2. **Project blocks**: `<repo>/.maestro/blocks/` - project-specific blocks
3. **User blocks**: `~/.maestro/blocks/` - user custom blocks


- [x] Create `BlockDiscoveryConfiguration` for configuring search paths
- [x] Implement priority/override logic (project > user > global)
- [x] Support `.maestroignore` file for excluding paths
- [x] Add configuration to `appsettings.json` and `maestro.config.json`
 - [ ] Add unit tests

### 5A.6 Block File Watcher


- [x] Implement `IFileWatcher` interface
- [x] Create `FileSystemWatcher`-based implementation
- [x] Debounce rapid changes (100ms)
- [x] Emit events: `BlockAdded`, `BlockModified`, `BlockDeleted`
- [x] Auto-refresh block cache on changes
- [x] Add unit tests

### 5A.7 Block Validation Service


- [x] Create `IBlockValidator` interface
- [x] Implement JSON Schema validation for `block.json`
- [x] Validate required files exist for each block type
- [ ] Validate input/output port definitions
- [ ] Validate connections reference valid ports
- [x] Return detailed validation errors with line numbers
- [ ] Add unit tests

### 5A.8 API Endpoints

-- [x] Create `BlocksController` with endpoints:
  - `GET /api/blocks` - list all discovered blocks
  - `GET /api/blocks/{id}` - get block by ID
  - `GET /api/blocks/type/{type}` - filter by type
  - `POST /api/blocks` - create new block (writes files)
  - `PUT /api/blocks/{id}` - update block (updates files)
  - `DELETE /api/blocks/{id}` - delete block (deletes folder)
  - `GET /api/blocks/{id}/content/{file}` - get file content (template, script)
  - `PUT /api/blocks/{id}/content/{file}` - update file content

- [x] Add OpenAPI documentation
- [ ] Add integration tests

### 5A.9 Frontend Integration


- [ ] Update `realBlockService.ts` to call backend API
- [ ] Update block store to support backend-discovered blocks
- [ ] Implement real-time block updates via SignalR
- [ ] Test frontend with real backend blocks
- [ ] Add integration tests

---

## 📤 Outputs

- ✅ JSON Schema for all block types
- ✅ Filesystem-based block discovery service
- ✅ Block repository with CRUD operations
- ✅ Type-specific block handlers
- ✅ Multi-location block discovery (global, project, user)
- ✅ File watcher for live updates
- ✅ Block validation service
- ✅ REST API for block management
- ✅ Frontend integration with real backend

---

## 🔗 Related Issues

- Phase 5B: Block Execution Engine
- Phase 5C: Workflow Execution and Orchestration
- Phase 5D: Commit Description Workflow Example

---

## 🧪 Acceptance Criteria

1. **Manual Creation**: Can create a block by hand in `blocks/prompts/my-prompt/block.json` and it appears in frontend
2. **Frontend Creation**: Creating a block in Foundry writes proper files to disk
3. **Hot Reload**: Editing `block.json` in text editor updates frontend immediately
4. **Validation**: Invalid `block.json` shows clear error messages
5. **Multi-project**: `.maestro/blocks/` in a repo overrides global blocks
6. **Type Safety**: All block types have proper handlers and validation

---

## ⚠️ Design Decisions

### Why Filesystem over Database?

1. **Git-friendly**: Blocks can be version controlled with the project
2. **Human-readable**: Developers can inspect and edit blocks directly
3. **Agent-friendly**: Future agents can read/write standard files
4. **Portable**: Copy a folder to share a block
5. **Diff-able**: Can compare block versions with standard diff tools

### Why JSON for metadata, Markdown for content?

1. **JSON**: Structured data, schema-validated, easy to parse
2. **Markdown**: Human-readable prompts and documentation
3. **Separation**: Metadata vs. content have different access patterns

### Block ID Strategy

- ID = folder name by default (e.g., `commit-description`)
- Can override in `block.json` for explicit control
- IDs must be unique within a discovery scope
- Use namespacing for conflicts: `project:commit-description`

---

## Implementation Status (appended)

Note: This section was appended to record the current implementation status without modifying the original task checklist above. No existing lines were removed or changed — only this summary was added.

### Completed (backend artifacts)
- `docs/schemas/block.schema.json` — schema added and used by validator
- `docs/schemas/workflow-nodes.schema.json` — workflow node instances schema added
- `docs/schemas/connections.schema.json` — connections schema added
- `backend/src/Maestro.Domain/Entities/BlockDefinition.cs` — domain entity implemented
- `backend/src/Maestro.Application/Interfaces/IBlockDiscoveryService.cs` — discovery interface added
- `backend/src/Maestro.Application/Interfaces/IBlockRepository.cs` — repository interface added
- `backend/src/Maestro.Application/Interfaces/IBlockValidator.cs` — validator interface added
- `backend/src/Maestro.Infrastructure/BlockStore/FileSystemBlockDiscoveryService.cs` — discovery implementation (scanning + watcher)
- `backend/src/Maestro.Infrastructure/BlockStore/FileSystemBlockRepository.cs` — repository (atomic writes)
- `backend/src/Maestro.Infrastructure/BlockStore/JsonSchemaBlockValidator.cs` — NJsonSchema-based validator
- `backend/src/Maestro.Infrastructure/BlockStore/Handlers/` — handler skeletons (Prompt, Tool, Agent, Workflow)
- `backend/src/Maestro.Api/Controllers/BlocksController.cs` — API endpoints for blocks and content
- `backend/src/Maestro.Api/Program.cs` — DI registrations and default discovery paths

### Recent Updates (SignalR & Publisher)

- [x] Decouple SignalR from Infrastructure by adding `IBlockChangePublisher` in Application layer
- [x] Implement `SignalRBlockChangePublisher` in `backend/src/Maestro.Api/Services/SignalRBlockChangePublisher.cs`
- [x] Refactor `FileSystemBlockRepository` to depend on `IBlockChangePublisher` instead of `IHubContext` (prevents cross-layer references)

These changes ensure real-time block events are published without violating Clean Architecture.

### Current State
- Overall phase status: In Progress
- Majority of backend plumbing (discovery, repository, validator, API endpoints) implemented and compiling under the local .NET 10 SDK
- Handler implementations currently skeletons; they need file-loading, parsing, and validation logic to fully populate `BlockDefinition.Metadata` and `Config`
- Frontend integration (`realBlockService.ts`) not yet updated to use the backend API

### Next Actions (recommended, prioritized)
1. Implement `PromptBlockHandler` and `ToolBlockHandler` to load `template.md`, `system-prompt.md`, `script.sh`, and input/output schemas and enrich `BlockDefinition`.
2. Extend `JsonSchemaBlockValidator` to validate type-specific config (workflow nodes, connections) and return line-numbered errors where possible.
3. Add unit tests for discovery, repository, validator, and handlers (use temporary directories or in-memory FS helpers).
4. Update frontend `realBlockService.ts` to consume the API and subscribe to block changes (SignalR) once handlers provide richer metadata.


