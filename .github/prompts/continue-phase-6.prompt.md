# Continue Phase 6 Implementation

You are an AI agent working on B-One Maestro, an autonomous multi-agent workflow orchestrator. Your task is to **IMPLEMENT CODE** for Phase 6: Unified Block Architecture & Single Source of Truth.

## ⚠️ CRITICAL RULES - READ FIRST

1. **YOU MUST IMPLEMENT CODE** - Do NOT just update documentation files
2. **YOU MUST COMPLETE ALL TASKS** - Do not ask which tasks to implement
3. **YOU MUST WRITE WORKING CODE** - Controllers, services, tests, everything
4. **YOU MUST RUN TESTS** - Verify your implementation works
5. **ONLY MARK [x] AFTER IMPLEMENTING** - Never add sub-items under unchecked tasks

## Phase Parameter

**YOU MUST BE GIVEN A PHASE**: The user will specify which phase to implement (6A, 6B, 6C, 6D, or 6E).

**Example**: "Implement Phase 6B" or "Complete Phase 6A tasks"

If no phase is specified, **START WITH PHASE 6A** and implement all incomplete tasks.

## Context

Phase 6 is **CRITICAL** for the project's future. It establishes the Backend as the single authoritative source for all block operations, enabling:
- Docker isolation
- Auto-training capabilities  
- Consistent block management across all clients

## Before You Start

1. **Read the project vision**: `README.md` - Understand what Maestro is building
2. **Read the roadmap**: `ROADMAP.md` - Find Phase 6 section for overview
3. **Read all instruction files** in `.github/instructions/`:
   - `issue-tracking.instructions.md` - HOW to track your work
   - `clean-architecture.instructions.md` - Architecture rules
   - `code-conventions.instructions.md` - Naming and style
   - `git-workflow.instructions.md` - Commit message format

## Your Implementation Workflow

For the specified phase (e.g., 6B):

1. **Read the issue file** (e.g., `docs/issues/phase-6b-discovery-api.md`)
2. **Find ALL incomplete tasks** (unchecked boxes `- [ ]`)
3. **Implement EVERY task** in order - DO NOT SKIP ANY
4. **Write actual code files** - Controllers, DTOs, Services, Tests
5. **Run tests** to verify each implementation
6. **Mark task [x] ONLY after code works**
7. **Commit with proper message** (e.g., `feat(api): implement DiscoveryController health endpoint [6B.2]`)
8. **Continue to next task** until ALL tasks for the phase are complete
9. **Update ROADMAP.md** only after all phase tasks are done

## Phase 6 Issue Files

| Sub-Phase | Issue File | Focus |
|-----------|-----------|-------|
| 6A | `docs/issues/phase-6a-unified-block-source.md` | Backend as single FS reader |
| 6B | `docs/issues/phase-6b-discovery-api.md` | Complete `/api/discovery` endpoints |
| 6C | `docs/issues/phase-6c-cli-mcp-api-clients.md` | Migrate CLI/MCP to API |
| 6D | `docs/issues/phase-6d-frontend-real-integration.md` | Frontend uses real backend |
| 6E | `docs/issues/phase-6e-docker-preparation.md` | Docker deployment |

## Critical Rules

1. **ALWAYS read the issue file** before starting a task
2. **ALWAYS mark tasks complete** after finishing
3. **NEVER add direct filesystem reads** outside Backend Infrastructure layer
4. **ALWAYS follow Clean Architecture** - no layer violations
5. **ALWAYS use conventional commits** with task reference (e.g., `[6A.2]`)

## Example Workflow

```
1. Read docs/issues/phase-6a-unified-block-source.md
2. Find first incomplete task (e.g., 6A.2)
3. Implement the solution following architecture rules
4. Run tests to verify
5. Mark task complete: - [ ] → - [x]
6. Commit: feat(api): implement BlocksController CRUD [6A.2]
7. Move to next task
```

## Architecture Reminder

```
                      FILESYSTEM
                          │
                          ▼
┌─────────────────────────────────────────────┐
│              BACKEND (only FS access)       │
│  Infrastructure → Application → Presentation│
└─────────────────────────────────────────────┘
                          │
                          ▼ HTTP API
    ┌─────────┬───────────┼────────────┬──────┐
    ▼         ▼           ▼            ▼      ▼
Frontend    CLI         MCP       Future Agents
```

## What to Implement (Examples)

### 6A: Unified Block Source
- Complete BlocksController CRUD endpoints
- Implement block discovery service
- Add block validation
- Write integration tests

### 6B: Discovery API
- Create DiscoveryController
- Implement /health, /capabilities, /config endpoints
- Add block discovery endpoints
- Write API tests

### 6C: CLI/MCP Migration
- Create shared MaestroApiClient library
- Refactor tools/maestro-cli to use API
- Refactor tools/maestro-mcp to use API
- Remove all direct filesystem reads
- Add --api-url flag support

### 6D: Frontend Real Integration
- Complete realDiscoveryService.ts
- Complete realExecutionService.ts
- Complete realBlockService.ts
- Wire up SignalR event handlers
- Add error handling and loading states

### 6E: Docker Preparation
- Create Dockerfiles
- Create docker-compose.yml
- Add environment configuration
- Write deployment documentation

## Success Criteria

The phase you implement is complete when:
- ✅ All task checkboxes in the issue file are marked [x]
- ✅ All code files are created and working
- ✅ All tests pass
- ✅ All acceptance criteria in the issue file are met
- ✅ ROADMAP.md is updated with completion status
- ✅ Commits follow conventional format with task references

## Start Here

**DO NOT ASK WHICH TASK TO DO** - Read the issue file for the specified phase and implement ALL incomplete tasks in order until the phase is complete.

---

**Prompt Usage**: "Follow instructions in continue-phase-6.prompt.md for Phase 6B" → Agent implements ALL Phase 6B tasks automatically.
