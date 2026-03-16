# Phase 59-PRE Checkpoint

## 59-PRE-C : Validation locale (couts simules)
**Statut** : DONE
**Date** : 2026-03-15

### Results

| Step | Result | Evidence |
|------|--------|----------|
| 1. Determine MAESTRO_ROOT | PASS | Backend CWD = `C:\Meastro\apps\backend\src\Maestro.Api`, no MAESTRO_ROOT env var set by dev-start.ps1. `.maestro/` at that path. |
| 2. Create cost-config.json | PASS | Written to `apps/backend/src/Maestro.Api/.maestro/cost-config.json` with overrides for deepseek model ($3/$15 per million) and limits ($0.05/session, $0.50/day) |
| 3. Start services | PASS | Backend on :5000, LLM-Provider on :5010, both healthy |
| 4a. GET /api/costs/summary | PASS | Returns proper structure with today/week/month/allTime + byProvider/byModel + limits from config |
| 4b. GET /api/costs/limits | PASS | Returns `{maxPerSession: 0.05, maxPerDay: 0.50}` matching config file |
| 4c. PUT /api/costs/limits | PASS | Updates limits, persists to config file, verified via subsequent GET |
| 5. Create test session | PASS | Session `48c54230-...` created via API |
| 5b. Simulated cost entries | PASS | 3 JSONL entries written, API reads them correctly (totalCost: $0.054, 8800 tokens, 3 requests) |
| 6. cost-history.jsonl | PASS | 3 lines, readable by backend |
| 7a. CLI `costs summary` | PASS | Formatted output with all fields |
| 7b. CLI `costs limits` | PASS | Shows limits correctly |
| 7c. CLI `costs set-limit` | PASS (after fix) | BUG FOUND AND FIXED: set-limit replaced entire limits object instead of merging. Fixed to fetch+merge+write. |
| 7d. CLI `costs summary --json` | PASS | Raw JSON output works |

### Bug Found and Fixed

**CLI `set-limit` overwrites instead of merging** (lines 8824-8852 of `cli.ts`):
- Before fix: `maestro costs set-limit --per-day 1.00` would send `{maxPerDay: 1.00}` to the API, wiping out `maxPerSession: 0.05`
- After fix: CLI fetches existing limits first, merges updates, sends complete object
- File changed: `packages/maestro-cli/cli.ts`

### Architecture Note

The `MAESTRO_ROOT` environment variable is NOT set by `dev-scripts/dev-start.ps1`. The backend's `CostTrackingService` falls back to `Directory.GetCurrentDirectory()` which is `C:\Meastro\apps\backend\src\Maestro.Api`. This means `.maestro/cost-config.json` and `.maestro/cost-history.jsonl` live under the backend's project directory, not the monorepo root. This is inconsistent with the root-level `.maestro/` that stores sessions. Consider setting `MAESTRO_ROOT` in dev-start.ps1 in a future phase.

### Type Checks
- `dotnet build` backend: 0 errors
- `npx tsc --noEmit` maestro-code: 0 errors
- `npx tsc --noEmit` maestro-cli: 0 new errors (pre-existing errors in content/system/blocks only)
