# Phase Auto-Chaining + TUI Redesign (3-Zone Layout)

**Status**: Implemented
**Date**: February 6, 2026

---

## Overview

This deliverable adds two capabilities to Maestro's generic session infrastructure:

1. **Phase auto-chaining** -- The execution engine loops over all `_phases` automatically, with per-phase workflow config
2. **TUI redesign** -- Merged 3-zone layout replacing the previous 5-zone layout, with LLM activity chat view

Both changes respect the cardinal rule: **infrastructure is generic, content is specific**.

---

## Problems Solved

| Problem | Root Cause | Solution |
|---------|-----------|----------|
| Phases don't chain -- only the first pending phase runs | `ExecuteWorkflowAsync` ran one phase then returned | Generic `while(true)` loop over `FindFirstPendingPhase()` |
| No visibility on LLM outputs | TUI had no component for inference results | New `_llmActivity` variable + `llm-activity` TUI component |
| Wasted screen space | 5 separate zones (phases, tree, metrics, block-output, log) | 3 zones: phase-workflow (merged), llm-activity, exec-log |
| Metrics lost after layout change | Metrics panel removed | Condensed metrics line in header (fitness bar, sparkline, phase) |

---

## Architecture: Generic Infrastructure, Specific Content

### What the infrastructure provides (generic)

| Component | Description |
|-----------|-------------|
| Phase auto-chaining loop | Iterates over `_phases` array, executes each pending phase |
| Phase-aware config lookup | `GetWorkflowConfig(session, workflowId, phaseId)` reads nested config |
| `StorePhaseSummary()` | Stores `{iterations, fitness}` result in each phase object |
| `AppendToLLMActivity()` | FIFO-20 list tracking LLM calls (prompt, response, duration) |
| `phase-workflow` TUI component | Renders phases + tree from `_phases` + `_executionTree` |
| `llm-activity` TUI component | Renders chat view from `_llmActivity` |
| Header metrics line | Reads `currentFitness`, `currentIteration`, `scoreHistory`, `_phases` |

### What the template provides (specific)

| Variable | Content |
|----------|---------|
| `_phases` | `[{id:"creation",...}, {id:"optimization",...}, ...]` |
| `_workflowConfig` | Per-phase LLM prompts, temperatures, eval criteria |
| `_monitorDescriptor` | Layout mode `phased-v2` with 3 zones |
| `_llmActivity` | `[]` (initialized empty, populated at runtime) |
| `targetFitness` | `0.85` |
| `maxIterations` | `50` |

**Litmus test**: Can a new session type use phase auto-chaining with completely different phases, prompts, and criteria by changing only JSON? **Yes.**

---

## TUI Layout: Before and After

### Before (5 zones)

```
+----------+----------------------------+
| PHASES   | WORKFLOW TREE               |  50%
| (25%)    | (75%)                       |
+----------+----------------------------+
| METRICS  | BLOCK OUTPUT                |  25%
| (35%)    | (65%)                       |
+----------+----------------------------+
| EXECUTION LOG                          |  25%
| (100%)                                 |
+----------------------------------------+
```

### After (3 zones)

```
+------------------------------+-------------------+
| PHASES + WORKFLOW (55%)      | LLM ACTIVITY (45%)|  75%
|                              |                    |
| done Phase 1 (2 iter, 0.95) | --- generate ---   |
| > Phase 2 [running]         | > prompt preview   |
|   +-- Load Agent [done]     | < response preview |
|   +-- Loop [running]        |   777ch . 28.5s    |
|   |  +-- Run Training       |                    |
|   |  +-- Generate [LLM...]  | --- generate ---   |
|   |  +-- Validate [...]     | > prompt preview   |
|   +-- Finalize [...]        | < response preview |
| o Phase 3 [...]             |   179ch . 7.2s     |
| o Phase 4 [...]             |                    |
+------------------------------+-------------------+
| EXECUTION LOG (100%)                              |  25%
| 19:38 [info] Starting phase 'creation'            |
| 19:39 [success] Phase 'creation' completed        |
+---------------------------------------------------+
```

### Header (7 lines, includes metrics)

```
+---------------------------------------------------+
|                                                     |
|  > Phase-Chain-Test  f9af5c75  running  duration: 5m|
|  workflow: agent-improvement-loop                   |
|  >>>>>.. 78%  |  iter 3/50 .....  |  Phase: optim |
|                                                     |
+---------------------------------------------------+
```

---

## Data Flow

```
Template JSON                  EntryPointExecutor (C#)              TUI Monitor (JS)
=============                  =======================              ================

_phases [4 phases]  -------->  while(FindFirstPendingPhase())       phase-workflow.js
                               |  GetWorkflowConfig(wf, phaseId)     reads _phases
                               |  Reset iteration state               reads _executionTree
                               |  Execute config nodes                 renders merged view
                               |  StorePhaseSummary()
                               |  Mark phase done
                               +-> next phase

_workflowConfig     -------->  GetWorkflowConfig()                  (not directly read)
  .creation.llm                  looks up config[phaseId]
  .optimization.llm              falls back to config root
  .validation.llm
  .publish.llm

_llmActivity []     -------->  ExecuteLLMNodeAsync()                llm-activity.js
                                 AppendToLLMActivity()                reads _llmActivity
                                 {time, nodeId, prompt,               renders chat view
                                  response, length, duration}

_monitorDescriptor  -------->  (not read by backend)                session-monitor.js
  layout.mode: phased-v2                                              detectMode()
  zones: left, right, bottom                                          applyDescriptorLayout()
```

---

## Files Changed

| File | Change |
|------|--------|
| `backend/.../EntryPointExecutor.cs` | Phase loop, phase-aware config, StorePhaseSummary, LLM activity tracking, _llmActivity init |
| `data/foundry/templates/foundry-default.session.json` | Multi-phase _workflowConfig, _llmActivity, phased-v2 descriptor |
| `tools/.../components/phase-workflow.js` | **NEW** -- Merged phases+tree component |
| `tools/.../components/llm-activity.js` | **NEW** -- LLM chat view component |
| `tools/.../components/header.js` | Condensed metrics line (fitness bar, sparkline, phase) |
| `tools/.../session-monitor.js` | New boxes, 3-zone layout, new component wiring, header height 7 |

---

## Architecture Audit

| File | Compliant | Notes |
|------|-----------|-------|
| `EntryPointExecutor.cs` | Yes | All phase/config data read from session variables |
| `phase-workflow.js` | Yes | Reads `context.phases` + `context.executionTree` only |
| `llm-activity.js` | Yes | Reads `context.llmActivity` only |
| `header.js` | Yes | Reads generic variables (`currentFitness`, `_phases`, etc.) |
| `session-monitor.js` | Yes | `detectMode()` and `detectActiveWorkflow()` use generic variables only |
| `foundry-default.session.json` | Yes | All session-specific data (phases, prompts, criteria) in template |

**Previously hardcoded items removed:**
- `detectActiveWorkflow()`: removed hardcoded phase names (`exploration`, `optimization`, `validation`) and workflow name (`agent-improvement-loop`); now reads `_activeWorkflow` only
- `detectMode()`: removed hardcoded `vars.phase === 'optimization'`; uses generic `_executionTree` / `currentIteration` detection
- `ExecuteValidationNode()`: removed hardcoded validation hint mentioning specific criteria; now dynamically lists failing criteria names

---

## Verification Checklist

- [x] `dotnet build` -- 0 errors
- [x] Phase 1 executes and completes (fitness >= 0.85)
- [x] Phase 2 starts automatically (iteration state reset)
- [x] Phase summary stored in `_phases[].result`
- [x] `_llmActivity` populated with prompt/response/duration
- [x] TUI monitor: descriptor mode detected, 3-zone layout rendered
- [x] TUI monitor: zero errors in log across 300+ refresh cycles
- [x] Header metrics line visible (fitness bar, sparkline, phase name)
- [x] No hardcoded session-specific logic in infrastructure code
