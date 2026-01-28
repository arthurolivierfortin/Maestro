# GitHub Issue - Phase 7: Training, Metrics & Workflow Optimization System

> **Instructions**: Créer cette issue sur GitHub en copiant le contenu ci-dessous.
>
> **Title**: `Phase 7: Training, Metrics & Workflow Optimization System`
> **Labels**: `enhancement`, `phase-7`, `training`, `metrics`, `optimization`

---

## Executive Summary

This phase introduces a comprehensive **training and optimization system** for workflows, enabling:
- Systematic workflow improvement through iterative execution
- Detailed metrics collection at block, model, and workflow levels
- Multi-run comparisons for configuration optimization
- Cost/quality/speed trade-off analysis
- Support for automated and assisted workflow refinement

> **Full specification**: See [`docs/issues/phase-7-training-metrics-optimization.md`](./docs/issues/phase-7-training-metrics-optimization.md)

---

## Problem Statement

The current system can execute workflows but lacks:
1. **Detailed metrics** - Only basic `Duration`, `TokensUsed`, `CostEstimate` tracked
2. **Per-block/per-model tracking** - No granular visibility
3. **Training abstractions** - No concept of iterative runs for optimization
4. **Quality evaluation** - No scoring system for output quality
5. **Comparison tools** - Cannot compare different configurations
6. **Real-time monitoring** - ExecutionMonitorPage is a placeholder

---

## Vision Alignment

This phase directly supports the Maestro vision of:
- **Agents autonomes** capable of programming, testing, and managing repositories
- **Workflow optimization** to reduce costs while maintaining quality
- **Multi-actor access** (users, Claude Code, Maestro agents, training pipelines)

---

## Architecture Analysis

### Current Strengths
| Component | Status |
|-----------|--------|
| Clean Architecture | Strong - Domain → Application → Infrastructure → API |
| Block System | 11 types with atomic/composite distinction |
| Execution Engine | DAG-based, parallel execution, checkpointing |
| Model Types | Rich metadata with capabilities and constraints |
| Container Isolation | Docker, Process, Null runtimes available |

### Current Gaps
| Gap | Impact |
|-----|--------|
| `ExecutionMetrics` too basic | No per-block visibility |
| No historical metrics storage | Cannot track trends |
| No training abstractions | Cannot iterate systematically |
| Missing quality evaluation | Cannot assess output quality |
| ExecutionMonitorPage placeholder | No real-time visibility |

---

## Implementation Plan

### Phase 7A: Metrics Foundation (Week 1-2)
- [ ] Create domain entities: `BlockMetrics`, `ModelUsageMetrics`
- [ ] Implement `MetricsCollector` for execution tracking
- [ ] Modify `LLMProviderGateway` to return token/cost metrics
- [ ] Create `MetricsController` with retrieval endpoints
- [ ] Implement basic `MetricsDashboardPage`

### Phase 7B: Training Infrastructure (Week 2-3)
- [ ] Create `TrainingRun` and `TrainingConfiguration` entities
- [ ] Implement `TrainingExecutor` with iteration management
- [ ] Create `TrainingController` with CRUD and execution
- [ ] Implement `TrainingPage` with configuration form and progress

### Phase 7C: Quality Evaluation (Week 3-4)
- [ ] Implement `IQualityEvaluator` interface
- [ ] Create `HeuristicQualityEvaluator` (schema validation, output checks)
- [ ] Create `LLMQualityEvaluator` (LLM-based scoring)
- [ ] Integrate quality scoring into training pipeline
- [ ] Add quality visualization to UI

### Phase 7D: Comparison & Optimization (Week 4-5)
- [ ] Implement `ComparisonService` for multi-run comparison
- [ ] Implement `OptimizationEngine` for suggestions
- [ ] Create `ComparisonPage` with side-by-side view
- [ ] Implement `BenchmarkPage` for model comparison

### Phase 7E: Real-time Monitoring Enhancement (Week 5-6)
- [ ] Complete `ExecutionMonitorPage` with live metrics
- [ ] Add streaming metrics during execution
- [ ] Implement execution timeline visualization
- [ ] Add live cost accumulation display

### Phase 7F: CLI & External Integration (Week 6)
- [ ] Add CLI commands for training management
- [ ] Document API for external agents
- [ ] Add webhook support for training completion

---

## Key Entities

### Metrics Schema
```typescript
interface BlockMetrics {
  blockId: string;
  blockType: BlockType;
  durationMs: number;
  inputTokens?: number;
  outputTokens?: number;
  computeCostUsd: number;
  success: boolean;
  retryCount: number;
  modelId?: string;
}

interface WorkflowExecutionMetrics {
  executionId: string;
  totalDurationMs: number;
  totalCostUsd: number;
  costByModel: Record<string, number>;
  totalInputTokens: number;
  totalOutputTokens: number;
  blocksSucceeded: number;
  blocksFailed: number;
  qualityScore?: number;
  blockMetrics: BlockMetrics[];
}

interface TrainingRunMetrics {
  trainingRunId: string;
  totalIterations: number;
  completedIterations: number;
  averageDurationMs: number;
  durationVarianceMs: number;
  averageCostUsd: number;
  totalCostUsd: number;
  averageQualityScore?: number;
  consistencyScore: number;  // 0-100 (higher = more consistent)
}
```

### Training Configuration
```typescript
interface TrainingConfiguration {
  id: string;
  name: string;
  workflowId: string;
  iterations: number;              // 1-1000
  parallelIterations: number;      // 1-10
  optimizationGoal: 'cost' | 'quality' | 'speed' | 'balanced';
  goalWeights?: { cost: number; quality: number; speed: number };
  qualityEvaluation: {
    enabled: boolean;
    method: 'none' | 'heuristic' | 'llm' | 'custom';
  };
  constraints?: {
    maxCostPerIteration?: number;
    maxDurationPerIteration?: number;
    minQualityScore?: number;
  };
}
```

---

## API Endpoints

### Training
```
POST   /api/training                    # Create training configuration
GET    /api/training                    # List training configurations
POST   /api/training/{id}/runs          # Start training run
GET    /api/training/runs/{runId}       # Get training run details
POST   /api/training/runs/{runId}/pause # Pause training run
DELETE /api/training/runs/{runId}       # Cancel training run
```

### Metrics
```
GET    /api/metrics/executions/{id}     # Get execution metrics
GET    /api/metrics/runs/{runId}        # Get training run metrics
GET    /api/metrics/workflows/{id}      # Get workflow metrics (aggregated)
POST   /api/metrics/aggregate           # Custom aggregation query
GET    /api/metrics/export/{runId}      # Export metrics (CSV/JSON)
```

### Comparison
```
POST   /api/comparison                  # Compare multiple runs
GET    /api/comparison/{id}             # Get comparison result
POST   /api/comparison/suggest          # Get optimization suggestions
```

---

## Frontend Pages

| Page | Purpose |
|------|---------|
| `TrainingPage` | Create/manage training configurations, launch runs, view progress |
| `MetricsDashboardPage` | Visualize execution and training metrics |
| `ComparisonPage` | Side-by-side comparison of runs/configurations |
| `BenchmarkPage` | Model benchmarking and comparison |
| `ExecutionMonitorPage` | Real-time execution monitoring (currently placeholder) |

---

## Technical Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Metrics storage volume | Configurable retention, compression, sampling |
| LLM evaluation cost | Cache evaluations, optional feature |
| Memory during parallel iterations | Configurable limits, streaming results |
| Training interruption | Checkpoint after each iteration, resume capability |

---

## Success Criteria

- [ ] 100% of executions generate full metrics (block + model level)
- [ ] Training runs complete with >95% reliability
- [ ] Quality scores can be evaluated and tracked
- [ ] Comparison shows actionable differences
- [ ] External agents (Claude Code) can use training API
- [ ] Real-time monitoring shows <1s delay

---

## Dependencies

- [x] Phase 5C (Workflow Execution Engine) - COMPLETED
- [x] Phase 6A (Unified Block Source) - COMPLETED
- [x] SignalR infrastructure - AVAILABLE
- [x] Model registry - AVAILABLE

---

## Out of Scope (Future Phases)

- Automated workflow refactoring
- Multi-workflow comparison
- Cost prediction ML model
- A/B testing framework
- Distributed training across nodes
