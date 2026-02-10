# Fitness Levels Convention

**Date**: February 10, 2026
**Phase**: 14

---

## Overview

Maestro uses a three-level fitness system to evaluate blocks at different scales of complexity. Each level answers a different question:

| Level | Question | For |
|-------|----------|-----|
| **1: Block Fitness** | "How good is this component at its specific job?" | Atomic blocks (tool, validator, inference, prompt) |
| **2: Task Fitness** | "How well does this agent/workflow accomplish real tasks?" | Composite blocks (agent, workflow) |
| **3: Value Fitness** | "Is orchestration worth it compared to a single large model?" | Comparison of approaches |

Only Level 1 is implemented in Phase 14. Levels 2 and 3 are specified here for architectural consistency and future implementation.

---

## Level 1: Block Fitness (Implemented)

### Purpose

Measures the quality of a single atomic block on its specific task, penalizing cost, compute, and hardware demands. This is the existing Maestro V2 fitness formula.

### Formula

```
                    P x S x W
BlockFitness = -------------------------
               (C_norm x C_compute x C_hw)^lambda
```

### Components

| Symbol | Name | Range | Description | How to measure |
|--------|------|-------|-------------|----------------|
| P | Performance | [0-1] | Success rate on the target task | (qualityScore + testsPassRate) / 2 |
| S | Specialization | [0-inf] | Reward for focus, penalty for generality | P / max(taskEntropy, 0.1) |
| W | Composability | [0-1] | Integration quality in workflows | formatCompliance x (hallucinationDetected ? 0.5 : 1) |
| C_norm | Economic Cost | [0-inf] | Cost normalized to baseline | costUsd / baselineCost |
| C_compute | Compute Cost | [0-inf] | Cognitive footprint | log10(parameterCount) x (flopsPerToken / 1e9) |
| C_hw | Hardware Cost | [0-inf] | Infrastructure friction | alpha x VRAM + beta x RAM + gamma x GPU |
| lambda | Penalty Exponent | > 1 | Non-linear cost penalty | Recommended: 1.5 |

### Hardware cost coefficients

| Coefficient | Default | Purpose |
|-------------|---------|---------|
| alpha | 0.001 | VRAM weight (MB) |
| beta | 0.0001 | RAM weight (MB) |
| gamma | 1.0 | GPU requirement weight (1.0 if GPU required, 0.1 if not) |

### Effects

- Large models are penalized by high C_compute and C_hw
- Specialized blocks score higher S than generalist ones
- Blocks with clean output format score higher W
- The lambda exponent makes costs super-linear -- doubling cost more than halves fitness

### When to use

- After every training session iteration
- At publish time to record the block's fitness score
- For comparing blocks of the same type (tool vs tool, validator vs validator)

### Storage in manifest

```json
{
  "fitness": {
    "block": {
      "score": 0.95,
      "formula": "maestro-v2",
      "components": {
        "performance": 0.96,
        "specialization": 0.98,
        "composability": 0.94,
        "economicCost": 0.12,
        "computeCost": 0.30,
        "hardwareCost": 0.25,
        "lambda": 1.5
      },
      "testedAt": "2026-02-10",
      "sessionId": "session-abc-123"
    },
    "task": null,
    "value": null
  }
}
```

---

## Level 2: Task Fitness (Specified, Not Yet Implemented)

### Purpose

Measures how well an agent or workflow accomplishes real end-to-end tasks. Unlike Block Fitness, Task Fitness does not decompose into cost components -- it measures outcome quality across multiple dimensions.

### Why Block Fitness fails for agents

The Block Fitness formula penalizes orchestrated agents unfairly:
- An agent using 10 small LLMs has high aggregate cost (C_norm), even if each call is cheap
- Specialization (S) is low because agents are generalists by design
- Composability (W) varies across sub-agents

Task Fitness solves this by measuring what matters for agents: **can they accomplish tasks?**

### Formula

```
TaskFitness = (Completion x w1) + (Quality x w2) + (CostEfficiency x w3)
            + (Reliability x w4) + (Resilience x w5)
```

### Dimensions

| Dimension | Default Weight | Range | Description | How to evaluate |
|-----------|---------------|-------|-------------|-----------------|
| Completion | 0.35 | [0-1] | Percentage of benchmark tasks completed successfully | N tasks, count correct completions |
| Quality | 0.25 | [0-1] | Average quality of produced results | Evaluator (LLM or human) scores each output |
| CostEfficiency | 0.20 | [0-1] | Quality obtained per unit of cost | Normalized: quality / totalCost, scaled to [0-1] |
| Reliability | 0.10 | [0-1] | Consistency of results across repeated runs | 1 - variance across N runs of the same task |
| Resilience | 0.10 | [0-1] | Recovery rate after partial failures | Inject faults, measure recovery percentage |

Weights are configurable per benchmark. The defaults above reflect a balance between capability (completion, quality) and operational qualities (cost, reliability, resilience).

### Benchmarking

Task Fitness is evaluated against a benchmark -- a workflow block that defines a set of tasks:

```json
{
  "id": "benchmark:coding-tasks-v1",
  "type": "workflow",
  "config": {
    "tasks": [
      {
        "id": "task-01",
        "description": "Write a sorting function",
        "input": "...",
        "expectedOutput": "...",
        "evaluator": "validator:code-correctness"
      }
    ],
    "runs": 3,
    "measureResilience": true
  }
}
```

Benchmarks are content (JSON), not infrastructure (C#). They follow the cardinal rule.

### When to use

- When evaluating an agent or composite workflow
- For comparing agents that solve the same type of problem
- At publish time for agent-type blocks

### Storage in manifest

```json
{
  "fitness": {
    "block": null,
    "task": {
      "score": 0.78,
      "dimensions": {
        "completion": 0.82,
        "quality": 0.75,
        "costEfficiency": 0.70,
        "reliability": 0.85,
        "resilience": 0.60
      },
      "weights": {
        "completion": 0.35,
        "quality": 0.25,
        "costEfficiency": 0.20,
        "reliability": 0.10,
        "resilience": 0.10
      },
      "benchmark": "benchmark:coding-tasks-v1",
      "runs": 3,
      "testedAt": "2026-02-10"
    },
    "value": null
  }
}
```

---

## Level 3: Value Fitness (Specified, Future Implementation)

### Purpose

Answers the question: **"Is this orchestrated agent worth using instead of just calling a single large model?"**

Value Fitness compares an orchestrated approach against a baseline (typically a single powerful model like Claude or GPT-4) on the same benchmark tasks.

### Formula

```
ValueFitness = QualityDelta x (1 / CostRatio) x (1 + ResilienceBonus)
             x (1 + ModularityBonus) x (1 + VendorIndependence)
```

### Components

| Component | Description | Calculation |
|-----------|-------------|-------------|
| QualityDelta | Quality improvement vs baseline | TaskFitness(agent) - TaskFitness(baseline) |
| CostRatio | Cost comparison | totalCost(agent) / totalCost(baseline). > 1 means agent costs more |
| ResilienceBonus | Fault tolerance advantage | (agent recovery rate) - (baseline recovery rate) on fault injection tests |
| ModularityBonus | Component replaceability | swappableComponents / totalComponents |
| VendorIndependence | Provider diversification | 1 - (costOnLargestProvider / totalCost) |

### Interpretation

| ValueFitness | Meaning |
|-------------|---------|
| > 1.0 | Orchestration is worth it -- the agent provides more value than the baseline |
| = 1.0 | Break-even -- orchestration provides equivalent value |
| < 1.0 | Not worth it -- use the single large model directly |

### When to use

- When publishing an agent to the catalogue, to help users decide if the orchestrated approach is worthwhile
- For strategic decisions about when to decompose vs when to use a single model
- Requires that a baseline single-model result exists for the same benchmark

### Storage in manifest

```json
{
  "fitness": {
    "block": null,
    "task": {
      "score": 0.78,
      "dimensions": { "..." : "..." },
      "benchmark": "benchmark:coding-tasks-v1",
      "runs": 3,
      "testedAt": "2026-02-10"
    },
    "value": {
      "score": 1.12,
      "baseline": "claude-opus-4-direct",
      "qualityDelta": 0.15,
      "costRatio": 2.0,
      "testedAt": "2026-02-10"
    }
  }
}
```

---

## When to Use Each Level

| Block type | Level 1 (Block) | Level 2 (Task) | Level 3 (Value) |
|------------|-----------------|-----------------|------------------|
| `tool` | Yes | No | No |
| `validator` | Yes | No | No |
| `inference` | Yes | No | No |
| `prompt` | Yes | No | No |
| `script` | Yes | No | No |
| `agent` | No | Yes | Optional |
| `workflow` | No | Yes | Optional |
| `decision` | Yes | No | No |
| `trigger` | Yes | No | No |

**Rule**: Atomic blocks use Block Fitness. Composite blocks use Task Fitness. Value Fitness is an optional addition for composite blocks when a baseline comparison exists.

---

## Implementation Status

| Level | Status | Phase |
|-------|--------|-------|
| Level 1: Block Fitness | Implemented | Phase 14 |
| Level 2: Task Fitness | Specified only | Future (estimated Phase 15-16) |
| Level 3: Value Fitness | Specified only | Future (estimated Phase 17+) |

The manifest schema supports all three levels from Phase 14 onward. Unimplemented levels are stored as `null` in the manifest. This avoids schema migrations when the higher levels are implemented.

---

## CLI Display

### Block Fitness (atomic block)

```
$ maestro block info user:gen-commit

  Fitness:
    Block:  0.95 (maestro-v2)
      P: 0.96 | S: 0.98 | W: 0.94
      Costs: econ=0.12 compute=0.30 hw=0.25 lambda=1.5
    Task:   n/a (atomic block)
    Value:  n/a
```

### Task Fitness (composite agent)

```
$ maestro block info user:coding-agent-v1

  Fitness:
    Block:  n/a (composite)
    Task:   0.78 (benchmark:coding-tasks-v1, 3 runs)
      Completion:  ||||||||.. 82%
      Quality:     |||||||... 75%
      Cost-Eff:    |||||||... 70%
      Reliability: ||||||||.. 85%
      Resilience:  ||||||.... 60%
    Value:  n/a (no baseline)
```

---

*"One metric to rule them all -- but adapted to the scale of what it measures."*
