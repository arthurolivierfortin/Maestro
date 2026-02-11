# ADR: TypeScript Migration & Shared Layer

**Status**: Accepted
**Phase**: 16
**Date**: 2026-02-11

## Context

The Maestro project has two UI interfaces:
- **Frontend** (React + TypeScript + Vite) — web dashboard
- **TUI Monitor** (Ink + plain JavaScript) — terminal interface

Both interfaces consume the same backend API and manipulate the same domain concepts (Sessions, Blocks, Workspaces, Projects, Phases, Execution Trees). Currently, each interface defines its own data shapes, status mappings, and transformation logic independently, leading to:

1. **Type drift** — Adding a field to Session in the backend requires updating two independent codebases
2. **Logic duplication** — `statusColor`, `formatDuration`, `flattenExecutionTree` exist only in the TUI but will be needed in the frontend
3. **No compile-time safety** — The TUI is plain JS; typos in property names are caught at runtime only
4. **Inconsistent contracts** — The mock API client defines shapes implicitly; the frontend has explicit TypeScript types

## Decision

Migrate the TUI monitor to TypeScript and extract shared logic into `shared/` as a common TypeScript layer consumed by both interfaces.

## Architecture

```
shared/
├── types/
│   ├── session.ts          # Session, SessionVariable, Phase, ExecutionNode
│   ├── block.ts            # Block, BlockType, BlockConfig
│   ├── workspace.ts        # Workspace, WorkspaceSettings
│   ├── project.ts          # Project, MaestroInfo
│   ├── llm.ts              # LLMHealth, LLMStatus, LLMModel
│   └── monitor.ts          # MonitorDescriptor, Widget, ExecutionLog
├── utils/
│   ├── status.ts           # statusColor, statusIcon, statusLabel
│   ├── format.ts           # formatDuration, formatTime, truncate
│   ├── tree.ts             # flattenExecutionTree, flattenPhaseWorkflow, autoExpandRunningPath
│   └── resolve.ts          # resolvePath (widget data binding)
├── api/
│   └── api-client.types.ts # ApiClient interface (listSessions, getSession, etc.)
├── tsconfig.json
└── package.json

maestro-cli/monitor/ink/
├── tsconfig.json           # extends shared, adds Ink/React types
├── theme.ts                # imports statusColor etc. from shared, adds TUI-specific colors
├── App.ts
├── components/*.ts
├── hooks/*.ts
└── mock-api-client.ts      # implements shared ApiClient interface

frontend/src/
├── types/                  # imports from shared/ instead of local definitions
├── utils/                  # imports from shared/ where applicable
└── ...
```

## What Moves to `shared/`

| Module | Current Location | Shared? |
|--------|-----------------|---------|
| Session/Block/Phase types | Implicit in mock-api-client.js + frontend types/ | Yes — `shared/types/` |
| ApiClient interface | Implicit | Yes — `shared/api/` |
| `statusColor`, `statusIcon` | `theme.js` | Yes — `shared/utils/status.ts` |
| `formatDuration`, `formatTime`, `truncate` | `theme.js` | Yes — `shared/utils/format.ts` |
| `flattenExecutionTree`, `autoExpandRunningPath` | `WorkflowTree.js` | Yes — `shared/utils/tree.ts` |
| `flattenPhaseWorkflow`, `cloneTreeWithStatus` | `PhaseWorkflow.js` | Yes — `shared/utils/tree.ts` |
| `resolvePath` | `theme.js` | Yes — `shared/utils/resolve.ts` |
| `Badge`, `TypeBadge`, `Panel`, etc. | TUI components | No — UI-specific |
| `useKeyboard`, `useApiData`, etc. | TUI hooks | No — Ink-specific |
| React component colors (theme object) | `theme.js` | No — TUI visual styling |

## What Stays TUI-Specific

- `theme` object (colors, icons, panel styling)
- `Badge`, `TypeBadge`, `Panel`, `StatusBar` components
- `useKeyboard`, `useApiData`, `usePanelFocus` hooks
- `createElement as h` convention
- `mock-api-client.ts` (implements shared interface, but mock data is TUI-specific)

## TypeScript Runner

Use **`tsx`** (TypeScript Execute) instead of adding a build step:

```bash
# Instead of: tsc && node dist/index.js
# Use:        npx tsx index.ts
```

Benefits:
- Zero build step — same DX as current plain JS
- Supports ESM natively
- Fast (uses esbuild under the hood)
- No `dist/` folder to manage

For the CLI entry point (`maestro-cli/index.js`), keep it as JS and have it call `tsx` for the monitor, or migrate the entire CLI to TS with tsx as the runner.

## Migration Order

1. **`shared/types/`** — Define interfaces from existing implicit shapes
2. **`shared/utils/`** — Extract pure functions, add types, keep existing tests passing
3. **`shared/api/`** — Define ApiClient interface
4. **TUI `mock-api-client.ts`** — First file migrated, implements shared interface
5. **TUI `theme.ts`** — Import shared utils, keep TUI-specific styling
6. **TUI hooks** — Add parameter/return types
7. **TUI components** — Migrate one by one (leaf components first)
8. **Frontend alignment** — Import shared types, remove local duplicates

## Risks

- **tsx dependency**: Adds a dev dependency; acceptable since it's dev tooling only
- **Import paths**: `shared/` needs to be importable from both `maestro-cli/` and `frontend/`. Options: npm workspace, relative imports, or tsconfig paths
- **Breaking existing tests**: Pure function tests (phase-workflow-tree.test.js) inline the functions; they'd need to import from `shared/utils/tree.ts` instead

## Success Criteria

- [ ] Both interfaces import types from `shared/types/`
- [ ] Pure utility functions live in `shared/utils/` with tests
- [ ] Adding a new field to Session requires changing only `shared/types/session.ts`
- [ ] TUI monitor launches with `tsx` without a build step
- [ ] All existing tests pass
