# Agent Foundry - Architecture Documentation

## Overview

Agent Foundry is the centralized hub for creating, managing, and quantifying autonomous agents and tools in Maestro. Both agents and tools are composed of blocks, with the key distinction being their expected behavior and autonomy level.

## Core Concepts

### Blocks (Foundation)
Blocks are the fundamental building units:
- **Atomic**: prompt, instruction, tool, decision, validator, trigger, inference, script
- **Composite**: workflow, agent, task

### Tools (Task Executors)
Tools are workflows designated for specific, well-defined tasks.

**Characteristics:**
- Low autonomy - executes one specific task
- Strict input/output schema
- Stateless execution
- Quantifiable metrics (success rate, speed, cost)

**Examples:**
- `git-commit-description` - Generate commit message from diff
- `code-review` - Review code against rules
- `file-generator` - Generate file from template

### Agents (Autonomous Orchestrators)
Agents are workflows designated for autonomous, goal-driven execution.

**Characteristics:**
- High autonomy - makes decisions, orchestrates
- Flexible input (goals/objectives)
- May maintain state across steps
- Uses tools and other agents
- Quantifiable on orchestration quality

**Examples:**
- `cantante-developer` - Autonomously develop the Cantante app
- `task-decomposer` - Break complex tasks into subtasks
- `code-reviewer-agent` - Full code review workflow

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         MAESTRO                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                     BLOCK LAYER                            │  │
│  │  [prompt] [script] [workflow] [inference] [decision] ...  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│              ┌───────────────┴───────────────┐                  │
│              ▼                               ▼                  │
│  ┌─────────────────────┐      ┌─────────────────────┐          │
│  │   TOOL REGISTRY     │      │   AGENT REGISTRY    │          │
│  │                     │◄─────│                     │          │
│  │ - git-commit-desc   │ uses │ - cantante-dev      │          │
│  │ - code-review       │      │ - task-decomposer   │          │
│  │ - file-generator    │      │ - code-reviewer     │          │
│  └─────────────────────┘      └─────────────────────┘          │
│              │                               │                  │
│              └───────────────┬───────────────┘                  │
│                              ▼                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    METRICS & SCORING                       │  │
│  │  - Success rates    - Token costs    - Execution times    │  │
│  │  - Quality scores   - Usage stats    - Run history        │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Data Models

### ToolDefinition

```typescript
interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  designation: "tool";

  // Implementation
  blockId: string;           // Reference to underlying block/workflow
  blocks?: Block[];          // Or inline block definition

  // Schema (strict for tools)
  inputSchema: {
    type: "object";
    properties: Record<string, JsonSchemaProperty>;
    required: string[];
  };
  outputSchema: {
    type: "object";
    properties: Record<string, JsonSchemaProperty>;
  };

  // Metadata
  category: string;          // "git", "code", "file", "llm", etc.
  tags: string[];
  author?: string;

  // Metrics (aggregated from runs)
  metrics: ToolMetrics;
}

interface ToolMetrics {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  successRate: number;       // 0-100
  avgExecutionTimeMs: number;
  avgTokenCost: number;
  avgScore: number;          // 0-100
  lastRunAt?: Date;
  usedByAgents: string[];    // Agent IDs that use this tool
}
```

### AgentDefinition

```typescript
interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  designation: "agent";

  // Implementation
  blockId: string;           // Reference to underlying block/workflow
  blocks?: Block[];          // Or inline block definition

  // Capabilities
  capabilities: string[];    // What this agent can do
  availableTools: string[];  // Tool IDs this agent can use
  availableAgents?: string[]; // Other agents it can use as tools

  // Configuration
  config: {
    model?: string;          // Preferred LLM model
    maxSteps?: number;       // Max execution steps
    maxTokens?: number;      // Token budget
    temperature?: number;
    timeout?: number;        // Max execution time (ms)
  };

  // Metadata
  category: string;
  tags: string[];
  author?: string;

  // Metrics (aggregated from runs)
  metrics: AgentMetrics;
}

interface AgentMetrics {
  totalRuns: number;
  completedRuns: number;
  failedRuns: number;
  cancelledRuns: number;
  completionRate: number;    // 0-100
  avgExecutionTimeMs: number;
  avgTokenCost: number;
  avgStepsPerRun: number;
  avgToolsUsedPerRun: number;

  // Quality metrics
  avgTaskCompletionScore: number;  // 0-100
  avgEfficiencyScore: number;      // 0-100
  avgQualityScore: number;         // 0-100
  overallScore: number;            // Weighted composite

  // Tool usage breakdown
  toolUsage: Record<string, {
    count: number;
    successRate: number;
  }>;

  lastRunAt?: Date;
  runHistory: RunSummary[];
}
```

### Run Records (Extended)

```typescript
interface ToolRun extends RunRecord {
  type: "tool";
  toolId: string;
  toolVersion: string;

  // Tool-specific
  inputValidation: { valid: boolean; errors?: string[] };
  outputValidation: { valid: boolean; errors?: string[] };
}

interface AgentRun extends RunRecord {
  type: "agent";
  agentId: string;
  agentVersion: string;

  // Agent-specific
  goal: string;
  toolCalls: ToolCall[];
  decisions: Decision[];
  stepsExecuted: number;

  // Scores
  scores: {
    taskCompletion: number;
    toolSelection: number;
    efficiency: number;
    quality: number;
    overall: number;
  };
}

interface ToolCall {
  toolId: string;
  timestamp: Date;
  inputs: Record<string, any>;
  outputs?: Record<string, any>;
  success: boolean;
  executionTimeMs: number;
  error?: string;
}

interface Decision {
  timestamp: Date;
  question: string;
  options: string[];
  chosen: string;
  reasoning: string;
  confidence: number;
}
```

## API Endpoints

### Tool Endpoints

```
GET    /api/tools                    # List all tools
GET    /api/tools/{id}               # Get tool details
POST   /api/tools                    # Create new tool
PUT    /api/tools/{id}               # Update tool
DELETE /api/tools/{id}               # Delete tool
POST   /api/tools/{id}/execute       # Execute tool
GET    /api/tools/{id}/runs          # Get tool run history
GET    /api/tools/{id}/metrics       # Get tool metrics
POST   /api/tools/{id}/test          # Test tool with sample input
```

### Agent Endpoints

```
GET    /api/agents                   # List all agents
GET    /api/agents/{id}              # Get agent details
POST   /api/agents                   # Create new agent
PUT    /api/agents/{id}              # Update agent
DELETE /api/agents/{id}              # Delete agent
POST   /api/agents/{id}/execute      # Execute agent
GET    /api/agents/{id}/runs         # Get agent run history
GET    /api/agents/{id}/metrics      # Get agent metrics
POST   /api/agents/{id}/test         # Test agent
GET    /api/agents/{id}/tools        # List tools available to agent
```

### Foundry Endpoints

```
GET    /api/foundry/overview         # Dashboard data (counts, top items)
GET    /api/foundry/leaderboard      # Ranked agents and tools by score
POST   /api/foundry/promote          # Promote workflow to tool/agent
GET    /api/foundry/relationships    # Agent-tool dependency graph
```

## CLI Commands

```bash
# Tools
maestro tools list                   # List all tools
maestro tools show <id>              # Show tool details
maestro tools create <name>          # Create new tool
maestro tools run <id> [--input {}]  # Execute tool
maestro tools test <id>              # Test tool
maestro tools metrics <id>           # Show tool metrics

# Agents
maestro agents list                  # List all agents
maestro agents show <id>             # Show agent details
maestro agents create <name>         # Create new agent
maestro agents run <id> [--goal ""]  # Execute agent
maestro agents test <id>             # Test agent
maestro agents metrics <id>          # Show agent metrics

# Foundry
maestro foundry overview             # Show overview dashboard
maestro foundry leaderboard          # Show ranked items
maestro foundry promote <blockId> --as tool|agent
```

## UI Components

### Agent Foundry Page (`/foundry/agents`)

```
┌──────────────────────────────────────────────────────────────────┐
│  AGENT FOUNDRY                                      [+ Create]   │
├──────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ AGENTS   │  │  TOOLS   │  │  RUNS    │  │ METRICS  │        │
│  │   12     │  │    34    │  │   156    │  │  Avg:87  │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
├────────────────────────────────────┬─────────────────────────────┤
│  AGENTS                      [▼]   │  TOOLS                [▼]  │
│  ┌──────────────────────────────┐  │  ┌─────────────────────────┤
│  │ 🤖 cantante-developer   92%  │  │  │ 🔧 git-commit      95%  │
│  │    ████████████░░ 47 runs   │  │  │    ██████████████ 234   │
│  ├──────────────────────────────┤  │  ├─────────────────────────┤
│  │ 🤖 task-decomposer      85%  │  │  │ 🔧 code-review     88%  │
│  │    ████████████░░ 156 runs  │  │  │    █████████████░ 89    │
│  ├──────────────────────────────┤  │  ├─────────────────────────┤
│  │ 🤖 code-reviewer        78%  │  │  │ 🔧 file-write      92%  │
│  │    ██████████░░░░ 23 runs   │  │  │    ██████████████ 567   │
│  └──────────────────────────────┘  │  └─────────────────────────┘
└────────────────────────────────────┴─────────────────────────────┘
```

### Tool/Agent Detail Page

```
┌──────────────────────────────────────────────────────────────────┐
│  🔧 git-commit-description                    v1.2.0   [Edit]   │
│  Generate meaningful commit messages from git diffs              │
├──────────────────────────────────────────────────────────────────┤
│  METRICS                                                         │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐   │
│  │ Success    │ │ Avg Time   │ │ Avg Tokens │ │ Score      │   │
│  │   95%      │ │   1.2s     │ │    342     │ │   95/100   │   │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘   │
├──────────────────────────────────────────────────────────────────┤
│  USED BY AGENTS                                                  │
│  • cantante-developer (47 calls)                                │
│  • pr-reviewer (23 calls)                                       │
├──────────────────────────────────────────────────────────────────┤
│  INPUT SCHEMA                    OUTPUT SCHEMA                   │
│  {                               {                               │
│    "diff": "string",               "message": "string",         │
│    "context": "string?"            "type": "feat|fix|..."       │
│  }                               }                               │
├──────────────────────────────────────────────────────────────────┤
│  RECENT RUNS                                              [All] │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ #234  ✓  1.1s  338 tokens  Score: 98    2 min ago         │ │
│  │ #233  ✓  1.4s  356 tokens  Score: 94    5 min ago         │ │
│  │ #232  ✗  0.8s  Error: timeout           12 min ago        │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

## Scoring System

### Tool Scoring

```
Tool Score = weighted average of:
  - Success Rate (40%)      : successful_runs / total_runs
  - Speed Score (20%)       : normalized(1 / avg_execution_time)
  - Cost Efficiency (20%)   : normalized(1 / avg_tokens)
  - Output Quality (20%)    : avg of run quality scores
```

### Agent Scoring

```
Agent Score = weighted average of:
  - Task Completion (35%)   : completed_goals / attempted_goals
  - Tool Selection (20%)    : correct_tool_choices / total_choices
  - Efficiency (25%)        : optimal_steps / actual_steps
  - Output Quality (20%)    : avg of run quality scores
```

## File Structure

```
backend/
  src/
    Maestro.Domain/
      Entities/
        ToolDefinition.cs
        AgentDefinition.cs
        ToolMetrics.cs
        AgentMetrics.cs
    Maestro.Infrastructure/
      Tools/
        ToolRegistry.cs
        ToolExecutor.cs
        ToolScorer.cs
      Agents/
        AgentRegistry.cs
        AgentExecutor.cs
        AgentScorer.cs
    Maestro.Api/
      Controllers/
        ToolsController.cs
        AgentsController.cs
        FoundryController.cs

frontend/
  src/
    pages/
      foundry/
        AgentFoundryPage.tsx
        ToolDetailPage.tsx
        AgentDetailPage.tsx
    components/
      foundry/
        ToolCard.tsx
        AgentCard.tsx
        MetricsPanel.tsx
        RunHistoryTable.tsx
        ScoreGauge.tsx

tools/
  maestro-cli/
    commands/
      tools.js
      agents.js
      foundry.js
```

## Migration Path

1. **Phase 1**: Add `designation` field to existing blocks
2. **Phase 2**: Create Tool/Agent registries and APIs
3. **Phase 3**: Implement scoring system
4. **Phase 4**: Build UI components
5. **Phase 5**: Add CLI commands
6. **Phase 6**: Migrate existing workflows to tools/agents

## Future Enhancements

- [ ] Tool/Agent marketplace
- [ ] Version control for tools/agents
- [ ] A/B testing for different tool implementations
- [ ] Automatic tool suggestion for agents
- [ ] Performance regression alerts
- [ ] Tool dependency analysis
- [ ] Agent behavior replay/debugging
