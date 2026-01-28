# Phase 7: Training, Metrics & Workflow Optimization System

## Executive Summary

This phase introduces a comprehensive **training and optimization system** for workflows, enabling:
- Systematic workflow improvement through iterative execution
- Detailed metrics collection at block, model, and workflow levels
- Multi-run comparisons for configuration optimization
- Cost/quality/speed trade-off analysis
- Support for automated and assisted workflow refinement

---

## 1. Analysis of Current Architecture

### 1.1 Current Strengths

| Component | Status | Notes |
|-----------|--------|-------|
| Clean Architecture | Strong | Domain → Application → Infrastructure → API layers well-separated |
| Block System | Complete | 11 block types with clear atomic/composite distinction |
| BlockTypeRegistry | Mature | Centralized validation, containment rules, factory patterns |
| Execution Engine | Functional | DAG-based, parallel execution, retry logic, checkpointing |
| Model Types | Rich | `model.types.ts` includes capabilities, constraints, scoring |
| Container Isolation | Abstracted | Docker, Process, Null runtimes available |
| Real-time Events | Available | SignalR infrastructure in place |

### 1.2 Current Terminology Assessment

| Concept | Definition | Adequacy | Issues |
|---------|------------|----------|--------|
| **Block** | Atomic/composite unit of computation | Adequate | Clear and well-defined |
| **Workflow** | Container of connected blocks (DAG) | Adequate | Serves its purpose |
| **Agent** | Composite block with AI reasoning | Ambiguous | Conflates "AI agent" and "block container" |
| **Task** | Composite with validation criteria | Ambiguous | Overlaps with "job", "step", unclear purpose |
| **Inference** | Low-level LLM call unit | Good | Clear for meta-optimization use cases |

**Recommendations:**
- **Agent**: Consider renaming to `AIUnit` or `ReasoningBlock` to avoid confusion with autonomous agents that use Maestro
- **Task**: Consider renaming to `ValidatedStep` or `CheckpointBlock` to clarify its validation-centric purpose
- Keep terminology changes minimal if backwards compatibility is critical

### 1.3 Critical Gaps for Training Phase

#### 1.3.1 Metrics System (Major Gap)

**Current State:**
```csharp
// ExecutionMetrics.cs - Too basic
public class ExecutionMetrics
{
    public TimeSpan Duration { get; set; }
    public int TokensUsed { get; set; }
    public decimal? CostEstimate { get; set; }
}
```

**Missing:**
- Per-block metrics (execution time, input/output size, error rate)
- Per-model metrics (tokens in/out, latency, cost, success rate)
- Quality metrics (score, validation pass rate, heuristic evaluation)
- Consistency metrics (variance across iterations)
- Historical aggregation and trending

#### 1.3.2 Training Abstractions (Not Present)

Missing entities:
- `TrainingRun` / `Experiment` - A session of multiple executions
- `TrainingConfiguration` - Iteration count, optimization goals, constraints
- `RunComparison` - Side-by-side analysis of multiple runs
- `OptimizationSuggestion` - Automated recommendations

#### 1.3.3 Frontend Pages (Incomplete)

| Page | Status | Purpose |
|------|--------|---------|
| ExecutionMonitorPage | Placeholder | Real-time execution monitoring |
| TrainingPage | Missing | Launch and configure training sessions |
| MetricsDashboardPage | Missing | Visualize metrics and trends |
| ComparisonPage | Missing | Compare runs/configurations |
| BenchmarkPage | Missing | Model benchmarking UI |

#### 1.3.4 API Endpoints (Missing)

- Training session management (CRUD)
- Metrics retrieval and aggregation
- Comparison and analysis endpoints
- Export/import for external analysis

---

## 2. Proposed Architecture

### 2.1 Domain Layer Extensions

```
Maestro.Domain/
├── Entities/
│   ├── TrainingRun.cs           # Training session entity
│   ├── TrainingConfiguration.cs # Config for training runs
│   └── ExecutionMetricsSnapshot.cs
├── ValueObjects/
│   ├── BlockMetrics.cs          # Per-block execution metrics
│   ├── ModelUsageMetrics.cs     # Per-model usage tracking
│   ├── QualityScore.cs          # Quality assessment value object
│   ├── ConsistencyScore.cs      # Variance/consistency tracking
│   ├── CostBreakdown.cs         # Detailed cost analysis
│   └── OptimizationGoal.cs      # Cost | Quality | Speed | Balanced
└── Aggregates/
    └── TrainingSession.cs       # Aggregate root for training
```

### 2.2 Application Layer Extensions

```
Maestro.Application/
├── DTOs/
│   ├── TrainingRunDto.cs
│   ├── TrainingConfigDto.cs
│   ├── MetricsDto.cs
│   ├── BlockMetricsDto.cs
│   ├── ModelMetricsDto.cs
│   ├── ComparisonResultDto.cs
│   └── OptimizationSuggestionDto.cs
├── Interfaces/
│   ├── ITrainingService.cs
│   ├── IMetricsRepository.cs
│   ├── IMetricsAggregator.cs
│   ├── IComparisonService.cs
│   ├── IQualityEvaluator.cs
│   └── IOptimizationEngine.cs
└── Services/
    └── TrainingCoordinator.cs   # Orchestrates training runs
```

### 2.3 Infrastructure Layer Extensions

```
Maestro.Infrastructure/
├── Metrics/
│   ├── MetricsCollector.cs           # Collects metrics during execution
│   ├── MetricsAggregator.cs          # Aggregates and computes stats
│   ├── FileSystemMetricsRepository.cs
│   └── InMemoryMetricsCache.cs
├── Training/
│   ├── TrainingExecutor.cs           # Runs multiple iterations
│   ├── ComparisonService.cs          # Compares runs
│   ├── QualityEvaluator.cs           # Heuristic + LLM evaluation
│   └── OptimizationEngine.cs         # Suggests improvements
├── LLMGateway/
│   └── MetricsAwareLLMGateway.cs     # LLM gateway with metrics tracking
└── Persistence/
    ├── TrainingRunRepository.cs
    └── MetricsSnapshotRepository.cs
```

### 2.4 API Layer Extensions

```
Maestro.Api/
├── Controllers/
│   ├── TrainingController.cs         # Training CRUD + execution
│   ├── MetricsController.cs          # Metrics retrieval
│   └── ComparisonController.cs       # Comparison endpoints
└── Hubs/
    └── TrainingHub.cs                # Real-time training updates
```

### 2.5 Frontend Extensions

```
frontend/src/
├── pages/
│   ├── TrainingPage.tsx              # Training session management
│   ├── MetricsDashboardPage.tsx      # Metrics visualization
│   ├── ComparisonPage.tsx            # Run comparisons
│   └── BenchmarkPage.tsx             # Model benchmarks
├── components/
│   ├── Training/
│   │   ├── TrainingConfigForm.tsx
│   │   ├── TrainingRunList.tsx
│   │   ├── TrainingProgress.tsx
│   │   └── IterationViewer.tsx
│   ├── Metrics/
│   │   ├── MetricsChart.tsx
│   │   ├── CostBreakdown.tsx
│   │   ├── QualityGauge.tsx
│   │   └── BlockMetricsTable.tsx
│   └── Comparison/
│       ├── ComparisonTable.tsx
│       ├── DiffViewer.tsx
│       └── RecommendationCard.tsx
├── store/
│   ├── trainingStore.ts
│   └── metricsStore.ts
├── services/
│   ├── trainingService.ts
│   └── metricsService.ts
└── types/
    ├── training.types.ts
    └── metrics.types.ts
```

---

## 3. Metrics Schema

### 3.1 BlockMetrics

```typescript
interface BlockMetrics {
  blockId: string;
  blockType: BlockType;
  executionId: string;

  // Timing
  startedAt: string;
  completedAt: string;
  durationMs: number;
  queueTimeMs: number;        // Time waiting to execute

  // I/O
  inputSizeBytes: number;
  outputSizeBytes: number;
  inputTokens?: number;       // If LLM-based
  outputTokens?: number;      // If LLM-based

  // Cost
  computeCostUsd: number;

  // Status
  success: boolean;
  retryCount: number;
  errorCode?: string;

  // Model (if applicable)
  modelId?: string;
  modelProvider?: string;
}
```

### 3.2 ModelUsageMetrics

```typescript
interface ModelUsageMetrics {
  modelId: string;
  provider: ModelProvider;
  executionId: string;

  // Token usage
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;

  // Timing
  latencyMs: number;
  timeToFirstTokenMs?: number;
  tokensPerSecond?: number;

  // Cost
  inputCostUsd: number;
  outputCostUsd: number;
  totalCostUsd: number;

  // Quality (if evaluated)
  qualityScore?: number;       // 0-100
  evaluationMethod?: 'heuristic' | 'llm' | 'human' | 'automated';
}
```

### 3.3 WorkflowExecutionMetrics

```typescript
interface WorkflowExecutionMetrics {
  executionId: string;
  workflowId: string;
  trainingRunId?: string;      // If part of training
  iterationNumber?: number;    // Which iteration in training

  // Aggregated timing
  totalDurationMs: number;
  blockExecutionTimeMs: number;
  overheadTimeMs: number;

  // Aggregated cost
  totalCostUsd: number;
  costByModel: Record<string, number>;
  costByBlockType: Record<BlockType, number>;

  // Token aggregation
  totalInputTokens: number;
  totalOutputTokens: number;
  tokensByModel: Record<string, { input: number; output: number }>;

  // Success metrics
  blocksTotal: number;
  blocksSucceeded: number;
  blocksFailed: number;
  blocksSkipped: number;
  totalRetries: number;

  // Quality (if evaluated)
  qualityScore?: number;
  qualityDetails?: QualityEvaluation;

  // Block-level metrics
  blockMetrics: BlockMetrics[];
  modelMetrics: ModelUsageMetrics[];
}
```

### 3.4 TrainingRunMetrics

```typescript
interface TrainingRunMetrics {
  trainingRunId: string;
  workflowId: string;
  configurationId: string;

  // Configuration
  totalIterations: number;
  completedIterations: number;
  failedIterations: number;

  // Aggregated stats
  averageDurationMs: number;
  durationVarianceMs: number;
  minDurationMs: number;
  maxDurationMs: number;

  averageCostUsd: number;
  totalCostUsd: number;
  costVarianceUsd: number;

  averageQualityScore?: number;
  qualityVariance?: number;

  // Consistency score (lower variance = more consistent)
  consistencyScore: number;  // 0-100

  // Per-iteration metrics
  iterationMetrics: WorkflowExecutionMetrics[];

  // Timestamps
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
}
```

---

## 4. Training Configuration Schema

```typescript
interface TrainingConfiguration {
  id: string;
  name: string;
  description?: string;

  // Target workflow
  workflowId: string;

  // Iteration settings
  iterations: number;              // Number of runs (1-1000)
  parallelIterations: number;      // Max concurrent (1-10)
  delayBetweenIterationsMs: number;

  // Input variation
  inputVariation: InputVariationConfig;

  // Optimization goal
  optimizationGoal: OptimizationGoal;
  goalWeights?: {
    cost: number;      // 0-1
    quality: number;   // 0-1
    speed: number;     // 0-1
  };

  // Quality evaluation
  qualityEvaluation: QualityEvaluationConfig;

  // Constraints
  constraints?: {
    maxCostPerIteration?: number;
    maxDurationPerIteration?: number;
    stopOnFailure?: boolean;
    minQualityScore?: number;
  };

  // Model overrides (for A/B testing)
  modelOverrides?: Record<string, string>;  // blockId -> modelId

  // Environment
  containerConfig?: ContainerConfig;
  environmentVariables?: Record<string, string>;

  // Metadata
  createdAt: string;
  createdBy: string;
  tags?: string[];
}

interface InputVariationConfig {
  type: 'fixed' | 'dataset' | 'generated';
  fixedInputs?: Record<string, unknown>;
  datasetPath?: string;
  generatorConfig?: {
    generatorType: 'random' | 'llm' | 'permutation';
    seed?: number;
    parameters?: Record<string, unknown>;
  };
}

interface QualityEvaluationConfig {
  enabled: boolean;
  method: 'none' | 'heuristic' | 'llm' | 'custom';

  // Heuristic evaluation
  heuristics?: {
    checkOutputNotEmpty?: boolean;
    checkJsonValid?: boolean;
    checkSchemaCompliance?: string;  // JSON Schema
    customChecks?: string[];         // Script paths
  };

  // LLM evaluation
  llmEvaluation?: {
    modelId: string;
    evaluationPrompt: string;
    scoreRange: [number, number];
    criteria: string[];
  };

  // Custom evaluation
  customEvaluator?: {
    scriptPath: string;
    language: 'javascript' | 'python';
  };
}
```

---

## 5. API Endpoints

### 5.1 Training Endpoints

```
POST   /api/training                    # Create training configuration
GET    /api/training                    # List training configurations
GET    /api/training/{id}               # Get training configuration
PUT    /api/training/{id}               # Update training configuration
DELETE /api/training/{id}               # Delete training configuration

POST   /api/training/{id}/runs          # Start training run
GET    /api/training/{id}/runs          # List runs for configuration
GET    /api/training/runs/{runId}       # Get training run details
POST   /api/training/runs/{runId}/pause # Pause training run
POST   /api/training/runs/{runId}/resume # Resume training run
DELETE /api/training/runs/{runId}       # Cancel training run
```

### 5.2 Metrics Endpoints

```
GET    /api/metrics/executions/{id}     # Get execution metrics
GET    /api/metrics/runs/{runId}        # Get training run metrics
GET    /api/metrics/workflows/{id}      # Get workflow metrics (aggregated)
GET    /api/metrics/models/{id}         # Get model usage metrics
GET    /api/metrics/blocks/{id}         # Get block metrics (aggregated)

POST   /api/metrics/aggregate           # Custom aggregation query
GET    /api/metrics/export/{runId}      # Export metrics (CSV/JSON)
```

### 5.3 Comparison Endpoints

```
POST   /api/comparison                  # Compare multiple runs
GET    /api/comparison/{id}             # Get comparison result
POST   /api/comparison/suggest          # Get optimization suggestions
```

---

## 6. Implementation Plan

### Phase 7A: Metrics Foundation (Week 1-2)

**Objective:** Implement comprehensive metrics collection infrastructure

**Backend Tasks:**
1. Create domain entities: `BlockMetrics`, `ModelUsageMetrics`, `ExecutionMetricsSnapshot`
2. Create DTOs for metrics transfer
3. Implement `IMetricsCollector` interface and `MetricsCollector` class
4. Modify `ExecutionEngine` to emit metrics during execution
5. Modify `LLMProviderGateway` to track and return token/cost metrics
6. Implement `IMetricsRepository` and `FileSystemMetricsRepository`
7. Create `MetricsController` with basic retrieval endpoints
8. Add SignalR events for real-time metrics updates

**Frontend Tasks:**
1. Create `metrics.types.ts` with all metric interfaces
2. Create `metricsStore.ts` for state management
3. Create `metricsService.ts` for API calls
4. Implement basic `MetricsDashboardPage` with execution metrics display

**Tests:**
- Unit tests for MetricsCollector
- Integration tests for metrics persistence
- E2E test for metrics flow during execution

**Acceptance Criteria:**
- [ ] Every block execution generates BlockMetrics
- [ ] Every LLM call generates ModelUsageMetrics
- [ ] Metrics are persisted after execution
- [ ] Metrics are retrievable via API
- [ ] MetricsDashboardPage displays basic metrics

---

### Phase 7B: Training Infrastructure (Week 2-3)

**Objective:** Implement training run orchestration

**Backend Tasks:**
1. Create domain entities: `TrainingRun`, `TrainingConfiguration`
2. Create DTOs: `TrainingRunDto`, `TrainingConfigDto`
3. Implement `ITrainingService` interface
4. Implement `TrainingExecutor` with iteration management
5. Implement `TrainingRunRepository` for persistence
6. Create `TrainingController` with full CRUD and execution endpoints
7. Add `TrainingHub` for real-time training updates

**Frontend Tasks:**
1. Create `training.types.ts` with all training interfaces
2. Create `trainingStore.ts` for state management
3. Create `trainingService.ts` for API calls
4. Implement `TrainingPage` with:
   - Configuration creation form
   - Training run list
   - Real-time progress visualization
   - Iteration results viewer

**Tests:**
- Unit tests for TrainingExecutor
- Integration tests for training run lifecycle
- E2E test for training session

**Acceptance Criteria:**
- [ ] Training configuration can be created/saved
- [ ] Training run executes N iterations
- [ ] Progress is visible in real-time
- [ ] Training can be paused/resumed/cancelled
- [ ] All iteration results are stored and retrievable

---

### Phase 7C: Quality Evaluation (Week 3-4)

**Objective:** Implement quality scoring system

**Backend Tasks:**
1. Create `QualityScore` value object
2. Implement `IQualityEvaluator` interface
3. Implement `HeuristicQualityEvaluator` (schema, output checks)
4. Implement `LLMQualityEvaluator` (LLM-based scoring)
5. Implement `CustomQualityEvaluator` (script-based)
6. Integrate quality evaluation into training pipeline
7. Add quality metrics to API responses

**Frontend Tasks:**
1. Add quality configuration UI to TrainingConfigForm
2. Implement `QualityGauge` component
3. Show quality scores in metrics dashboard
4. Add quality trends visualization

**Tests:**
- Unit tests for each evaluator type
- Integration tests for evaluation during training
- Quality score validation tests

**Acceptance Criteria:**
- [ ] Heuristic evaluation works (output validation)
- [ ] LLM evaluation works (prompt-based scoring)
- [ ] Quality scores are tracked per iteration
- [ ] Quality trends are visible in UI
- [ ] Consistency score is calculated

---

### Phase 7D: Comparison & Optimization (Week 4-5)

**Objective:** Enable comparison and optimization suggestions

**Backend Tasks:**
1. Implement `IComparisonService` interface
2. Implement `ComparisonService` with:
   - Multi-run comparison
   - Model comparison
   - Configuration comparison
3. Implement `IOptimizationEngine` interface
4. Implement `OptimizationEngine` with:
   - Cost reduction suggestions
   - Quality improvement suggestions
   - Model swap recommendations
5. Create comparison endpoints
6. Create suggestion endpoints

**Frontend Tasks:**
1. Implement `ComparisonPage` with:
   - Run selection UI
   - Side-by-side comparison table
   - Visual diff for metrics
2. Implement `RecommendationCard` component
3. Add "Apply recommendation" functionality
4. Implement `BenchmarkPage` for model comparison

**Tests:**
- Unit tests for comparison logic
- Unit tests for optimization suggestions
- Integration tests for comparison API
- E2E test for comparison workflow

**Acceptance Criteria:**
- [ ] Multiple runs can be compared
- [ ] Comparison shows clear differences
- [ ] System suggests optimizations
- [ ] Suggestions can be applied
- [ ] Model benchmarks are executable

---

### Phase 7E: Real-time Monitoring Enhancement (Week 5-6)

**Objective:** Complete execution monitoring with live metrics

**Backend Tasks:**
1. Enhance `SignalRExecutionMonitor` with detailed events
2. Add streaming metrics during execution
3. Implement live cost tracking
4. Add execution timeline events

**Frontend Tasks:**
1. Complete `ExecutionMonitorPage` implementation:
   - Live execution graph visualization
   - Real-time metrics updates
   - Block-level progress
   - Live log streaming
   - Cost accumulation display
2. Implement `BlockMetricsTable` with live updates
3. Add execution timeline component

**Tests:**
- SignalR event integration tests
- Frontend component tests for real-time updates
- Performance test for high-frequency updates

**Acceptance Criteria:**
- [ ] Execution shows live progress on graph
- [ ] Metrics update in real-time
- [ ] Logs stream during execution
- [ ] Cost accumulates visibly
- [ ] Timeline shows execution flow

---

### Phase 7F: CLI & External Integration (Week 6)

**Objective:** Enable CLI and external agent access

**CLI Tasks:**
1. Add `maestro training create` command
2. Add `maestro training run` command
3. Add `maestro training status` command
4. Add `maestro metrics export` command
5. Add `maestro compare` command

**API Tasks:**
1. Add API key authentication for external access
2. Document API for external agents (Claude Code, etc.)
3. Create OpenAPI/Swagger spec
4. Add webhook support for training completion

**Tests:**
- CLI command tests
- API authentication tests
- Webhook delivery tests

**Acceptance Criteria:**
- [ ] CLI can manage training runs
- [ ] External agents can use API
- [ ] API documentation is complete
- [ ] Webhooks notify on completion

---

## 7. Technical Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Metrics storage volume | High disk usage with many iterations | Implement configurable retention, compression, sampling |
| LLM evaluation cost | High cost for quality evaluation | Cache evaluations, batch processing, optional feature |
| Memory during parallel iterations | OOM for many parallel runs | Configurable limits, streaming results |
| SignalR scalability | Bottleneck with many subscribers | Event batching, selective subscription |
| Training interruption | Data loss on crash | Checkpoint after each iteration, resume capability |

---

## 8. Success Metrics

At the end of Phase 7, the system should demonstrate:

1. **Metrics Completeness**: 100% of executions have full metrics
2. **Training Reliability**: >95% training runs complete successfully
3. **Quality Evaluation**: Quality scores correlate with expected outcomes
4. **Optimization Impact**: Suggestions reduce cost/improve quality by measurable amount
5. **Real-time Accuracy**: <1s delay for live metrics updates
6. **External Access**: Claude Code can successfully run training via API

---

## 9. Dependencies

- Phase 5C (Workflow Execution Engine) - COMPLETED
- Phase 6A (Unified Block Source) - COMPLETED
- SignalR infrastructure - AVAILABLE
- Model registry - AVAILABLE

---

## 10. Out of Scope (Future Phases)

- Automated workflow refactoring (Phase 8)
- Multi-workflow comparison (Phase 8)
- Cost prediction ML model (Phase 9)
- A/B testing framework (Phase 9)
- Distributed training across nodes (Phase 10)

---

## Appendix A: File Structure Summary

```
backend/
├── src/
│   ├── Maestro.Domain/
│   │   ├── Entities/
│   │   │   ├── TrainingRun.cs
│   │   │   ├── TrainingConfiguration.cs
│   │   │   └── ExecutionMetricsSnapshot.cs
│   │   └── ValueObjects/
│   │       ├── BlockMetrics.cs
│   │       ├── ModelUsageMetrics.cs
│   │       ├── QualityScore.cs
│   │       ├── ConsistencyScore.cs
│   │       └── CostBreakdown.cs
│   ├── Maestro.Application/
│   │   ├── DTOs/
│   │   │   ├── TrainingRunDto.cs
│   │   │   ├── TrainingConfigDto.cs
│   │   │   ├── MetricsDto.cs
│   │   │   └── ComparisonResultDto.cs
│   │   ├── Interfaces/
│   │   │   ├── ITrainingService.cs
│   │   │   ├── IMetricsRepository.cs
│   │   │   ├── IMetricsAggregator.cs
│   │   │   ├── IComparisonService.cs
│   │   │   ├── IQualityEvaluator.cs
│   │   │   └── IOptimizationEngine.cs
│   │   └── Services/
│   │       └── TrainingCoordinator.cs
│   ├── Maestro.Infrastructure/
│   │   ├── Metrics/
│   │   │   ├── MetricsCollector.cs
│   │   │   ├── MetricsAggregator.cs
│   │   │   └── FileSystemMetricsRepository.cs
│   │   ├── Training/
│   │   │   ├── TrainingExecutor.cs
│   │   │   ├── ComparisonService.cs
│   │   │   ├── QualityEvaluators/
│   │   │   │   ├── HeuristicQualityEvaluator.cs
│   │   │   │   ├── LLMQualityEvaluator.cs
│   │   │   │   └── CustomQualityEvaluator.cs
│   │   │   └── OptimizationEngine.cs
│   │   └── LLMGateway/
│   │       └── MetricsAwareLLMGateway.cs
│   └── Maestro.Api/
│       ├── Controllers/
│       │   ├── TrainingController.cs
│       │   ├── MetricsController.cs
│       │   └── ComparisonController.cs
│       └── Hubs/
│           └── TrainingHub.cs

frontend/src/
├── pages/
│   ├── TrainingPage.tsx
│   ├── MetricsDashboardPage.tsx
│   ├── ComparisonPage.tsx
│   └── BenchmarkPage.tsx
├── components/
│   ├── Training/
│   │   ├── TrainingConfigForm.tsx
│   │   ├── TrainingRunList.tsx
│   │   ├── TrainingProgress.tsx
│   │   └── IterationViewer.tsx
│   ├── Metrics/
│   │   ├── MetricsChart.tsx
│   │   ├── CostBreakdown.tsx
│   │   ├── QualityGauge.tsx
│   │   └── BlockMetricsTable.tsx
│   └── Comparison/
│       ├── ComparisonTable.tsx
│       ├── DiffViewer.tsx
│       └── RecommendationCard.tsx
├── store/
│   ├── trainingStore.ts
│   └── metricsStore.ts
├── services/
│   ├── trainingService.ts
│   └── metricsService.ts
└── types/
    ├── training.types.ts
    └── metrics.types.ts
```

---

## Appendix B: Migration Notes

### From Current ExecutionMetrics

The current `ExecutionMetrics` class will be deprecated in favor of `WorkflowExecutionMetrics`. A migration path:

1. Keep `ExecutionMetrics` as a summary view
2. Add `BlockMetrics[]` and `ModelUsageMetrics[]` arrays to `ExecutionContext`
3. Update `ExecutionContext.Complete()` to aggregate into `ExecutionMetrics`
4. Frontend uses new detailed metrics where available, falls back to summary

### Database Considerations

If moving to a database-backed repository:

1. Create migrations for new tables:
   - `training_runs`
   - `training_configurations`
   - `execution_metrics_snapshots`
   - `block_metrics`
   - `model_usage_metrics`

2. Consider time-series database for metrics (InfluxDB, TimescaleDB) for better aggregation performance

---

## Appendix C: Glossary

| Term | Definition |
|------|------------|
| **Training Run** | A session of multiple workflow executions for optimization |
| **Iteration** | A single execution within a training run |
| **Quality Score** | A 0-100 measure of output quality |
| **Consistency Score** | A 0-100 measure of result variance (higher = more consistent) |
| **Optimization Goal** | The primary metric to optimize (cost, quality, speed, balanced) |
| **Block Metrics** | Execution data specific to a single block |
| **Model Metrics** | Usage data specific to a single LLM model call |

---

*Document Version: 1.0*
*Created: 2025-01-28*
*Status: Draft - Pending Review*
