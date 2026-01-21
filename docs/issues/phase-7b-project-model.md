# Phase 7B: Project Model - Domain Entity & Backend Support

**Phase**: 7B
**Priority**: Critical
**Duration**: 3-4 days
**Team**: Backend
**Dependencies**: Phase 7A complete
**Blocks**: Phase 7C, 7D, 7E
**Status**: Not Started

---

## Overview

Introduce the `Project` concept as a first-class domain entity representing an isolated execution unit per repository. A Project encapsulates blocks, workflows, configurations, and runtime settings.

## Goals

1. Define `Project` domain entity with proper value objects
2. Create `project.json` schema for project configuration
3. Implement `IProjectRepository` for project persistence
4. Add `projectId` parameter support across all block/workflow APIs
5. Enable project-scoped block discovery

---

## Architecture

### Project Entity Structure

```
repo-root/
├── .maestro/
│   ├── project.json          # Project configuration
│   └── blocks/               # Project-specific blocks
│       ├── my-agent.agent.block.json
│       └── my-tool.tool.block.json
├── src/                      # User code
└── ...
```

### Project JSON Schema

```json
{
  "$schema": "https://maestro.dev/schemas/project.json",
  "id": "uuid-v4",
  "name": "my-project",
  "description": "Project description",
  "version": "1.0.0",
  "runtime": {
    "container": "maestro-runtime:latest",
    "workDir": "/app",
    "env": {
      "NODE_ENV": "development"
    }
  },
  "blocks": {
    "searchPaths": ["./blocks", "../shared-blocks"]
  },
  "models": {
    "default": "gpt-4",
    "overrides": {}
  }
}
```

---

## Tasks

### 7B.1 Create Project Domain Entity
- [ ] Create `Project` entity in `Maestro.Domain/Entities/`
  - `Id: ProjectId` (value object)
  - `Name: string`
  - `Description: string`
  - `RootPath: string` (absolute path to repo root)
  - `RuntimeConfig: RuntimeConfiguration` (value object)
  - `CreatedAt: DateTime`
  - `UpdatedAt: DateTime`
- [ ] Create `ProjectId` value object with validation
- [ ] Create `RuntimeConfiguration` value object
- [ ] Add domain events: `ProjectCreated`, `ProjectUpdated`, `ProjectDeleted`

### 7B.2 Create Project JSON Schema
- [ ] Create `docs/schemas/project.schema.json`
- [ ] Define all required and optional properties
- [ ] Add runtime configuration schema
- [ ] Add blocks configuration schema
- [ ] Add models configuration schema

### 7B.3 Implement IProjectRepository
- [ ] Create `IProjectRepository` interface in `Maestro.Application/Interfaces/`
  - `GetByIdAsync(ProjectId id)`
  - `GetByPathAsync(string rootPath)`
  - `GetAllAsync()`
  - `SaveAsync(Project project)`
  - `DeleteAsync(ProjectId id)`
- [ ] Implement `FileSystemProjectRepository` in `Maestro.Infrastructure/Projects/`
- [ ] Support project discovery by scanning for `.maestro/project.json`
- [ ] Add validation using JSON schema

### 7B.4 Add ProjectId to Block APIs
- [ ] Update `BlocksController` to accept optional `projectId` query parameter
- [ ] Update `IBlockDiscoveryService` to accept `ProjectId`
- [ ] Create `ProjectScopedBlockDiscoveryService` decorator
- [ ] When `projectId` is provided, only discover blocks from that project
- [ ] When `projectId` is null, discover from all sources (current behavior)

### 7B.5 Create Projects API Endpoints
- [ ] Create `ProjectsController` in `Maestro.Api/Controllers/`
- [ ] Implement endpoints:
  - `GET /api/projects` - List all discovered projects
  - `GET /api/projects/{id}` - Get project by ID
  - `POST /api/projects` - Create new project (initialize .maestro folder)
  - `PUT /api/projects/{id}` - Update project configuration
  - `DELETE /api/projects/{id}` - Delete project
  - `POST /api/projects/open` - Open existing project by path
- [ ] Add SignalR hub for project events

### 7B.6 Update Use Cases for Project Context
- [ ] Create `GetProjectBlocksUseCase`
- [ ] Create `CreateBlockInProjectUseCase`
- [ ] Create `ExecuteWorkflowInProjectUseCase`
- [ ] Inject project context into execution pipeline

### 7B.7 Add Project DTOs
- [ ] Create `ProjectDto` in `Maestro.Application/DTOs/`
- [ ] Create `CreateProjectRequest`
- [ ] Create `UpdateProjectRequest`
- [ ] Create `OpenProjectRequest`

---

## Acceptance Criteria

1. [ ] `Project` entity follows Clean Architecture (no infrastructure dependencies)
2. [ ] `project.json` schema is defined and validated
3. [ ] Projects can be created, read, updated, deleted via API
4. [ ] Blocks can be filtered by `projectId`
5. [ ] Project discovery works by scanning for `.maestro/project.json`
6. [ ] All APIs support optional `projectId` parameter
7. [ ] Backward compatibility: APIs work without `projectId` (global scope)

---

## Files to Create

### Domain Layer
- `backend/src/Maestro.Domain/Entities/Project.cs`
- `backend/src/Maestro.Domain/ValueObjects/ProjectId.cs`
- `backend/src/Maestro.Domain/ValueObjects/RuntimeConfiguration.cs`
- `backend/src/Maestro.Domain/Events/ProjectCreated.cs`
- `backend/src/Maestro.Domain/Events/ProjectUpdated.cs`
- `backend/src/Maestro.Domain/Events/ProjectDeleted.cs`

### Application Layer
- `backend/src/Maestro.Application/Interfaces/IProjectRepository.cs`
- `backend/src/Maestro.Application/DTOs/ProjectDto.cs`
- `backend/src/Maestro.Application/DTOs/CreateProjectRequest.cs`
- `backend/src/Maestro.Application/UseCases/GetProjectBlocksUseCase.cs`

### Infrastructure Layer
- `backend/src/Maestro.Infrastructure/Projects/FileSystemProjectRepository.cs`
- `backend/src/Maestro.Infrastructure/Projects/ProjectScopedBlockDiscoveryService.cs`

### API Layer
- `backend/src/Maestro.Api/Controllers/ProjectsController.cs`
- `backend/src/Maestro.Api/Hubs/ProjectHub.cs`

### Schemas
- `docs/schemas/project.schema.json`

---

## API Examples

### List Projects
```bash
GET /api/projects
```
Response:
```json
[
  {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "my-project",
    "rootPath": "/home/user/projects/my-project",
    "blocksCount": 5,
    "workflowsCount": 2
  }
]
```

### Get Project Blocks
```bash
GET /api/blocks?projectId=123e4567-e89b-12d3-a456-426614174000
```

### Create Project
```bash
POST /api/projects
Content-Type: application/json

{
  "name": "new-project",
  "rootPath": "/home/user/projects/new-project"
}
```

---

## Technical Notes

### Project Discovery
On startup and periodically, scan known paths for `.maestro/project.json`:
1. Configured project paths from settings
2. Recently opened projects (stored in user config)
3. Explicit paths passed via environment

### Thread Safety
`FileSystemProjectRepository` must be thread-safe. Use `ConcurrentDictionary` for in-memory cache.

### Validation
Use `System.Text.Json` schema validation or a library like `NJsonSchema` to validate `project.json`.

---

## Related Issues

- Phase 7A: Correctifs (predecessor)
- Phase 7C: Unified Filesystem (uses project context)
- Phase 7D: Container Runtime (uses project runtime config)
