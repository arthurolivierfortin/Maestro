# Phase 16: TypeScript Migration & Shared Layer

## Overview

Migrate the **entire CLI + TUI monitor** from plain JavaScript to TypeScript and extract shared types + pure utility functions into `shared/` as a common layer consumed by both the CLI/TUI and the frontend.

## Architecture Decisions

1. **tsx as universal runner** — No build step; `node index.js` runs a 2-line CJS shim that registers tsx then loads `cli.ts`
2. **tsconfig paths** — `@shared/*` resolves to `../shared/*` via tsconfig paths; Vite gets matching `resolve.alias`
3. **Legacy blessed stays .js** — Deprecated `--legacy` monitor files are not migrated
4. **Flat directory structure** — No reorganization; `shared/` sits adjacent to `maestro-cli/` and `frontend/`

## Scope

### Files Created
- `shared/tsconfig.json`
- `shared/types/` — 6 type files + barrel (session, block, workspace, project, llm, api-client)
- `shared/utils/` — 5 util files + barrel (status, format, progress, tree, resolve)
- `maestro-cli/tsconfig.json`
- `maestro-cli/monitor/ink/tsconfig.json`
- `maestro-cli/cli.ts` — Logic moved from index.js

### Files Renamed (.js → .ts)
- CLI: `output-formatter.ts`, `json-parser.ts`, `shell.ts`
- Bridge: `monitor/tui-monitor.ts`
- TUI core: `ink/App.ts`, `ink/theme.ts`, `ink/mock-api-client.ts`
- TUI hooks (7): all hooks in `ink/hooks/`
- TUI components (27): all components in `ink/components/`
- Tests (3): all test files

### Files Modified
- `maestro-cli/index.js` — becomes 2-line shim
- `maestro-cli/package.json` — adds tsx, typescript, @types/*
- `maestro-cli/monitor/ink/package.json` — adds @types/react
- `frontend/tsconfig.json` — adds @shared path alias
- `frontend/vite.config.ts` — adds @shared resolve alias

### NOT Modified
- Legacy blessed files: `monitor/monitor.js`, `global-monitor.js`, `session-monitor.js`, `widgets/*.js`
- `shared/api-client.js` — existing CJS client stays as-is

## Implementation Stages

1. **Stage 0**: This document
2. **Stage 1**: Scaffold `shared/` (types + utils)
3. **Stage 2**: Set up tsx + tsconfig for CLI
4. **Stage 3**: Migrate CLI files + monitor bridge
5. **Stage 4**: Migrate TUI core (theme + mock-api-client + App)
6. **Stage 5**: Migrate TUI hooks (7 files)
7. **Stage 6**: Migrate TUI components (27 files)
8. **Stage 7**: Migrate tests (3 files)
9. **Stage 8**: Frontend alignment (tsconfig + vite alias)
10. **Stage 9**: Cleanup & verification

## Verification

After each stage:
1. `node maestro-cli/index.js monitor --mock` — TUI launches
2. `node maestro-cli/index.js health` — CLI commands work
3. `cd frontend && npm run build` — Frontend builds
4. Test files pass via `npx tsx`
