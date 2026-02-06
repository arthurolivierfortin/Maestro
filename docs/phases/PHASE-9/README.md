# Phase 9: Complete Workspace Setup

**Date**: 3 février 2026
**Status**: Completed
**Prerequisites**: Phases 1-8 (All previous infrastructure)

---

## Overview

Phase 9 creates a complete research workspace template that demonstrates all the infrastructure built in Phases 1-8. This template serves as both a working example and a starting point for new research workspaces.

## Research Workspace Template Structure

```
workspaces/templates/research-workspace/
├── workspace.json                              # Main workspace configuration
├── sessions/
│   ├── default.session.json                   # Standard session template
│   └── restricted.session.json                # Sandbox session template
├── agents/
│   ├── research-orchestrator.agent.block.json # Experiment orchestration
│   └── data-analyst.agent.block.json          # Data analysis
└── blocks/
    └── custom-fitness.tool.block.json         # Workspace-local tool override
```

---

## Components

### 1. Workspace Configuration (`workspace.json`)

The main workspace file defines:

- **Config**: Default model, session limits, checkpoint settings
- **Fitness Config**: Custom λ and weights for research
- **Default Permissions**: Allowed commands and tools
- **Views**: UI block compositions for dashboard and training views
- **Workflows**: Startup and experiment execution sequences

```json
{
  "config": {
    "defaultModel": "smollm2:1.7b",
    "maxConcurrentSessions": 5,
    "autoCheckpoint": true,
    "fitness": {
      "lambda": 0.3,
      "weights": { "performance": 1.0, "specialization": 0.8, "composability": 0.9 }
    }
  }
}
```

### 2. Session Templates

#### Default Session
- Inherits workspace permissions
- Adds web-search and document-reader tools
- 50 iteration limit, 1 hour timeout
- Auto-save enabled

#### Restricted Session
- Sandboxed environment for untested agents
- Read-only tool access
- No file-write or shell-execute
- 20 iteration limit, 10 minute timeout

### 3. Agent Blocks

#### Research Orchestrator
- Plans and executes experiments
- Manages checkpoints
- Coordinates data collection
- Calculates fitness scores

#### Data Analyst
- Queries experimental data
- Identifies patterns
- Generates insights
- Compares model performance

### 4. Workspace-Local Blocks

#### Custom Fitness Calculator
- Overrides `system:fitness-calculator`
- Custom weights optimized for research tasks
- λ = 0.25 (lower cost sensitivity)
- Higher performance weight (1.2)

---

## Permission Hierarchy

```
Workspace Permissions (Base)
├── Allowed Commands: run, list-tools, list-blocks, describe, data, help
├── Allowed Tools: fitness-calculator, data-store, metrics-collector, etc.
└── Blocked Commands: workspace delete, session end-all

Session: Default (Inherits + Extends)
├── +web-search
└── +document-reader

Session: Restricted (Inherits + Restricts)
├── Tools: fitness-calculator, data-store, file-read, directory-list ONLY
├── +blocked: file-write, shell-execute, workspace
└── Sandboxed: true
```

---

## Views Configuration

### Dashboard View
```
┌─────────────────────┬─────────────────────┐
│  Workspace Status   │  Metrics Dashboard  │
│                     │                     │
├─────────────────────┴─────────────────────┤
│              Activity Log                  │
│                                           │
└───────────────────────────────────────────┘
```

### Training View
```
┌────────────────┬───────────────────────────┐
│   Progress     │                           │
│   Indicator    │      Fitness Chart        │
│   (30%)        │         (70%)             │
└────────────────┴───────────────────────────┘
```

---

## Workflows

### Startup Workflow
1. Create default session
2. Display workspace status

### Experiment Workflow
1. Save checkpoint (phase: start)
2. Run research-orchestrator agent
3. Collect metrics
4. Calculate fitness
5. Update leaderboard
6. Save checkpoint (phase: end)

---

## Usage

### Creating a New Workspace from Template

```bash
# Using CLI
maestro workspace create \
  --name "my-research" \
  --template research-workspace

# Or copy template directory
cp -r workspaces/templates/research-workspace workspaces/my-research
# Update workspace.json with new ID
```

### Starting the Workspace

```bash
# Create a session
maestro session start \
  --workspace my-research \
  --template default

# Run the research orchestrator
maestro run research-orchestrator \
  --input task="Evaluate smollm2:1.7b on coding tasks" \
  --input modelId="smollm2:1.7b"
```

### Using the Sandbox

```bash
# Start restricted session for testing
maestro session start \
  --workspace my-research \
  --template restricted

# Agent has limited permissions
maestro run data-analyst \
  --input query="Compare models by fitness"
```

---

## Integration Points

| Phase | Integration |
|-------|-------------|
| Phase 1 | Workspace entity and repository |
| Phase 2 | Session management with permission inheritance |
| Phase 3 | CLI executor for command routing |
| Phase 4 | Maestro-CLI block for agent tool access |
| Phase 5 | System tools (fitness, data-store, metrics, etc.) |
| Phase 6 | Agent execution via maestro_cli |
| Phase 7 | Workspace-first block resolution |
| Phase 8 | UI blocks for dashboard visualization |

---

## Next Steps

With the Research Workspace Infrastructure complete, the system is ready for:

1. **Training Runs**: Execute fitness-driven training with automatic checkpointing
2. **Model Evaluation**: Compare models using the leaderboard system
3. **Custom Workspaces**: Create domain-specific workspaces from the template
4. **UI Implementation**: Build React components for the UI blocks
