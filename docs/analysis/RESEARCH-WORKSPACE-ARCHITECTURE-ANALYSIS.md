# Research Workspace Architecture Analysis

**Date**: February 3, 2026
**Purpose**: Deep analysis of the Research Workspace setup following Maestro Philosophy V2
**Language**: English (for agent comprehension)
**Related Documents**:
- `docs/architecture/DESIGN-MAESTRO-CLI-BLOCK.md` - Agent-backend communication pattern
- `docs/workspaces/WORKSPACE-SETUP-MODEL-RESEARCH.md` - Workspace configuration
- `docs/implementation/IMPLEMENTATION-PLAN-RESEARCH-WORKSPACE.md` - Implementation phases

---

## 1. Philosophy Alignment Issues in Current Plan

### 1.1 Problems Identified in PLAN-TRAINING-STRATEGIES-V2.md

| Issue | Current Plan | Philosophy V2 Requirement |
|-------|--------------|---------------------------|
| **Experiments API** | Creates `ExperimentsController.cs` with REST endpoints | Experiments should be INTERNAL to workspace, managed by blocks |
| **Fitness API** | Creates `FitnessController.cs` with CLI commands | Fitness is a tool block that agents use via `maestro run` |
| **Backend Entity** | `TrainingExperiment.cs` domain entity | Data should be stored locally in workspace folder as JSON |
| **CLI Commands** | `maestro experiment create/start/stop` | CLI should only `maestro run <block-id>`, agents handle the rest |
| **Centralized Storage** | `data/experiments/` global folder | Each workspace has its own `data/` folder |

### 1.2 Core Principle Violations

**Principle 9.1: "Tout est un Block"**
- The plan creates backend services instead of blocks
- Experiment lifecycle is coded in C# instead of orchestrated by agent blocks

**Principle 9.2: "CLI-First"**
- CLI should execute blocks, not call APIs directly
- `maestro run system:experiment-manager --action create` ✓
- `maestro experiment create` ✗ (bypasses blocks)

**Principle 9.4: "Spécialisation"**
- Each workspace should be self-contained
- A research workspace contains ALL blocks needed for research
- No dependency on external APIs for experiment management

---

## 2. Correct Architecture: Self-Contained Research Workspace

### 2.1 Workspace Structure

```
C:\Meastro\workspaces\model-research\
│
├── workspace.json                    # Workspace configuration
│
├── blocks/                           # All blocks local to this workspace
│   │
│   ├── agents/                       # Agent blocks
│   │   ├── experiment-manager.agent.block.json
│   │   ├── researcher-agent.agent.block.json
│   │   ├── trainer-agent.agent.block.json
│   │   ├── tester-agent.agent.block.json
│   │   ├── documenter-agent.agent.block.json
│   │   └── publisher-agent.agent.block.json
│   │
│   ├── workflows/                    # Workflow blocks
│   │   ├── research-team.workflow.block.json
│   │   ├── training-loop.workflow.block.json
│   │   └── experiment-pipeline.workflow.block.json
│   │
│   ├── tools/                        # Tool blocks
│   │   ├── fitness-calculator.tool.block.json
│   │   ├── metrics-collector.tool.block.json
│   │   ├── leaderboard-manager.tool.block.json
│   │   ├── checkpoint-manager.tool.block.json
│   │   └── data-store.tool.block.json
│   │
│   ├── strategies/                   # Strategy workflow blocks (copied from system)
│   │   ├── sft-strategy.workflow.block.json
│   │   ├── rl-fitness-strategy.workflow.block.json
│   │   ├── preference-strategy.workflow.block.json
│   │   └── ... (other strategies)
│   │
│   └── ui/                           # UI block for custom dashboard
│       └── research-dashboard.ui.block.json
│
├── data/                             # Local data storage
│   ├── experiments/                  # Experiment JSON files
│   │   ├── exp-001.json
│   │   └── exp-002.json
│   ├── metrics/                      # Collected metrics
│   │   └── metrics-history.json
│   ├── leaderboard/                  # Fitness rankings
│   │   └── leaderboard.json
│   └── checkpoints/                  # Model/agent checkpoints
│
└── config/                           # Workspace configuration
    ├── models.json                   # Model profiles for fitness calculation
    └── fitness-config.json           # Lambda, weights, thresholds
```

### 2.2 Why This Structure?

| Aspect | Benefit |
|--------|---------|
| **Self-contained** | Workspace can be moved/copied/shared |
| **No external API** | All logic is in blocks, no backend dependency |
| **Local data** | Experiments stored in workspace, not global database |
| **Customizable** | Override any block by modifying local copy |
| **Portable** | When models change, just edit inference block configs |

---

## 3. Block Hierarchy Diagrams

### 3.1 Research Team Workflow

```
research-team.workflow.block.json
│
├── [INPUT] targetAgentId: string
├── [INPUT] taskType: string
├── [INPUT] maxIterations: number
│
├── STEP 1: researcher-agent
│   ├── Analyzes current agent fitness
│   ├── Identifies improvement opportunities
│   └── Outputs: improvementPlan
│
├── STEP 2: trainer-agent
│   ├── Receives: improvementPlan
│   ├── Executes training loop (calls training-loop.workflow)
│   └── Outputs: trainedAgentId, trainingMetrics
│
├── STEP 3: tester-agent
│   ├── Receives: trainedAgentId
│   ├── Runs test suite against trained agent
│   └── Outputs: testResults, fitnessScore
│
├── DECISION: fitnessScore >= threshold?
│   ├── YES → Continue to documenter
│   └── NO → Return to researcher (max 3 retries)
│
├── STEP 4: documenter-agent
│   ├── Receives: trainedAgentId, testResults
│   ├── Generates documentation
│   └── Outputs: documentation
│
├── STEP 5: publisher-agent
│   ├── Receives: trainedAgentId, documentation
│   ├── Publishes to catalog (if criteria met)
│   └── Outputs: publishedVersion
│
└── [OUTPUT]
    ├── success: boolean
    ├── improvedAgentId: string
    ├── fitnessImprovement: number
    └── publishedVersion: string
```

### 3.2 Experiment Manager Agent

```
experiment-manager.agent.block.json
│
├── [CAPABILITIES]
│   ├── experiment-lifecycle
│   ├── strategy-selection
│   ├── parallel-execution
│   └── result-comparison
│
├── [TOOLS] (internal blocks it can call)
│   ├── data-store (read/write experiments.json)
│   ├── fitness-calculator (calculate fitness)
│   ├── leaderboard-manager (update rankings)
│   └── metrics-collector (aggregate metrics)
│
├── [ACTIONS]
│   │
│   ├── create
│   │   ├── Input: name, targetAgentId, strategyId, config
│   │   ├── Creates experiment JSON in data/experiments/
│   │   └── Output: experimentId
│   │
│   ├── start
│   │   ├── Input: experimentId
│   │   ├── Loads experiment JSON
│   │   ├── Executes strategy workflow block
│   │   ├── Updates experiment status
│   │   └── Output: sessionId
│   │
│   ├── stop
│   │   ├── Input: experimentId
│   │   ├── Stops running session
│   │   ├── Saves checkpoint
│   │   └── Output: checkpointId
│   │
│   ├── list
│   │   ├── Input: status (optional)
│   │   ├── Reads data/experiments/*.json
│   │   └── Output: experiments[]
│   │
│   ├── compare
│   │   ├── Input: experimentIds[]
│   │   ├── Loads experiment results
│   │   ├── Calculates rankings
│   │   └── Output: comparison with rankings
│   │
│   └── recommend
│       ├── Input: agentId, taskType
│       ├── Analyzes agent characteristics
│       ├── Matches with strategy metadata
│       └── Output: recommendedStrategies[]
│
└── [SYSTEM PROMPT]
    "You are the Experiment Manager. You orchestrate training experiments
     using different strategies. Use your tools to:
     1. Store/retrieve experiment data (data-store)
     2. Calculate fitness scores (fitness-calculator)
     3. Update the leaderboard (leaderboard-manager)
     4. Track metrics over time (metrics-collector)"
```

### 3.3 Training Loop Workflow

```
training-loop.workflow.block.json
│
├── [INPUT]
│   ├── targetAgentId: string
│   ├── strategyBlockId: string
│   ├── maxIterations: number
│   ├── targetFitness: number
│   └── config: object
│
├── INIT: Load strategy configuration
│   └── Reads strategy block metadata
│
├── LOOP: For each iteration (1 to maxIterations)
│   │
│   ├── STEP 1: Execute strategy iteration
│   │   ├── Calls: {strategyBlockId} with iteration context
│   │   └── Output: iterationResult
│   │
│   ├── STEP 2: Calculate fitness
│   │   ├── Calls: fitness-calculator.tool
│   │   ├── Input: iterationResult.metrics, modelProfile
│   │   └── Output: fitnessScore
│   │
│   ├── STEP 3: Collect metrics
│   │   ├── Calls: metrics-collector.tool
│   │   ├── Input: iteration, fitnessScore, cost, duration
│   │   └── Output: aggregatedMetrics
│   │
│   ├── STEP 4: Check early stopping
│   │   ├── Calls: early-stopper logic
│   │   ├── Input: fitnessHistory, currentIteration
│   │   └── Output: shouldStop, reason
│   │
│   └── DECISION: shouldStop OR fitnessScore >= targetFitness?
│       ├── YES → Exit loop
│       └── NO → Continue
│
└── [OUTPUT]
    ├── finalFitness: number
    ├── iterationsCompleted: number
    ├── fitnessHistory: number[]
    ├── totalCost: number
    └── checkpointId: string
```

### 3.4 Fitness Calculator Tool

```
fitness-calculator.tool.block.json
│
├── [TYPE] tool (atomic block)
│
├── [INPUT]
│   ├── executionMetrics: {
│   │   ├── success: boolean
│   │   ├── qualityScore: number (0-1)
│   │   ├── testsPassRate: number (0-1)
│   │   ├── costUsd: number
│   │   ├── inputTokens: number
│   │   ├── outputTokens: number
│   │   ├── durationMs: number
│   │   ├── formatCompliance: number (0-1)
│   │   └── hallucinationDetected: boolean
│   │ }
│   ├── modelProfile: {
│   │   ├── modelId: string
│   │   ├── parameterCount: number
│   │   ├── flopsPerToken: number
│   │   ├── vramRequirementMB: number
│   │   ├── ramRequirementMB: number
│   │   ├── requiresGPU: boolean
│   │   └── costPer1kTokens: number
│   │ }
│   └── fitnessConfig: {
│       ├── lambda: number (default: 1.5)
│       ├── baselineCost: number (default: 0.01)
│       └── hardwareWeights: { alpha, beta, gamma }
│   }
│
├── [CALCULATION]
│   │
│   │  // Performance (P)
│   │  P = (qualityScore + testsPassRate) / 2
│   │
│   │  // Specialization (S)
│   │  S = P / max(taskEntropy, 0.1)
│   │
│   │  // Composability (W)
│   │  W = formatCompliance * (hallucinationDetected ? 0.5 : 1.0)
│   │
│   │  // Economic Cost (C_norm)
│   │  C_norm = costUsd / baselineCost
│   │
│   │  // Compute Cost (C_compute)
│   │  C_compute = log10(parameterCount) * (flopsPerToken / 1e9)
│   │
│   │  // Hardware Cost (C_hw)
│   │  C_hw = α×VRAM + β×RAM + γ×(GPU ? 1 : 0.1)
│   │
│   │  // Final Fitness
│   │  Fitness = (P × S × W) / (C_norm × C_compute × C_hw)^λ
│   │
│
└── [OUTPUT]
    ├── totalFitness: number
    ├── breakdown: {
    │   ├── performance: number
    │   ├── specialization: number
    │   ├── composability: number
    │   ├── economicCost: number
    │   ├── computeCost: number
    │   └── hardwareCost: number
    │ }
    └── interpretation: string
```

### 3.5 RL-Fitness Strategy Workflow

```
rl-fitness-strategy.workflow.block.json
│
├── [METADATA]
│   ├── method: "ReinforcementLearning"
│   ├── category: "reinforcement"
│   ├── suitableFor: ["reasoning", "code", "agentic"]
│   └── estimatedResources: { minIterations: 50, typical: 500 }
│
├── [CONFIG]
│   ├── algorithm: "PPO"
│   ├── explorationRate: 0.1
│   ├── explorationDecay: 0.995
│   ├── rewardShaping: {
│   │   ├── fitnessImprovement: 1.0
│   │   ├── costPenalty: -0.1
│   │   └── formatCompliance: 0.2
│   │ }
│   └── earlyStopping: { fitnessThreshold: 0.9, plateauPatience: 20 }
│
├── [INPUT]
│   ├── agentId: string
│   ├── taskWorkflowId: string
│   ├── iterationNumber: number
│   └── previousState: object
│
├── STEP 1: Generate action
│   ├── Agent executes task with current policy
│   └── Output: taskResult
│
├── STEP 2: Calculate reward
│   ├── Calls: reward-calculator with fitness-based config
│   ├── Input: currentFitness, previousFitness
│   └── Output: reward, normalizedReward
│
├── STEP 3: Update policy
│   ├── Apply PPO update rule
│   ├── Decay exploration rate
│   └── Output: updatedPolicy
│
├── STEP 4: Store checkpoint
│   ├── If best fitness so far, save checkpoint
│   └── Output: checkpointId (if saved)
│
└── [OUTPUT]
    ├── iterationResult: object
    ├── fitnessScore: number
    ├── reward: number
    ├── explorationRate: number
    └── checkpointId: string (optional)
```

---

## 4. UI Block: Research Dashboard

### 4.1 UI Block Definition

```json
{
  "id": "research-dashboard",
  "name": "Research Dashboard",
  "blockType": "ui",
  "version": "1.0.0",
  "description": "Custom dashboard for the research workspace",

  "config": {
    "entrypoint": "dashboard.html",
    "displayMode": "panel",
    "framework": "vanilla",
    "sandbox": true,
    "permissions": ["read-data", "execute-blocks"],
    "dataBindings": {
      "experiments": "data/experiments/*.json",
      "leaderboard": "data/leaderboard/leaderboard.json",
      "metrics": "data/metrics/metrics-history.json"
    },
    "styles": {
      "width": "100%",
      "height": "100%"
    }
  }
}
```

### 4.2 Dashboard Layout Mockup

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  RESEARCH WORKSPACE: Model Research                              [Settings] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────┐  ┌─────────────────────────────────────┐  │
│  │  ACTIVE EXPERIMENTS         │  │  FITNESS LEADERBOARD                │  │
│  │                             │  │                                     │  │
│  │  ┌─────────────────────┐   │  │  #1  llama3:8b-sft      0.847  ↑   │  │
│  │  │ exp-001 [RUNNING]   │   │  │  #2  mistral:7b-rl      0.823  ↑   │  │
│  │  │ Strategy: RL-Fitness│   │  │  #3  smollm2:1.7b       0.756  →   │  │
│  │  │ Agent: code-gen     │   │  │  #4  tinyllama          0.612  ↓   │  │
│  │  │ Progress: 34/100    │   │  │                                     │  │
│  │  │ Fitness: 0.72       │   │  │  [View Full Leaderboard]            │  │
│  │  │ ████████░░░ 34%     │   │  │                                     │  │
│  │  │ [Pause] [Stop]      │   │  └─────────────────────────────────────┘  │
│  │  └─────────────────────┘   │                                            │
│  │                             │  ┌─────────────────────────────────────┐  │
│  │  ┌─────────────────────┐   │  │  FITNESS TREND                      │  │
│  │  │ exp-002 [PAUSED]    │   │  │                                     │  │
│  │  │ Strategy: SFT       │   │  │  1.0 ┤                         •    │  │
│  │  │ Agent: summarizer   │   │  │      │                     •••      │  │
│  │  │ Progress: 78/100    │   │  │  0.8 ┤               •••••          │  │
│  │  │ Fitness: 0.81       │   │  │      │         •••••                │  │
│  │  │ ███████████░ 78%    │   │  │  0.6 ┤    ••••                      │  │
│  │  │ [Resume] [Stop]     │   │  │      │ •••                          │  │
│  │  └─────────────────────┘   │  │  0.4 ┼────────────────────────────  │  │
│  │                             │  │       0   20   40   60   80   100   │  │
│  │  [+ New Experiment]         │  │                                     │  │
│  │                             │  └─────────────────────────────────────┘  │
│  └─────────────────────────────┘                                            │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  RECENT ACTIVITY                                                      │  │
│  │                                                                       │  │
│  │  12:34:56  exp-001  Iteration 34 completed. Fitness: 0.723 (+0.012)  │  │
│  │  12:33:21  exp-001  Iteration 33 completed. Fitness: 0.711 (+0.008)  │  │
│  │  12:31:45  exp-002  Paused by user at iteration 78                   │  │
│  │  12:30:00  system   Leaderboard updated. New leader: llama3:8b-sft   │  │
│  │                                                                       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┤
│  │ Quick Actions:                                                          │
│  │ [Run Research Team] [Compare Top 3] [Export Results] [View All Blocks] │
│  └─────────────────────────────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Dashboard Features

| Feature | Description | Block Used |
|---------|-------------|------------|
| **Active Experiments** | Shows running/paused experiments | Reads `data/experiments/*.json` |
| **Fitness Leaderboard** | Ranks models by fitness score | Reads `data/leaderboard/leaderboard.json` |
| **Fitness Trend** | Chart of fitness over iterations | Reads `data/metrics/metrics-history.json` |
| **Recent Activity** | Log of recent actions | Reads workspace logs |
| **Quick Actions** | Buttons to run common workflows | Calls `maestro run <block-id>` via postMessage |

---

## 5. Agent-Backend Communication (maestro-cli)

> **Reference**: See `docs/architecture/DESIGN-MAESTRO-CLI-BLOCK.md` for full details.

### 5.1 Core Pattern

Agents in Maestro have **ONE tool**: the `maestro-cli` block. Through this single interface, they can:
- Discover available tools: `list-tools`
- Execute blocks: `run <block-id>`
- Manage data: `data read/write/list`
- Create sessions: `session create` (if permitted)

```
┌─────────────────────────────────────────────────────────────────┐
│  AGENT                                                          │
│                                                                 │
│  tools: [{ name: "maestro_cli", ... }]                         │
│                                                                 │
│  Agent calls: maestro_cli({ command: "list-tools" })           │
│  Agent calls: maestro_cli({ command: "run system:fitness-calculator --input ..." })
│                                                                 │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  BACKEND CLI EXECUTOR                                           │
│                                                                 │
│  1. Check permissions for this context                          │
│  2. Execute command if allowed                                  │
│  3. Return result                                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Permission Hierarchy

```
WORKSPACE (full access)
    │
    ├─► researcher-agent: Can create blocks, create sessions
    │
    ├─► trainer-agent: Restricted to training tools only
    │
    └─► TRAINING SESSION (restricted)
            │
            └─► Session agents: Only fitness-calculator, data-store
```

### 5.3 Why This Pattern?

| Benefit | Description |
|---------|-------------|
| **CLI-First** | Agents use CLI like humans |
| **Uniform** | Same pattern for all contexts |
| **Secure** | All permissions checked at backend |
| **Discoverable** | Agents can `list-tools` to see what's available |

---

## 6. How to Use the Workspace

### 6.1 Initial Setup (One-Time)

```bash
# 1. Create the workspace
maestro workspace create \
  --name "Model Research" \
  --path "C:\Meastro\workspaces\model-research" \
  --type research

# 2. Copy system strategy blocks to workspace (for customization)
maestro blocks copy system:strategy-* \
  --to "C:\Meastro\workspaces\model-research\blocks\strategies"

# 3. Configure models (edit config/models.json)
# Add profiles for models you want to test:
# - smollm2:1.7b (free, local)
# - llama3:8b (free, local via Ollama)
# - gpt-4-mini (paid, when ready)

# 4. Verify workspace structure
maestro workspace info model-research
```

### 6.2 Daily Usage

```bash
# View workspace in UI
# Navigate to: http://localhost:5173/workspaces/model-research

# Create a new experiment
maestro run experiment-manager \
  --workspace model-research \
  --action create \
  --input name="Test RL on code-gen" \
  --input targetAgentId=code-gen-agent \
  --input strategyId=rl-fitness-strategy \
  --input config='{"maxIterations": 100}'

# Start the experiment
maestro run experiment-manager \
  --workspace model-research \
  --action start \
  --input experimentId=exp-001

# Monitor progress (or use UI dashboard)
maestro run experiment-manager \
  --workspace model-research \
  --action list

# Compare experiments
maestro run experiment-manager \
  --workspace model-research \
  --action compare \
  --input experimentIds='["exp-001", "exp-002"]'

# Run the full research team workflow
maestro run research-team \
  --workspace model-research \
  --input targetAgentId=code-gen-agent \
  --input taskType=code \
  --input maxIterations=100
```

### 6.3 Switching to Production Models

When ready to use paid models, just edit the inference blocks:

```bash
# Option 1: Edit block config directly
# Edit: blocks/agents/trainer-agent.agent.block.json
# Change: config.model from "smollm2:1.7b" to "gpt-4-mini"

# Option 2: Use override mechanism
maestro blocks override trainer-agent \
  --workspace model-research \
  --config '{"model": "gpt-4-mini"}'
```

---

## 7. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         WORKSPACE: model-research                            │
│                                                                              │
│  USER ACTION                                                                 │
│      │                                                                       │
│      ▼                                                                       │
│  ┌─────────────────┐                                                        │
│  │ maestro run     │ ───► Executes block in workspace context               │
│  │ experiment-mgr  │                                                        │
│  └────────┬────────┘                                                        │
│           │                                                                  │
│           ▼                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ EXPERIMENT-MANAGER AGENT                                             │   │
│  │                                                                      │   │
│  │  1. Reads/writes: data/experiments/*.json                           │   │
│  │  2. Executes: strategy workflow blocks                              │   │
│  │  3. Calls tools: fitness-calculator, metrics-collector               │   │
│  │                                                                      │   │
│  └────────┬─────────────────────────┬──────────────────────┬───────────┘   │
│           │                         │                      │                │
│           ▼                         ▼                      ▼                │
│  ┌────────────────┐     ┌────────────────┐     ┌────────────────┐         │
│  │ STRATEGY       │     │ FITNESS        │     │ DATA-STORE     │         │
│  │ WORKFLOW       │     │ CALCULATOR     │     │ TOOL           │         │
│  │                │     │                │     │                │         │
│  │ • Runs train   │     │ • Computes P,  │     │ • Saves exp    │         │
│  │   iterations   │     │   S, W, C      │     │   JSON         │         │
│  │ • Applies      │     │ • Returns      │     │ • Updates      │         │
│  │   strategy     │     │   fitness      │     │   leaderboard  │         │
│  │   logic        │     │   score        │     │                │         │
│  └────────┬───────┘     └───────┬────────┘     └───────┬────────┘         │
│           │                     │                      │                   │
│           ▼                     ▼                      ▼                   │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                          DATA FOLDER                                 │  │
│  │                                                                      │  │
│  │  data/                                                               │  │
│  │  ├── experiments/exp-001.json  ← Experiment state & results         │  │
│  │  ├── metrics/metrics-history.json  ← Time series of fitness         │  │
│  │  ├── leaderboard/leaderboard.json  ← Rankings by fitness            │  │
│  │  └── checkpoints/ckpt-001.json  ← Best model checkpoints            │  │
│  │                                                                      │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │ UI BLOCK (research-dashboard)                                        │  │
│  │                                                                       │  │
│  │ • Reads data/ folder via dataBindings                                │  │
│  │ • Displays experiments, leaderboard, charts                          │  │
│  │ • Calls blocks via postMessage API                                   │  │
│  │                                                                       │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. What Should NOT Exist

### 8.1 Remove from Plan

| Item | Reason |
|------|--------|
| `ExperimentsController.cs` | Experiments are managed by blocks, not REST API |
| `FitnessController.cs` | Fitness is a tool block, not API |
| `TrainingExperiment.cs` entity | Data stored as JSON in workspace |
| `IExperimentRepository` | No repository pattern needed, just file I/O |
| `maestro experiment` CLI command | Use `maestro run experiment-manager` |
| `maestro fitness` CLI command | Use `maestro run fitness-calculator` |
| Frontend `experimentStore.ts` | UI Block handles its own state |
| Frontend `experimentService.ts` | No API to call |

### 8.2 What Should Exist Instead

| Component | Location | Purpose |
|-----------|----------|---------|
| `experiment-manager.agent.block.json` | workspace/blocks/agents/ | Manages experiments via block execution |
| `fitness-calculator.tool.block.json` | workspace/blocks/tools/ | Calculates fitness scores |
| `data-store.tool.block.json` | workspace/blocks/tools/ | Reads/writes JSON files |
| `research-dashboard.ui.block.json` | workspace/blocks/ui/ | Custom dashboard |
| `experiments/*.json` | workspace/data/ | Experiment data files |

---

## 9. Implementation Checklist

### Phase 1: Workspace Structure
- [ ] Create workspace folder structure
- [ ] Create `workspace.json` configuration
- [ ] Create `config/models.json` with model profiles
- [ ] Create `config/fitness-config.json`

### Phase 2: Core Blocks
- [ ] Create `experiment-manager.agent.block.json`
- [ ] Create `data-store.tool.block.json`
- [ ] Create `fitness-calculator.tool.block.json`
- [ ] Create `metrics-collector.tool.block.json`
- [ ] Create `leaderboard-manager.tool.block.json`

### Phase 3: Strategy Blocks (Copy from System)
- [ ] Copy `system:strategy-sft` to workspace
- [ ] Copy `system:strategy-rl-fitness` to workspace
- [ ] Copy other strategies as needed
- [ ] Customize inference model in each strategy

### Phase 4: Workflow Blocks
- [ ] Create `training-loop.workflow.block.json`
- [ ] Create `experiment-pipeline.workflow.block.json`
- [ ] Create `research-team.workflow.block.json`

### Phase 5: Research Team Agents
- [ ] Create `researcher-agent.agent.block.json`
- [ ] Create `trainer-agent.agent.block.json`
- [ ] Create `tester-agent.agent.block.json`
- [ ] Create `documenter-agent.agent.block.json`
- [ ] Create `publisher-agent.agent.block.json`

### Phase 6: UI Block
- [ ] Create `research-dashboard.ui.block.json`
- [ ] Create `dashboard.html` with layout
- [ ] Implement data bindings
- [ ] Implement postMessage actions

### Phase 7: Verification
- [ ] Test workspace creation
- [ ] Test experiment creation via `maestro run`
- [ ] Test fitness calculation
- [ ] Test UI dashboard display
- [ ] Test full research team workflow

---

## 10. Summary

### Key Differences from Original Plan

| Aspect | Original Plan | Correct Architecture |
|--------|---------------|----------------------|
| **Experiments** | Backend API + DB | Blocks + JSON files in workspace |
| **Fitness** | API + CLI commands | Tool block called by agents |
| **Data storage** | Global `data/experiments/` | Workspace-local `data/` folder |
| **CLI** | Custom commands | `maestro run <block-id>` |
| **UI** | Frontend pages | UI Block with postMessage |
| **Customization** | Override system blocks | Local copies in workspace |

### Philosophy Alignment

✅ **9.1 Tout est un Block**: All logic is in blocks
✅ **9.2 CLI-First**: `maestro run` executes blocks
✅ **9.4 Spécialisation**: Each workspace is self-contained
✅ **9.5 Overridable**: Blocks can be customized locally

---

*"The workspace IS the experiment lab. Everything it needs is inside it."*
