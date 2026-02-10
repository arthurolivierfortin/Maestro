# ADR: Project Directory Restructuring

**Date**: 2026-02-10
**Status**: Accepted
**Phase**: 13

## Context

The Maestro project's top-level directory structure had grown scattered and confusing:

- `blocks/` contained all block definitions but was not clearly organized under a content umbrella
- `data/` was a catch-all directory (workspaces, templates, training, testing, fitness, experiments)
- `workspaces/templates/` was separate from `data/workspaces/`
- `tools/` (CLI, MCP, shared libs) could be confused with `blocks/tools/` (tool blocks)
- `scripts/` mixed dev scripts (dev-start.ps1, quick-verify.ps1) with block-referenced scripts (format-metrics-report.js, llm-generate.ps1)
- `dev-utils/` (empty), `issues/` (1 file) added top-level clutter

## Decision

Restructure the project into a clear `content/` directory with `system/` (shipped by Maestro) and `user/` (created by usage) separation, and promote CLI and MCP to top-level projects.

### New Structure

```
C:\Meastro/
├── backend/                            (unchanged)
├── frontend/                           (unchanged)
├── maestro-cli/                        (promoted from tools/maestro-cli/)
├── maestro-mcp/                        (promoted from tools/maestro-mcp/)
├── shared/                             (moved from tools/shared/)
├── content/
│   ├── system/
│   │   ├── blocks/                     (moved from content/blocks/ ← blocks/)
│   │   │   ├── system/                 (system blocks - scanner convention preserved)
│   │   │   ├── agents/
│   │   │   ├── tools/
│   │   │   ├── workflows/
│   │   │   ├── inference/
│   │   │   ├── context/
│   │   │   ├── prompts/
│   │   │   ├── scripts/                (executable scripts used by blocks)
│   │   │   │   ├── format-metrics-report.js
│   │   │   │   └── llm-generate.ps1
│   │   │   └── validators/
│   │   └── templates/
│   │       ├── sessions/               (from data/foundry/templates/)
│   │       └── workspaces/             (from workspaces/templates/)
│   └── user/
│       ├── blocks/                     (custom user blocks - empty initially)
│       ├── templates/                  (custom templates - empty initially)
│       ├── workspaces/                 (from data/workspaces/ - runtime)
│       ├── sessions/                   (from data/foundry/sessions/ - runtime)
│       ├── training/                   (from data/training/ - runtime)
│       ├── testing/                    (from data/testing/ - runtime)
│       ├── fitness/                    (from data/fitness/ - runtime)
│       └── experiments/                (from data/experiments/ - runtime)
├── dev-scripts/                        (renamed from scripts/ - dev-only scripts)
├── docs/                               (unchanged)
├── test-repos/                         (unchanged)
└── tests/                              (unchanged)
```

### Key Architectural Decisions

#### Blocks under content/system/blocks/

Blocks are shipped system content and belong under `content/system/`. The `FileSystemBlockDiscoveryService.ScanAll()` 3-pass scanner finds `{searchPath}/system/` and `{searchPath}/user/` subdirectories. Setting the search path to `content/system/blocks` preserves this convention since the internal `system/` subfolder is still there.

#### Block scripts under content/system/blocks/scripts/

Scripts referenced by block JSON definitions (e.g., `format-metrics-report.js` in workflow blocks, `llm-generate.ps1` in tool blocks) are block resources. They live under `content/system/blocks/scripts/` alongside other block categories, since `script` is a block type.

#### Dev scripts renamed to dev-scripts/

The remaining scripts (dev-start.ps1, quick-verify.ps1, etc.) are development utilities, not block content. They are renamed to `dev-scripts/` to avoid confusion.

#### Old directories cleaned up

Empty directories from previous restructuring (`data/`, `tools/`, `workspaces/`, `issues/`, `dev-utils/`) are removed.

## Changes Made

### Backend (3 files)
1. `MaestroConstants.cs`: `DefaultGlobalBlocksRelativePath` changed from `"content/blocks"` to `"content/system/blocks"`
2. `Program.cs`: 6 path changes from `"data"` to `"content", "user"` for training, testing, fitness, workspaces, experiments, and approvals data
3. `FileSystemFoundrySessionRepository.cs`: Default path from `"data/foundry/sessions"` to `"content/user/sessions"`

### JavaScript (4 files)
4. `maestro-cli/index.js`: Path changes for blocks resolution (`content/system/blocks`)
5. `commit-generator.integration.test.js`: BLOCKS_PATH updated
6. `agent-improvement-loop.workflow.block.json`: Script path → `content/system/blocks/scripts/format-metrics-report.js`
7. `compliance-test-loop.workflow.block.json`: Script path → `content/system/blocks/scripts/format-metrics-report.js`

### Blocks (1 file)
8. `llm-generate.tool.block.json`: Script path → `content/system/blocks/scripts/llm-generate.ps1`

### Infrastructure (3 files)
9. `docker-compose.yml`: Volume mounts and env vars updated to `content/system/blocks`
10. `tests/maestro-cli.integration.test.js`: CLI path
11. `tests/maestro-mcp.integration.test.js`: MCP path

### Documentation (3 files)
12. `CLAUDE.md`: Dev-start path changed to `dev-scripts/dev-start.ps1`
13. `README.md`: Block discovery and Docker mount paths updated
14. `.gitignore`: Runtime directory exclusions added

### Renames
15. `scripts/` → `dev-scripts/` (dev utilities)
16. `scripts/format-metrics-report.js` → `content/system/blocks/scripts/format-metrics-report.js`
17. `scripts/llm-generate.ps1` → `content/system/blocks/scripts/llm-generate.ps1`

## Consequences

### Positive
- Clear hierarchy: `content/system/` for all shipped content (blocks, scripts, templates)
- `content/user/` for all runtime and custom data (blocks, workspaces, sessions)
- Block scanner compatibility preserved without any changes to discovery code
- CLI and MCP are first-class top-level projects, reducing confusion with block types
- `data/` catch-all eliminated; each data category has a clear home
- `.gitignore` properly excludes runtime data directories
- Dev scripts clearly separated from block-referenced scripts

### Negative
- Documentation in `docs/` still references old paths (historical docs kept as-is)
- Slightly deeper paths for blocks (`content/system/blocks/` vs `blocks/`)

### Neutral
- `content/user/blocks/` created as placeholder for future custom blocks
