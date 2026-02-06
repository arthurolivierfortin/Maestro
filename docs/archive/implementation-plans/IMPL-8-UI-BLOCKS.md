# Phase 8: UI Blocks

**Date**: 3 février 2026
**Status**: Completed
**Prerequisites**: Phases 1-7 (Workspace, Sessions, CLI Executor, Maestro-CLI Block, System Tools, Agent Execution, Block Resolution)

---

## Overview

Phase 8 creates system UI blocks that provide visualization components for workspaces. These blocks define the contract for frontend components to display progress, metrics, status, and activity logs.

## Architecture

```
blocks/system/ui/
├── progress-indicator.ui.block.json   # Task progress display
├── metrics-dashboard.ui.block.json    # Metrics visualization
├── workspace-status.ui.block.json     # Workspace overview
├── activity-log.ui.block.json         # Event logging
└── fitness-chart.ui.block.json        # Fitness visualization
```

---

## UI Blocks Created

### 1. Progress Indicator (`system:progress-indicator`)

Displays progress for long-running tasks with percentage, status, and estimated time remaining.

**Variants:**
- `linear` - Traditional progress bar
- `circular` - Circular progress indicator
- `steps` - Step-by-step progress

**Inputs:**
- `taskId` - Task to track
- `label` - Display label
- `variant` - Visual style
- `showDetails` - Show detailed status

**Outputs:**
- `progress` - Percentage (0-100)
- `status` - Current status
- `estimatedTimeRemaining` - Seconds remaining

---

### 2. Metrics Dashboard (`system:metrics-dashboard`)

Displays real-time metrics including fitness scores, execution stats, and model performance.

**Features:**
- Real-time chart updates (configurable refresh)
- Multiple metric types (fitness, successRate, latency)
- Grouping options (model, task, agent, time)
- Optional leaderboard panel

**Inputs:**
- `workspaceId` - Workspace filter
- `metrics` - Metrics to display
- `groupBy` - Grouping mode
- `showLeaderboard` - Show rankings

**Outputs:**
- `currentMetrics` - Current values
- `trends` - Trend data
- `topModels` - Ranked models

---

### 3. Workspace Status (`system:workspace-status`)

Displays comprehensive workspace status including active sessions, running tasks, and resource usage.

**Sections:**
- Sessions - Active session list
- Tasks - Running task overview
- Resources - CPU/Memory/GPU usage
- Agents - Active agent status

**Inputs:**
- `workspaceId` - Target workspace
- `sections` - Sections to display
- `expandedByDefault` - Initial state

**Outputs:**
- `status` - Full status object
- `activeSessions` - Session count
- `runningTasks` - Task count
- `resourceUsage` - Resource metrics

---

### 4. Activity Log (`system:activity-log`)

Real-time activity log showing agent actions, tool calls, and system events.

**Features:**
- Auto-scrolling log view
- Filtering by workspace/session/agent
- Log level filtering (info, warning, error)
- Category filtering (tool, agent, system, user)

**Inputs:**
- `workspaceId` - Workspace filter
- `sessionId` - Session filter
- `agentId` - Agent filter
- `logLevels` - Levels to display
- `categories` - Categories to display

**Outputs:**
- `entries` - Log entries array
- `errorCount` - Error count
- `warningCount` - Warning count

---

### 5. Fitness Chart (`system:fitness-chart`)

Visualizes model fitness over time with breakdown of P, S, W components and cost factors.

**Chart Options:**
- Time ranges: 1h, 6h, 24h, 7d, 30d
- Component breakdown (P × S × W)
- Cost factor breakdown (C_norm × C_compute × C_hw)

**Inputs:**
- `modelId` - Model filter
- `taskType` - Task type filter
- `timeRange` - Chart time range
- `showBreakdown` - Show P/S/W
- `showCosts` - Show cost factors

**Outputs:**
- `chartData` - Rendering data
- `currentFitness` - Latest score
- `trend` - Direction (up/down/stable)
- `rank` - Fitness rank

---

## Block Type: `ui`

UI blocks have specific characteristics:

```json
{
  "blockType": "ui",
  "isAtomic": true,
  "config": {
    "component": "ComponentName",  // React component reference
    "refreshInterval": 5000        // Auto-refresh interval
  }
}
```

### UI Block Contract

Frontend components implement the block inputs as props and emit outputs as events:

```typescript
interface UIBlockProps<I, O> {
  inputs: I;
  onOutput: (outputs: O) => void;
  config: BlockConfig;
}

// Example: Progress Indicator
const ProgressIndicator: FC<UIBlockProps<ProgressInputs, ProgressOutputs>> = ({
  inputs: { taskId, label, variant },
  onOutput,
  config
}) => {
  // Component implementation
};
```

---

## Integration with Workspace

UI blocks are used in workspace views:

```json
{
  "workspaceId": "research-workspace",
  "views": {
    "dashboard": {
      "layout": "grid",
      "blocks": [
        { "block": "system:workspace-status", "inputs": { "workspaceId": "$workspaceId" }},
        { "block": "system:metrics-dashboard", "inputs": { "workspaceId": "$workspaceId" }},
        { "block": "system:activity-log", "inputs": { "workspaceId": "$workspaceId" }}
      ]
    },
    "training": {
      "layout": "split",
      "blocks": [
        { "block": "system:progress-indicator", "inputs": { "taskId": "$trainingRunId" }},
        { "block": "system:fitness-chart", "inputs": { "workspaceId": "$workspaceId" }}
      ]
    }
  }
}
```

---

## Customization

Workspaces can override UI blocks to customize visualization:

```
workspaces/research-workspace/blocks/
└── system:fitness-chart.ui.block.json  # Custom fitness visualization
```

---

## Next Steps

- Phase 9: Complete Workspace Setup (research workspace template with all blocks)
