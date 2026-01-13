# Phase 5A: Filesystem-Based Block Architecture

**Goal**: Design and implement a filesystem-based block definition system where blocks are discovered dynamically from folders, can be created by hand in a text editor, by the frontend, or later by agents.

**Duration**: 2-3 weeks  
**Team**: Backend (2 developers)  
**Dependencies**: Phase 4i complete (breadcrumb/navigation fixes)  
**Status**: Not Started

---

## 🎯 Strategic Context

This phase is **critical** because it establishes the foundation for:

1. **Human-editable blocks**: Developers can create/modify blocks in any text editor
2. **Frontend-created blocks**: UI creates proper file structures in the backend
3. **Agent-generated blocks**: Future auto-improvement will generate and compare workflows
4. **Deterministic replay**: Workflows must be serializable and replayable identically
5. **Environment-agnostic execution**: Block logic must not depend on MCP or VS Code

### Design Principles

- **Filesystem = Source of Truth**: Blocks are defined by files, not database records
- **Declarative Metadata**: `block.json` describes the block completely
- **Dynamic Discovery**: Backend scans directories to find blocks
- **Convention over Configuration**: Standard folder structure = automatic discovery
- **Portable**: Same block structure works in Maestro root, `.maestro/` folders, or any repo

---

## 📁 Block Folder Structure

### Standard Block Layout

```
blocks/
├── agents/
│   ├── planner/
│   │   ├── block.json          # Block metadata and config
│   │   ├── system-prompt.md    # System prompt template
│   │   ├── tools.json          # Available tools list
│   │   └── README.md           # Human documentation
│   ├── coder/
│   │   ├── block.json
│   │   ├── system-prompt.md
│   │   └── tools.json
│   └── reviewer/
│       ├── block.json
│       └── system-prompt.md
├── prompts/
│   ├── commit-description/
│   │   ├── block.json
│   │   └── template.md         # Prompt template
│   └── code-review/
│       ├── block.json
│       └── template.md
├── tools/
│   ├── git-diff/
│   │   ├── block.json
│   │   ├── script.sh           # Tool implementation
│   │   └── schema.json         # Input/output schema
│   └── file-read/
│       ├── block.json
│       └── script.sh
├── workflows/
│   ├── commit-generator/
│   │   ├── block.json          # Workflow definition
│   │   ├── nodes.json          # Node instances and positions
│   │   └── connections.json    # Node connections
│   └── pr-description/
│       ├── block.json
│       └── nodes.json
└── inference/
    └── describe-changes/
        ├── block.json
        ├── user-prompt.md
        └── output-schema.json  # Expected output structure
```

### block.json Schema

```json
{
  "$schema": "../schemas/block.schema.json",
  "id": "commit-description-prompt",
  "name": "Commit Description Generator",
  "blockType": "prompt",
  "version": "1.0.0",
  "isAtomic": true,
  "description": "Generates a commit message from git diff",
  
  "inputs": [
    {
      "id": "diff",
      "name": "Git Diff",
      "type": "string",
      "required": true,
      "description": "The git diff output to describe"
    }
  ],
  "outputs": [
    {
      "id": "message",
      "name": "Commit Message",
      "type": "string",
      "description": "The generated commit message"
    }
  ],
  
  "config": {
    "type": "prompt",
    "templateFile": "template.md",
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

- [ ] Create `docs/schemas/block.schema.json` with JSON Schema for `block.json`
- [ ] Define schemas for each block type's config section
- [ ] Create `docs/schemas/workflow-nodes.schema.json` for workflow node instances
- [ ] Create `docs/schemas/connections.schema.json` for node connections
- [ ] Add JSON Schema validation to block loader
- [ ] Add schema documentation in `docs/block-schema-reference.md`

### 5A.2 Block Discovery Service

- [ ] Create `IBlockDiscoveryService` interface in Application layer
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
- [ ] Create `BlockDefinition` domain entity with all block properties
- [ ] Implement `FileSystemBlockDiscoveryService` in Infrastructure layer
- [ ] Scan configured directories for `block.json` files
- [ ] Parse and validate block definitions
- [ ] Cache discovered blocks with file watcher invalidation
- [ ] Add unit tests with in-memory filesystem

### 5A.3 Block Repository (Persistence)

- [ ] Create `IBlockRepository` interface in Application layer
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
- [ ] Implement `FileSystemBlockRepository` in Infrastructure layer
- [ ] Create folder structure when saving new blocks
- [ ] Write `block.json` and associated files (templates, scripts)
- [ ] Support atomic writes (write to temp, then rename)
- [ ] Add unit tests

### 5A.4 Block Type Handlers

For each block type, create a handler that knows how to:
- Parse type-specific config from `block.json`
- Load associated files (templates, scripts, schemas)
- Validate the block definition

- [ ] Create `IBlockTypeHandler` interface
- [ ] Implement `AgentBlockHandler` - loads system-prompt.md, tools.json
- [ ] Implement `PromptBlockHandler` - loads template.md, variables
- [ ] Implement `ToolBlockHandler` - loads script, input/output schemas
- [ ] Implement `InferenceBlockHandler` - loads prompts, output schema
- [ ] Implement `WorkflowBlockHandler` - loads nodes.json, connections.json
- [ ] Implement `DecisionBlockHandler` - loads condition expression
- [ ] Implement `ValidatorBlockHandler` - loads validation schema/script
- [ ] Implement `TriggerBlockHandler` - loads trigger config
- [ ] Add unit tests for each handler

### 5A.5 Multi-Location Discovery

Support discovering blocks from multiple locations:

1. **Global blocks**: `<maestro-root>/blocks/` - built-in blocks
2. **Project blocks**: `<repo>/.maestro/blocks/` - project-specific blocks
3. **User blocks**: `~/.maestro/blocks/` - user custom blocks

- [ ] Create `BlockDiscoveryConfiguration` for configuring search paths
- [ ] Implement priority/override logic (project > user > global)
- [ ] Support `.maestroignore` file for excluding paths
- [ ] Add configuration to `appsettings.json` and `maestro.config.json`
- [ ] Add unit tests

### 5A.6 Block File Watcher

- [ ] Implement `IFileWatcher` interface
- [ ] Create `FileSystemWatcher`-based implementation
- [ ] Debounce rapid changes (100ms)
- [ ] Emit events: `BlockAdded`, `BlockModified`, `BlockDeleted`
- [ ] Auto-refresh block cache on changes
- [ ] Add unit tests

### 5A.7 Block Validation Service

- [ ] Create `IBlockValidator` interface
- [ ] Implement JSON Schema validation for `block.json`
- [ ] Validate required files exist for each block type
- [ ] Validate input/output port definitions
- [ ] Validate connections reference valid ports
- [ ] Return detailed validation errors with line numbers
- [ ] Add unit tests

### 5A.8 API Endpoints

- [ ] Create `BlocksController` with endpoints:
  - `GET /api/blocks` - list all discovered blocks
  - `GET /api/blocks/{id}` - get block by ID
  - `GET /api/blocks/type/{type}` - filter by type
  - `POST /api/blocks` - create new block (writes files)
  - `PUT /api/blocks/{id}` - update block (updates files)
  - `DELETE /api/blocks/{id}` - delete block (deletes folder)
  - `GET /api/blocks/{id}/content/{file}` - get file content (template, script)
  - `PUT /api/blocks/{id}/content/{file}` - update file content
- [ ] Add OpenAPI documentation
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

