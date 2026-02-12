# Phase 16: CLI Colors — Shared Color Language for Shell & Output

## Overview

The TUI monitor has a full color theme (via Ink/React), but the CLI shell and command output are plain text with only emojis. The shared layer (`shared/utils/status.ts`, `shared/utils/progress.ts`) already exports color **name** strings (e.g. `'green'`, `'cyan'`) but nothing converts these to ANSI terminal codes for the CLI.

**Goal**: Create a lightweight ANSI color utility in `shared/utils/cli-colors.ts` that maps the same color names used by the TUI theme to ANSI escape codes, then use it in `output-formatter.ts`, `shell.ts`, and key sections of `cli.ts`.

## Architecture Decisions

1. **Shared utility, not CLI-specific** — `cli-colors.ts` lives in `shared/utils/` so any Node.js consumer (CLI, MCP, scripts) can use it. The TUI uses Ink's `<Text color="...">` instead.
2. **Zero dependencies** — Pure ANSI escape codes, no `chalk` or `kleur`. Keeps the CLI dependency-free for colors.
3. **Respects NO_COLOR** — If `NO_COLOR` env is set or stdout is not a TTY, all color functions return plain text. Follows the [no-color.org](https://no-color.org) convention.
4. **Same color names as TUI** — Maps `'green'`, `'cyan'`, `'red'`, `'yellow'`, `'gray'`, `'magenta'`, `'blue'`, `'white'` to ANSI codes. Same strings used in `statusColor()` and `progressColor()`.
5. **Composable API** — `c.green('text')` for direct use, `c.status(statusString, text)` for status-aware coloring, `c.bold('text')` for emphasis.

## Scope

### Files Created
- `shared/utils/cli-colors.ts` — ANSI color utility

### Files Modified
- `shared/utils/index.ts` — Add barrel export for cli-colors
- `maestro-cli/output-formatter.ts` — Colored success/error/info/table output
- `maestro-cli/shell.ts` — Colored banner, prompt, help
- `maestro-cli/cli.ts` — Colored health check, list outputs, error messages

### NOT Modified
- TUI files — Already use Ink's color system
- `shared/utils/status.ts` — Already returns color name strings (no changes needed)
- `shared/utils/progress.ts` — Already returns color name strings (no changes needed)

## Implementation Stages

1. **Stage 0**: This document
2. **Stage 1**: Create `shared/utils/cli-colors.ts` with ANSI mapping + update barrel
3. **Stage 2**: Update `output-formatter.ts` — colored prefixes, status indicators
4. **Stage 3**: Update `shell.ts` — cyan banner border, colored prompt, colored help sections
5. **Stage 4**: Update `cli.ts` — colored health output, colored list headers, colored errors

## Verification

After implementation:
1. `node maestro-cli/index.js health` — Shows colored health output
2. `node maestro-cli/index.js --help` — Banner shows colors
3. Shell mode (`node maestro-cli/index.js`) — Colored banner, prompt, help
4. `NO_COLOR=1 node maestro-cli/index.js health` — No colors
5. `npx tsx maestro-cli/tests/phase-workflow-tree.test.ts` — Tests still pass
6. `cd frontend && npm run build` — Frontend still builds
