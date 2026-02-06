# Phase 5: System Tool Blocks

**Date**: 3 février 2026
**Status**: Completed
**Prerequisites**: Phases 1-4 (Workspace, Sessions, CLI Executor, Maestro-CLI Block)

---

## Overview

Phase 5 creates system-level tool blocks that are available to all workspaces. These tools provide core functionality for training, evaluation, storage, and state management.

## Architecture

```
blocks/system/tools/
├── maestro-cli.tool.block.json          # CLI interface (Phase 4)
├── fitness-calculator.tool.block.json   # Fitness formula calculation
├── data-store.tool.block.json           # Workspace data persistence
├── metrics-collector.tool.block.json    # Metrics aggregation
├── leaderboard-manager.tool.block.json  # Model rankings
├── checkpoint-manager.tool.block.json   # Training state persistence
└── scripts/
    └── fitness-calculator.js            # Fitness calculation script
```

## Tool Blocks

### 1. Fitness Calculator (`system:fitness-calculator`)

Implements the Maestro fitness formula:

```
ModelFitness = (P × S × W) / (C_norm × C_compute × C_hw)^λ
```

**Inputs:**
- `executionMetrics`: Object with qualityScore, successRate, retryCount
- `modelId`: Model identifier (e.g., 'smollm2:1.7b')
- `taskType`: Task type for specialization (default: 'general')
- `configOverrides`: Override default fitness config

**Outputs:**
- `totalFitness`: Overall fitness score (0-1)
- `breakdown`: Component breakdown (P, S, W, costs)
- `interpretation`: Human-readable explanation
- `rank`: S/A/B/C/D/F ranking

### 2. Data Store (`system:data-store`)

Workspace data persistence using the CLI bridge.

**Actions:** read, write, list, delete, query

**Collections:** experiments, metrics, checkpoints, leaderboard

### 3. Metrics Collector (`system:metrics-collector`)

Collects and aggregates execution metrics.

**Actions:** record, aggregate, get, list, clear

**Aggregations:** mean, sum, min, max, last

### 4. Leaderboard Manager (`system:leaderboard-manager`)

Manages model fitness rankings.

**Actions:** update, get, list, compare, history

### 5. Checkpoint Manager (`system:checkpoint-manager`)

Training state persistence.

**Actions:** save, load, list, delete, prune

---

## Configuration

### Fitness Calculator Config

```json
{
  "lambda": 0.3,
  "weights": {
    "performance": 1.0,
    "specialization": 0.8,
    "composability": 0.9
  },
  "thresholds": {
    "S": 0.9,
    "A": 0.7,
    "B": 0.5,
    "C": 0.3,
    "D": 0.1
  }
}
```

### Default Model Profiles

| Model | Params | FLOPs | VRAM | RAM | GPU |
|-------|--------|-------|------|-----|-----|
| smollm2:135m | 135M | 1B | 0.5GB | 1GB | 0.1 |
| smollm2:1.7b | 1.7B | 5B | 4GB | 8GB | 0.5 |
| llama3:8b | 8B | 20B | 16GB | 32GB | 1.0 |
| mistral:7b | 7B | 18B | 14GB | 28GB | 0.9 |

---

## Usage Examples

### Calculate Fitness

```bash
maestro run system:fitness-calculator \
  --input modelId=smollm2:1.7b \
  --input-json '{"executionMetrics":{"qualityScore":75,"successRate":0.9}}'
```

### Store Data

```bash
maestro run system:data-store \
  --input action=write \
  --input collection=experiments \
  --input-json '{"data":{"id":"exp-001","status":"running"}}'
```

### Record Metrics

```bash
maestro run system:metrics-collector \
  --input action=record \
  --input experimentId=exp-001 \
  --input-json '{"metrics":{"loss":0.5,"accuracy":0.85}}'
```

---

## Files Created

| File | Purpose |
|------|---------|
| `blocks/system/tools/fitness-calculator.tool.block.json` | Fitness calculation tool |
| `blocks/system/tools/data-store.tool.block.json` | Data persistence tool |
| `blocks/system/tools/metrics-collector.tool.block.json` | Metrics aggregation tool |
| `blocks/system/tools/leaderboard-manager.tool.block.json` | Ranking management tool |
| `blocks/system/tools/checkpoint-manager.tool.block.json` | Checkpoint management tool |
| `blocks/system/tools/scripts/fitness-calculator.js` | Fitness calculation script |

---

## Integration with CLI

All tools are accessible via the CLI executor:

```
maestro list-tools
→ Lists all system tools

maestro run system:fitness-calculator --input modelId=...
→ Executes fitness calculation

maestro describe system:data-store
→ Shows tool documentation
```

---

## Next Steps

- Phase 6: Update AgentBlockExecutor to use maestro-cli as single tool
- Phase 7: Implement workspace-first block resolution
