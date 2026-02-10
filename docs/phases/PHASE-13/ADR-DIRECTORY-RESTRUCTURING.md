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
- `scripts/`, `dev-utils/` (empty), `issues/` (1 file) added top-level clutter

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
│   ├── blocks/                         (moved from blocks/ - single search path)
│   │   ├── system/                     (system blocks - scanner convention preserved)
│   │   ├── agents/
│   │   ├── tools/
│   │   ├── workflows/
│   │   ├── inference/
│   │   ├── context/
│   │   ├── prompts/
│   │   └── validators/
│   ├── system/
│   │   └── templates/
│   │       ├── sessions/               (from data/foundry/templates/)
│   │       └── workspaces/             (from workspaces/templates/)
│   └── user/
│       ├── templates/                  (custom templates - empty initially)
│       ├── workspaces/                 (from data/workspaces/ - runtime)
│       ├── sessions/                   (from data/foundry/sessions/ - runtime)
│       ├── training/                   (from data/training/ - runtime)
│       ├── testing/                    (from data/testing/ - runtime)
│       ├── fitness/                    (from data/fitness/ - runtime)
│       └── experiments/                (from data/experiments/ - runtime)
├── scripts/                            (kept + absorbed tools/*.js utilities)
├── docs/                               (unchanged)
├── test-repos/                         (unchanged)
└── tests/                              (unchanged)
```

### Key Architectural Decision: Blocks as Single Search Path

`content/blocks/` is a SINGLE search path with `system/` as a subfolder inside it. The `FileSystemBlockDiscoveryService.ScanAll()` 3-pass scanner relies on finding `{searchPath}/system/` and `{searchPath}/user/` subdirectories. This convention is preserved by keeping blocks together under one path. The `system/` vs `user/` split at the `content/` level applies to templates and runtime data, NOT to blocks.

## Changes Made

### Backend (3 files)
1. `MaestroConstants.cs`: `DefaultGlobalBlocksRelativePath` changed from `"blocks"` to `"content/blocks"`
2. `Program.cs`: 6 path changes from `"data"` to `"content", "user"` for training, testing, fitness, workspaces, experiments, and approvals data
3. `FileSystemFoundrySessionRepository.cs`: Default path from `"data/foundry/sessions"` to `"content/user/sessions"`

### JavaScript (4 files)
4. `maestro-cli/index.js`: 3 path changes for blocks and templates resolution
5. `build-templates.js`: Template path references
6. `agent-improvement-loop.workflow.block.json`: Script path for format-metrics-report
7. `compliance-test-loop.workflow.block.json`: Script path for format-metrics-report

### Infrastructure (4 files)
8. `docker-compose.yml`: Volume mounts and env vars updated
9. `tests/maestro-cli.integration.test.js`: CLI path
10. `tests/maestro-mcp.integration.test.js`: MCP path
11. `commit-generator.integration.test.js`: CLI + blocks paths

### Documentation (3 files)
12. `CLAUDE.md`: CLI and template path references
13. `README.md`: Block discovery and Docker mount paths
14. `.gitignore`: Runtime directory exclusions added

## Consequences

### Positive
- Clear separation of shipped content (`content/system/`) vs runtime data (`content/user/`)
- CLI and MCP are first-class top-level projects, reducing confusion with block types
- Block scanner compatibility preserved without any changes to discovery code
- `data/` catch-all eliminated; each data category has a clear home
- `.gitignore` properly excludes runtime data directories

### Negative
- Documentation in `docs/` still references old paths (historical docs kept as-is)
- Slightly deeper paths for templates (`content/system/templates/sessions/` vs `data/foundry/templates/`)

### Neutral
- The locked `tools/maestro-cli` directory on disk (due to process lock) has been handled via git index updates; the old directory may need manual cleanup
