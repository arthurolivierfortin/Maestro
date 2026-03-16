# Cost Governance

Maestro tracks the cost of every LLM call across all sessions and lets you set spending limits with configurable enforcement. This guide covers every cost feature available in the TUI (`/costs` commands) and CLI (`maestro costs`).

## Viewing Costs

### Status bar

The bottom status bar shows your aggregate spending for the current day:

```
$1.47 today
```

This value updates automatically every 60 seconds. If no costs have been recorded, the field is hidden.

When a daily limit is exceeded, the display changes:

- **`$5.12 today (LIMIT)`** -- red, bold. A `block` enforcement limit has been hit. Sessions are stopped.
- **`$5.12 today (!)`** -- yellow, bold. A `warn` enforcement limit has been hit. Sessions continue but you are over budget.

### /costs command

Type `/costs` (or `/costs summary`) in the TUI to see a full breakdown:

```
Cost Summary
  Today:      $1.47  (12 requests)
  This week:  $8.23  (67 requests)
  This month: $14.50 (142 requests)

Limits
  Per session: not set
  Per day:     $5.00  (remaining: $3.53)
  Per week:    $20.00 (remaining: $11.77)
  Per month:   not set
```

Fields:
- **Today / This week / This month** -- aggregated cost and request count for the time period.
- **Per session / Per day / Per week / Per month** -- configured limits. Shows "not set" if no limit is configured. When set, shows remaining budget.

### /costs status command

Type `/costs status` for a limit-focused view that shows whether any limit is currently exceeded and what enforcement mode is active:

```
  Daily limit EXCEEDED: $5.12 / $5.00 (enforcement: block)
    Executions are STOPPED
  Weekly: $8.23 / $20.00  (remaining: $11.77, enforcement: block)
```

Use `/costs status` when you want to quickly check if anything is blocked or approaching a threshold. Use `/costs` (summary) when you want a broader spending overview.

### /costs limits command

Type `/costs limits` to see only the configured limits without spending data:

```
Cost Limits
  Per session: (not set)
  Per day:     $5.00
  Per week:    $20.00
  Per month:   (not set)
```

### Spaces page

On the Spaces page (press `s`), each session row shows its accumulated cost in the `$X.XX` column. If a session has been stopped by a cost limit, a red **PAUSED** badge appears next to the session status.

### CLI

```bash
maestro costs summary
maestro costs summary --json
maestro costs limits
maestro costs limits --json
```

The `summary` subcommand also shows per-provider and per-model breakdowns when data is available.

## Setting Limits

### Basic usage

Set a single limit:

```
/costs set --per-day 5
```

This creates a daily limit of $5.00 with the default enforcement mode (`block`).

### All limit types

Set multiple limits at once:

```
/costs set --per-session 1 --per-day 5 --per-week 20 --per-month 50
```

Available flags:

| Flag | Scope | Resets |
|------|-------|--------|
| `--per-session` | Single session lifetime | Never (session-scoped) |
| `--per-day` | All sessions, current UTC day | Midnight UTC |
| `--per-week` | All sessions, current week (Mon-Sun) | Monday 00:00 UTC |
| `--per-month` | All sessions, current month | 1st of month 00:00 UTC |

Limits you do not specify in a `/costs set` call are left unchanged. For example, `/costs set --per-day 5` does not remove an existing per-week limit.

### No limits set (default)

When no limits are configured, cost tracking still records every LLM call, but nothing is enforced. Sessions run without spending restrictions.

### CLI alternative

```bash
maestro costs set-limit --per-day 5
maestro costs set-limit --per-session 1 --per-day 5 --per-week 20 --per-month 50
maestro costs set-limit --per-day 5 --enforcement warn --auto-resume
```

## Choosing Enforcement Mode

Each limit has an enforcement mode that controls what happens when the limit is exceeded. The default is `block`.

### block (default)

Stops session execution before the next block runs. The session goes to idle status, and the Spaces page shows **PAUSED**.

```
/costs set --per-day 5 --enforcement block
```

Use `block` when you need hard budget control -- no more LLM calls until you take action.

### warn

Shows a warning in the status bar (`(!)`) and sets session variables, but execution continues uninterrupted.

```
/costs set --per-day 5 --enforcement warn
```

Use `warn` when you want cost awareness without interrupting running work.

### Applying enforcement to multiple limits

The `--enforcement` flag applies to all limits in the same command:

```
/costs set --per-day 5 --per-week 20 --enforcement warn
```

Both the daily and weekly limits will use `warn` enforcement. To set different enforcement modes for different limits, run separate commands:

```
/costs set --per-day 5 --enforcement warn
/costs set --per-month 50 --enforcement block
```

## What Happens When a Limit is Hit

### Status bar indicator

- **`(LIMIT)`** in red -- enforcement is `block`, executions are stopped.
- **`(!)`** in yellow -- enforcement is `warn`, executions continue.

### Spaces page

Sessions stopped by a `block` limit show a red **PAUSED** badge. The session status remains `idle` (not `error`), so it is resumable.

### Graceful stopping

The block that is currently executing finishes normally. Only the **next** block in the workflow is prevented from starting. No work is lost mid-execution.

### Session variables set

When a limit is exceeded, the following session variables are set:

- `_costLimitExceeded` = `"true"`
- `_costLimitMessage` = human-readable description (e.g., "Daily limit of $5.00 exceeded (current: $5.12). Enforcement: block.")
- `_costLimitType` = which limit triggered (`session`, `daily`, `weekly`, `monthly`)

For `block` enforcement, additional variables:
- `_costStoppedAt` = ISO 8601 timestamp of when the stop occurred
- `_costStoppedEntryPoint` = the workflow that was running
- `_costStoppedNodeId` = the node that was about to execute
- `_costAutoResume` = `"true"` or `"false"`

### Priority

If multiple limits are exceeded simultaneously, `block` takes priority over `warn`. A single exceeded `block` limit stops execution even if other exceeded limits are `warn`.

## Resuming After a Limit is Hit

### Increase the limit

Raise the limit above current spending, then re-invoke the session:

```
/costs set --per-day 10
```

The next time a block executes, the pre-execution check will see that the new limit is not exceeded and clear the stop flags automatically.

### Change enforcement to warn

Switch the exceeded limit from `block` to `warn` so execution continues:

```
/costs set --per-day 5 --enforcement warn
```

### Auto-resume

Enable auto-resume so the session resumes automatically when the time-based quota resets (next day, next week, or next month):

```
/costs set --per-day 5 --auto-resume
```

How it works: before each block execution, Maestro checks if the cost period has rolled over since the session was stopped. If it has, all stop flags are cleared and execution continues.

Auto-resume applies only to time-based limits (`--per-day`, `--per-week`, `--per-month`). Per-session limits have no temporal reset, so `--auto-resume` has no effect on them.

## Clearing Limits

### TUI

```
/costs clear
```

Removes all limits (per-session, per-day, per-week, per-month). Cost tracking continues -- only enforcement is removed.

### CLI

There is no dedicated `clear` subcommand in the CLI. To disable a specific limit, set it to `0`:

```bash
maestro costs set-limit --per-day 0
```

Setting a limit to 0 effectively means every nonzero cost exceeds it, which is not the same as removing it. To fully clear limits via CLI, use the API directly or use the TUI `/costs clear` command.

## Cost Tracking Details

### Where costs are stored

Every LLM call records a cost entry in `.maestro/cost-history.jsonl` (one JSON line per entry). Each entry includes: session ID, block ID, model ID, provider ID, prompt tokens, completion tokens, cost in USD, and timestamp.

### Where limits are stored

Limits and pricing overrides are stored in `.maestro/cost-config.json`. This file is created automatically when you first set a limit.

### How pricing works

Pricing comes from the LLM-Provider service, which knows per-model input/output token prices. If a model's pricing is not available from the provider (e.g., local models), the cost defaults to $0.

You can override pricing for specific models by editing `.maestro/cost-config.json` directly:

```json
{
  "limits": { ... },
  "costOverrides": {
    "my-local-model": {
      "inputPricePerMillion": 0.50,
      "outputPricePerMillion": 1.50
    }
  }
}
```

### Session-level accumulation

Each session tracks its own accumulated cost in the `_accumulatedCost` variable (also `_accumulatedPromptTokens` and `_accumulatedCompletionTokens`). These are visible in the session's variable list and used for per-session limit checks.

## Quick Reference

| Command | Description |
|---------|-------------|
| `/costs` | Show cost summary with spending and limits |
| `/costs summary` | Same as `/costs` |
| `/costs status` | Show which limits are exceeded and enforcement state |
| `/costs limits` | Show only configured limits |
| `/costs set --per-day 5` | Set daily limit to $5 (block enforcement) |
| `/costs set --per-session 1` | Set per-session limit to $1 |
| `/costs set --per-week 20` | Set weekly limit to $20 |
| `/costs set --per-month 50` | Set monthly limit to $50 |
| `/costs set --per-day 5 --enforcement warn` | Set daily limit with warning-only enforcement |
| `/costs set --per-day 5 --auto-resume` | Set daily limit with automatic resume on period reset |
| `/costs set --per-day 5 --enforcement block --auto-resume` | Block enforcement with auto-resume |
| `/costs clear` | Remove all limits |
| `maestro costs summary` | CLI: show cost summary |
| `maestro costs limits` | CLI: show configured limits |
| `maestro costs set-limit --per-day 5` | CLI: set daily limit |
| `maestro costs set-limit --per-day 5 --enforcement warn --auto-resume` | CLI: set limit with warn + auto-resume |
| `maestro costs summary --json` | CLI: output raw JSON |
