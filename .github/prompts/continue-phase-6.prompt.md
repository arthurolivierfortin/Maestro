# Continue Phase 6 Implementation

You are an AI agent working on B-One Maestro, an autonomous multi-agent workflow orchestrator. Your task is to continue implementing Phase 6: Unified Block Architecture & Single Source of Truth.

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

## Your Task

Continue Phase 6 implementation by:

1. **Check current progress** in issue files (`docs/issues/phase-6*.md`)
2. **Find incomplete tasks** (unchecked boxes `- [ ]`)
3. **Complete tasks in order** (6A → 6B → 6C → 6D → 6E)
4. **Mark tasks complete** as you finish them
5. **Update ROADMAP.md** when completing milestones

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

## Success Criteria

Phase 6 is complete when:
- [ ] All clients (Frontend, CLI, MCP) use Backend API exclusively
- [ ] No direct filesystem reads outside Backend Infrastructure
- [ ] Docker deployment works
- [ ] All acceptance criteria in issue files are met
- [ ] All task checkboxes are marked complete

## Start Here

Begin by reading the issue file for the current sub-phase and finding the first incomplete task. Good luck!

---

**Prompt Usage**: Copy this prompt to give to an AI agent to continue Phase 6 work.
