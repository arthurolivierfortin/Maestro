# Phase-Specific Scoring: Quality Score vs Optimization Fitness

**Status**: Implemented
**Date**: February 6, 2026

---

## Overview

Phases now have distinct scoring models driven by their `_workflowConfig.evaluation` settings. This replaces the previous one-size-fits-all approach where every phase used the same `currentFitness < targetFitness` stop condition.

| Phase Type | Metric | Stop Condition | Goal |
|-----------|--------|---------------|------|
| **Quality** (creation, validation) | Score | Target-based: stop when score >= target | Produce output that meets quality criteria |
| **Optimization** (optimization) | Fitness | Plateau-based: stop after N consecutive non-improving runs | Reduce tokens without losing quality |

---

## Problem Solved

Previously, all phases shared the same behavior:
1. Generate output via LLM
2. Evaluate with criteria (hasJsonStructure, hasRequiredFields, minLength)
3. If `currentFitness >= targetFitness` → stop
4. "Fitness" and "score" were the same number

This caused:
- Optimization phase completed in 1 iteration (fitness already above target from Phase 1)
- No distinction between "is the output correct?" and "is the output efficient?"
- No mechanism to optimize for secondary goals (token reduction) while maintaining quality

---

## Architecture: Generic Infrastructure, Specific Content

### What the infrastructure provides (generic)

| Component | Description |
|-----------|-------------|
| `stopCondition` config read | Reads `evaluation.stopCondition` from per-phase workflow config |
| Plateau detection | Tracks `_bestFitness`, `_plateauCount`, sets `_shouldStop` when plateau reached |
| Quality floor check | Reads `evaluation.qualityFloor` and `evaluation.qualityCriteria`, penalizes fitness if quality drops |
| Token counting | `EstimateTokenCount()` → stores in `_tokenCount` |
| `_shouldStop` signal | Generic early-stop mechanism checked in while loop |
| `targetFitness` override | For plateau phases, sets target to 1.0 so while condition stays true |
| `tokenEfficiency` criterion | New evaluation criterion: fewer characters → higher score |

### What the template provides (specific)

```json
"creation": {
  "evaluation": {
    "criteria": ["hasJsonStructure", "hasRequiredFields", "minLength"],
    "stopCondition": "target"
  }
},
"optimization": {
  "evaluation": {
    "criteria": ["hasJsonStructure", "hasRequiredFields", "tokenEfficiency"],
    "qualityCriteria": ["hasJsonStructure", "hasRequiredFields"],
    "qualityFloor": 0.85,
    "stopCondition": "plateau",
    "plateauRuns": 5
  }
}
```

**Litmus test**: Can a new phase use a different stop condition by changing only JSON? **Yes.**

---

## Data Flow

```
Template JSON                    EntryPointExecutor (C#)              TUI Monitor (JS)
=============                    =======================              ================

evaluation.stopCondition  ─────► Phase reset:                         metrics-panel.js
  "target" | "plateau"           │ if plateau:                          reads _tokenCount
                                 │   targetFitness = 1.0               reads _qualityScore
evaluation.plateauRuns    ─────► │   (keeps while loop alive)          reads _plateauCount
  (default: 5)                   │                                      reads _bestFitness
                                 │
evaluation.qualityFloor   ─────► ExecuteValidationNode:               phase-workflow.js
  (default: -1 = disabled)       │ Compute fitness from criteria        shows tokenCount
                                 │ Compute quality from qualityCriteria  in done phases
evaluation.qualityCriteria ────► │ If quality < floor: penalize
                                 │ Track plateau: bestFitness, count
criteria: [tokenEfficiency] ───► │ If plateauCount >= plateauRuns:
                                 │   set _shouldStop = true
                                 │
                                 ▼ ExecuteWhileNodeAsync:
                                   Check _shouldStop before each iter
                                   → break if plateau detected
```

---

## Stop Conditions

### Target-based (default)

Used by: Phase 1 (creation), Phase 3 (validation), Phase 4 (publish)

```
while (currentFitness < targetFitness && iteration < maxIterations)
{
    // generate → write → validate
    // if fitness >= target → condition becomes false → loop exits
}
```

Exit reasons:
- `condition met (fitness: 0.95)` — target reached
- `max iterations reached (50/50)` — safety limit

### Plateau-based

Used by: Phase 2 (optimization)

```
targetFitness = 1.0  // Override: keep while condition true
_shouldStop = false

while (currentFitness < 1.0 && iteration < maxIterations)
{
    if (_shouldStop) break;  // ← plateau exit

    // generate → write → validate
    // validate: if fitness > bestFitness → reset plateau
    //           else → plateauCount++
    //           if plateauCount >= 5 → _shouldStop = true
}

targetFitness = originalTarget  // Restore for next phase
```

Exit reasons:
- `plateau (best: 0.95, no improvement for 5 runs)` — optimization converged
- `max iterations reached (50/50)` — safety limit

---

## Quality Floor Mechanism

During optimization, quality must not drop. The quality floor prevents the optimizer from producing shorter but broken output.

```
evaluation.qualityFloor = 0.85
evaluation.qualityCriteria = ["hasJsonStructure", "hasRequiredFields"]
```

Behavior:
1. Compute quality score from `qualityCriteria` only (excluding `tokenEfficiency`)
2. If `qualityScore < qualityFloor`:
   - Fitness = qualityScore * 0.5 (heavy penalty)
   - Log warning: "Quality below floor"
3. Quality score stored in `_qualityScore` for TUI display

This ensures the optimizer learns: "making output shorter is only good if quality is maintained."

---

## Token Efficiency Criterion

New evaluation criterion: `tokenEfficiency`

Scoring curve:
- ≤200 chars: 1.0 (maximum efficiency)
- 500 chars: ~0.95
- 1000 chars: ~0.87
- 2000 chars: ~0.70
- 5000 chars: ~0.20 (minimum)

Formula: `score = charCount <= 200 ? 1.0 : max(0.2, 1.0 - (charCount - 200) / 6000.0)`

Token count is estimated at ~4 chars per token and stored in `_tokenCount`.

---

## Session Variables

| Variable | Type | Description |
|----------|------|-------------|
| `currentFitness` | double | Weighted average of all criteria (quality + optimization) |
| `_qualityScore` | double | Quality-only score (excluding optimization criteria) |
| `_tokenCount` | int | Estimated token count of last output |
| `_bestFitness` | double | Highest fitness seen in current phase |
| `_plateauCount` | int | Consecutive iterations without improvement |
| `_shouldStop` | bool | Early-stop signal (set by plateau detection) |

All reset at the start of each phase.

---

## TUI Display

### Metrics Panel (header-right)

Phase 1 (target-based):
```
SESSION METRICS
  Fitness  ▓▓▓▓▓▓▓░░░ 95%/85%
  Iter     1/50
  Trend    ▇
```

Phase 2 (plateau-based):
```
SESSION METRICS
  Fitness  ▓▓▓▓▓▓▓▓▓░ 95%/85%
  Quality  95%/85%
  Tokens   ~26
  Iter     7  plateau: 5
  Trend    ▇▇▇▇▇▇▇
```

### Phase-Workflow (done phases)

```
✓ Phase 1: Creation [done] (1 iter, fitness 95%, ~2134 tok)
✓ Phase 2: Optimization [done] (7 iter, fitness 95%, ~26 tok, quality 95%)
● Phase 3: Validation [running]
  ...
```

---

## Files Changed

| File | Change |
|------|--------|
| `backend/.../EntryPointExecutor.cs` | Phase reset with plateau vars, `_shouldStop` check in while loop, plateau detection in validation, `targetFitness` override for plateau phases, `tokenEfficiency` criterion, `EstimateTokenCount()`, enhanced `StorePhaseSummary` |
| `data/.../foundry-default.session.json` | Phase 2 config with `stopCondition: "plateau"`, `plateauRuns: 5`, `tokenEfficiency` criterion, `qualityFloor`, `qualityCriteria` |
| `tools/.../components/metrics-panel.js` | Shows `_qualityScore`, `_tokenCount`, `_plateauCount` when available |
| `tools/.../components/phase-workflow.js` | Done phase summary includes token count and quality score |

---

## Verification

Tested with session `84927306`:

- [x] Phase 1 (creation): Completes in 1 iteration, fitness 0.95, target-based stop
- [x] Phase 2 (optimization): Runs 7 iterations, plateau detection active (count increments)
- [x] Phase 2: `targetFitness` overridden to 1.0 during phase, restored to 0.85 after
- [x] Phase 2: `_qualityScore` tracked separately (0.95), `_tokenCount` tracked (~26)
- [x] Phase 2: Phase summary includes `tokenCount` and `qualityScore`
- [x] Phase 3: Target restored to 0.85, runs normally with target-based stop
- [x] TUI: Metrics panel shows quality, tokens, plateau count when available
- [x] TUI: Done phases show token count in summary
- [x] `dotnet build` — 0 errors
- [x] Monitor — 0 errors across 50+ refresh cycles
- [x] No hardcoded session-specific logic in infrastructure
