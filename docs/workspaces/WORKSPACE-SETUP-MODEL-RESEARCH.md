# Model Research Workspace Setup

**Purpose**: Internal configuration and block definitions for the Model Research workspace
**Language**: English (for agent comprehension)
**Audience**: Agents and developers setting up the workspace
**Related**: `docs/architecture/DESIGN-MAESTRO-CLI-BLOCK.md`

---

## 1. Workspace Configuration

### 1.1 workspace.json

```json
{
  "id": "model-research",
  "name": "Model Research",
  "description": "Autonomous training workspace for researching and optimizing LLM model fitness",
  "version": "1.0.0",
  "type": "research",
  "created": "2026-02-03T00:00:00Z",

  "config": {
    "defaultModel": "smollm2:1.7b",
    "fitnessThreshold": 0.7,
    "maxConcurrentExperiments": 2,
    "autoSaveCheckpoints": true,
    "checkpointFrequency": 10
  },

  "permissions": {
    "defaultAgentPermissions": {
      "allowedCommands": ["run", "list-tools", "list-blocks", "describe", "data", "session", "block"],
      "allowedTools": ["*"],
      "allowedBlocks": ["*"],
      "canCreateBlocks": true,
      "canCreateSessions": true,
      "dataCollections": ["*"],
      "allowedPaths": ["blocks/", "data/", "config/"]
    },
    "agentOverrides": {
      "trainer-agent": {
        "allowedCommands": ["run", "list-tools", "data"],
        "allowedTools": ["system:fitness-calculator", "system:data-store", "system:metrics-collector"],
        "canCreateBlocks": false,
        "canCreateSessions": false,
        "dataCollections": ["experiments", "metrics", "checkpoints"]
      }
    }
  },

  "sessionTemplates": {
    "training": {
      "permissions": {
        "allowedCommands": ["run", "list-tools", "data"],
        "allowedTools": ["system:fitness-calculator", "system:data-store", "system:metrics-collector"],
        "canCreateBlocks": false,
        "canCreateSessions": false,
        "dataCollections": ["experiments", "metrics", "checkpoints"]
      },
      "logAllCommands": true
    },
    "foundry": {
      "permissions": {
        "allowedCommands": ["run", "list-tools"],
        "allowedTools": [],
        "canCreateBlocks": false,
        "canCreateSessions": false
      },
      "logAllCommands": true
    }
  },

  "entryPoints": {
    "main": "research-team",
    "dashboard": "research-dashboard",
    "experiments": "experiment-manager"
  },

  "dataFolders": {
    "experiments": "data/experiments",
    "metrics": "data/metrics",
    "leaderboard": "data/leaderboard",
    "checkpoints": "data/checkpoints"
  }
}
```

### 1.2 Folder Structure

```
workspaces/model-research/
│
├── workspace.json
│
├── blocks/
│   ├── agents/                              # Workspace-specific agents
│   │   ├── experiment-manager.agent.block.json
│   │   ├── researcher-agent.agent.block.json
│   │   ├── trainer-agent.agent.block.json
│   │   ├── tester-agent.agent.block.json
│   │   ├── documenter-agent.agent.block.json
│   │   └── publisher-agent.agent.block.json
│   │
│   ├── workflows/                           # Workspace-specific workflows
│   │   ├── research-team.workflow.block.json
│   │   ├── training-loop.workflow.block.json
│   │   └── experiment-pipeline.workflow.block.json
│   │
│   ├── strategies/                          # Copied from system, customized
│   │   ├── sft-strategy.workflow.block.json
│   │   ├── rl-fitness-strategy.workflow.block.json
│   │   ├── preference-strategy.workflow.block.json
│   │   └── distillation-strategy.workflow.block.json
│   │
│   └── ui/                                  # Custom dashboard
│       ├── research-dashboard.ui.block.json
│       └── assets/
│           ├── dashboard.html
│           ├── dashboard.css
│           └── dashboard.js
│
├── data/                                    # Workspace data (JSON files)
│   ├── experiments/
│   ├── metrics/
│   ├── leaderboard/
│   └── checkpoints/
│
└── config/                                  # Workspace configuration
    ├── models.json                          # Model profiles for fitness
    └── fitness-config.json                  # Fitness formula config

# NOTE: Tools like fitness-calculator, data-store are SYSTEM blocks
# They are accessed via: system:fitness-calculator, system:data-store
# The workspace can override them by creating local copies in blocks/tools/
```

### 1.3 System Blocks Used

This workspace uses the following system blocks (no need to copy unless overriding):

| System Block | Purpose |
|--------------|---------|
| `system:maestro-cli` | CLI interface for agents (injected automatically) |
| `system:fitness-calculator` | Calculate model fitness scores |
| `system:data-store` | Read/write JSON data |
| `system:metrics-collector` | Aggregate metrics over time |
| `system:leaderboard-manager` | Manage fitness rankings |
| `system:checkpoint-manager` | Save/restore training state |

---

## 2. Configuration Files

### 2.1 config/models.json

Model profiles for fitness calculation.

```json
{
  "profiles": [
    {
      "modelId": "smollm2:135m",
      "displayName": "SmolLM2 135M",
      "parameterCount": 135000000,
      "flopsPerToken": 270000000,
      "vramRequirementMB": 512,
      "ramRequirementMB": 1024,
      "requiresGPU": false,
      "costPer1kTokens": 0,
      "provider": "ollama"
    },
    {
      "modelId": "smollm2:360m",
      "displayName": "SmolLM2 360M",
      "parameterCount": 360000000,
      "flopsPerToken": 720000000,
      "vramRequirementMB": 1024,
      "ramRequirementMB": 2048,
      "requiresGPU": false,
      "costPer1kTokens": 0,
      "provider": "ollama"
    },
    {
      "modelId": "smollm2:1.7b",
      "displayName": "SmolLM2 1.7B",
      "parameterCount": 1700000000,
      "flopsPerToken": 3400000000,
      "vramRequirementMB": 4096,
      "ramRequirementMB": 8192,
      "requiresGPU": true,
      "costPer1kTokens": 0,
      "provider": "ollama"
    },
    {
      "modelId": "llama3:8b",
      "displayName": "Llama 3 8B",
      "parameterCount": 8000000000,
      "flopsPerToken": 16000000000,
      "vramRequirementMB": 8192,
      "ramRequirementMB": 16384,
      "requiresGPU": true,
      "costPer1kTokens": 0,
      "provider": "ollama"
    },
    {
      "modelId": "mistral:7b",
      "displayName": "Mistral 7B",
      "parameterCount": 7000000000,
      "flopsPerToken": 14000000000,
      "vramRequirementMB": 8192,
      "ramRequirementMB": 16384,
      "requiresGPU": true,
      "costPer1kTokens": 0,
      "provider": "ollama"
    },
    {
      "modelId": "gpt-4o-mini",
      "displayName": "GPT-4o Mini",
      "parameterCount": 8000000000,
      "flopsPerToken": 16000000000,
      "vramRequirementMB": 0,
      "ramRequirementMB": 0,
      "requiresGPU": false,
      "costPer1kTokens": 0.00015,
      "provider": "openai"
    },
    {
      "modelId": "claude-3-haiku",
      "displayName": "Claude 3 Haiku",
      "parameterCount": 20000000000,
      "flopsPerToken": 40000000000,
      "vramRequirementMB": 0,
      "ramRequirementMB": 0,
      "requiresGPU": false,
      "costPer1kTokens": 0.00025,
      "provider": "anthropic"
    }
  ]
}
```

### 2.2 config/fitness-config.json

Fitness formula configuration.

```json
{
  "formula": {
    "description": "ModelFitness = (P × S × W) / (C_norm × C_compute × C_hw)^λ",
    "lambda": 1.5,
    "baselineCost": 0.01
  },

  "hardwareWeights": {
    "alpha": 0.0001,
    "beta": 0.00001,
    "gamma": 0.5,
    "description": "C_hw = α×VRAM + β×RAM + γ×(GPU ? 1 : 0.1)"
  },

  "performanceWeights": {
    "qualityScore": 0.5,
    "testsPassRate": 0.5,
    "description": "P = qualityScore × 0.5 + testsPassRate × 0.5"
  },

  "composabilityPenalties": {
    "hallucinationPenalty": 0.5,
    "formatNonCompliance": 0.8,
    "description": "W = formatCompliance × (hallucination ? 0.5 : 1.0)"
  },

  "thresholds": {
    "minimumFitness": 0.3,
    "goodFitness": 0.6,
    "excellentFitness": 0.8,
    "publishThreshold": 0.75
  },

  "earlyStopping": {
    "plateauPatience": 10,
    "minImprovement": 0.001,
    "maxIterationsWithoutImprovement": 20
  }
}
```

---

## 3. Tool Blocks

### 3.1 fitness-calculator.tool.block.json

```json
{
  "id": "fitness-calculator",
  "name": "Fitness Calculator",
  "blockType": "tool",
  "version": "1.0.0",
  "description": "Calculates model fitness score using the Maestro formula",
  "isAtomic": true,
  "isSystem": false,

  "config": {
    "toolType": "script",
    "runtime": "javascript",
    "script": "fitness-calculator.js"
  },

  "inputs": {
    "executionMetrics": {
      "type": "object",
      "required": true,
      "properties": {
        "success": { "type": "boolean" },
        "qualityScore": { "type": "number", "min": 0, "max": 1 },
        "testsPassRate": { "type": "number", "min": 0, "max": 1 },
        "costUsd": { "type": "number" },
        "inputTokens": { "type": "integer" },
        "outputTokens": { "type": "integer" },
        "durationMs": { "type": "integer" },
        "formatCompliance": { "type": "number", "min": 0, "max": 1 },
        "hallucinationDetected": { "type": "boolean" }
      }
    },
    "modelId": {
      "type": "string",
      "required": true,
      "description": "Model ID to lookup profile"
    },
    "taskType": {
      "type": "string",
      "required": false,
      "default": "general",
      "description": "Task type for entropy calculation"
    }
  },

  "outputs": {
    "totalFitness": { "type": "number" },
    "breakdown": {
      "type": "object",
      "properties": {
        "performance": { "type": "number" },
        "specialization": { "type": "number" },
        "composability": { "type": "number" },
        "economicCost": { "type": "number" },
        "computeCost": { "type": "number" },
        "hardwareCost": { "type": "number" }
      }
    },
    "interpretation": { "type": "string" }
  },

  "metadata": {
    "category": "metrics",
    "tags": ["fitness", "evaluation", "metrics"]
  }
}
```

### 3.2 data-store.tool.block.json

```json
{
  "id": "data-store",
  "name": "Data Store",
  "blockType": "tool",
  "version": "1.0.0",
  "description": "Reads and writes JSON data files in the workspace data folder",
  "isAtomic": true,
  "isSystem": false,

  "config": {
    "toolType": "script",
    "runtime": "javascript",
    "script": "data-store.js",
    "basePath": "data/"
  },

  "inputs": {
    "action": {
      "type": "string",
      "required": true,
      "enum": ["read", "write", "list", "delete", "append"]
    },
    "collection": {
      "type": "string",
      "required": true,
      "description": "Subfolder name (experiments, metrics, leaderboard, checkpoints)"
    },
    "id": {
      "type": "string",
      "required": false,
      "description": "Document ID (without .json extension)"
    },
    "data": {
      "type": "object",
      "required": false,
      "description": "Data to write (for write/append actions)"
    },
    "filter": {
      "type": "object",
      "required": false,
      "description": "Filter criteria for list action"
    }
  },

  "outputs": {
    "success": { "type": "boolean" },
    "data": { "type": "any", "description": "Read data or list of documents" },
    "error": { "type": "string" }
  },

  "metadata": {
    "category": "storage",
    "tags": ["data", "json", "persistence"]
  }
}
```

### 3.3 metrics-collector.tool.block.json

```json
{
  "id": "metrics-collector",
  "name": "Metrics Collector",
  "blockType": "tool",
  "version": "1.0.0",
  "description": "Collects and aggregates metrics over time",
  "isAtomic": true,
  "isSystem": false,

  "config": {
    "toolType": "script",
    "runtime": "javascript",
    "script": "metrics-collector.js"
  },

  "inputs": {
    "action": {
      "type": "string",
      "required": true,
      "enum": ["record", "aggregate", "history", "compare"]
    },
    "experimentId": {
      "type": "string",
      "required": true
    },
    "iteration": {
      "type": "integer",
      "required": false
    },
    "metrics": {
      "type": "object",
      "required": false,
      "description": "Metrics to record"
    },
    "timeRange": {
      "type": "object",
      "required": false,
      "properties": {
        "start": { "type": "string", "format": "date-time" },
        "end": { "type": "string", "format": "date-time" }
      }
    }
  },

  "outputs": {
    "success": { "type": "boolean" },
    "aggregated": {
      "type": "object",
      "properties": {
        "averageFitness": { "type": "number" },
        "maxFitness": { "type": "number" },
        "minFitness": { "type": "number" },
        "fitnessVariance": { "type": "number" },
        "totalCost": { "type": "number" },
        "totalIterations": { "type": "integer" }
      }
    },
    "history": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "iteration": { "type": "integer" },
          "fitness": { "type": "number" },
          "timestamp": { "type": "string" }
        }
      }
    }
  },

  "metadata": {
    "category": "metrics",
    "tags": ["metrics", "aggregation", "history"]
  }
}
```

### 3.4 leaderboard-manager.tool.block.json

```json
{
  "id": "leaderboard-manager",
  "name": "Leaderboard Manager",
  "blockType": "tool",
  "version": "1.0.0",
  "description": "Manages the fitness leaderboard rankings",
  "isAtomic": true,
  "isSystem": false,

  "config": {
    "toolType": "script",
    "runtime": "javascript",
    "script": "leaderboard-manager.js",
    "maxEntries": 50
  },

  "inputs": {
    "action": {
      "type": "string",
      "required": true,
      "enum": ["update", "get", "getTop", "getByModel", "clear"]
    },
    "entry": {
      "type": "object",
      "required": false,
      "properties": {
        "modelId": { "type": "string" },
        "experimentId": { "type": "string" },
        "fitness": { "type": "number" },
        "taskType": { "type": "string" },
        "strategy": { "type": "string" },
        "timestamp": { "type": "string" }
      }
    },
    "limit": {
      "type": "integer",
      "required": false,
      "default": 10
    },
    "taskType": {
      "type": "string",
      "required": false,
      "description": "Filter by task type"
    }
  },

  "outputs": {
    "success": { "type": "boolean" },
    "leaderboard": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "rank": { "type": "integer" },
          "modelId": { "type": "string" },
          "fitness": { "type": "number" },
          "experimentId": { "type": "string" },
          "change": { "type": "string", "enum": ["up", "down", "same", "new"] }
        }
      }
    }
  },

  "metadata": {
    "category": "metrics",
    "tags": ["leaderboard", "ranking", "comparison"]
  }
}
```

### 3.5 checkpoint-manager.tool.block.json

```json
{
  "id": "checkpoint-manager",
  "name": "Checkpoint Manager",
  "blockType": "tool",
  "version": "1.0.0",
  "description": "Manages training checkpoints for recovery and comparison",
  "isAtomic": true,
  "isSystem": false,

  "config": {
    "toolType": "script",
    "runtime": "javascript",
    "script": "checkpoint-manager.js",
    "maxCheckpoints": 10
  },

  "inputs": {
    "action": {
      "type": "string",
      "required": true,
      "enum": ["save", "load", "list", "delete", "getBest"]
    },
    "experimentId": {
      "type": "string",
      "required": true
    },
    "iteration": {
      "type": "integer",
      "required": false
    },
    "state": {
      "type": "object",
      "required": false,
      "description": "State to save (for save action)"
    },
    "metadata": {
      "type": "object",
      "required": false,
      "properties": {
        "fitness": { "type": "number" },
        "reason": { "type": "string" }
      }
    }
  },

  "outputs": {
    "success": { "type": "boolean" },
    "checkpointId": { "type": "string" },
    "state": { "type": "object" },
    "checkpoints": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "iteration": { "type": "integer" },
          "fitness": { "type": "number" },
          "timestamp": { "type": "string" }
        }
      }
    }
  },

  "metadata": {
    "category": "training",
    "tags": ["checkpoint", "recovery", "state"]
  }
}
```

---

## 4. Agent Blocks

### 4.1 experiment-manager.agent.block.json

```json
{
  "id": "experiment-manager",
  "name": "Experiment Manager",
  "blockType": "agent",
  "version": "1.0.0",
  "description": "Orchestrates training experiments using different strategies",
  "isAtomic": false,
  "isSystem": false,

  "config": {
    "model": "smollm2:1.7b",
    "maxTokens": 4096,
    "temperature": 0.3,
    "capabilities": [
      "experiment-lifecycle",
      "strategy-selection",
      "parallel-execution",
      "result-comparison"
    ]
  },

  "tools": [
    "data-store",
    "fitness-calculator",
    "leaderboard-manager",
    "metrics-collector",
    "checkpoint-manager"
  ],

  "actions": {
    "create": {
      "description": "Create a new experiment",
      "inputs": {
        "name": { "type": "string", "required": true },
        "targetAgentId": { "type": "string", "required": true },
        "strategyId": { "type": "string", "required": true },
        "config": { "type": "object", "required": false }
      },
      "outputs": {
        "experimentId": { "type": "string" }
      }
    },
    "start": {
      "description": "Start an experiment",
      "inputs": {
        "experimentId": { "type": "string", "required": true }
      },
      "outputs": {
        "sessionId": { "type": "string" }
      }
    },
    "stop": {
      "description": "Stop a running experiment",
      "inputs": {
        "experimentId": { "type": "string", "required": true }
      },
      "outputs": {
        "checkpointId": { "type": "string" }
      }
    },
    "pause": {
      "description": "Pause a running experiment",
      "inputs": {
        "experimentId": { "type": "string", "required": true }
      },
      "outputs": {
        "checkpointId": { "type": "string" }
      }
    },
    "resume": {
      "description": "Resume a paused experiment",
      "inputs": {
        "experimentId": { "type": "string", "required": true }
      },
      "outputs": {
        "sessionId": { "type": "string" }
      }
    },
    "list": {
      "description": "List all experiments",
      "inputs": {
        "status": { "type": "string", "required": false, "enum": ["pending", "running", "paused", "completed", "failed"] }
      },
      "outputs": {
        "experiments": { "type": "array" }
      }
    },
    "compare": {
      "description": "Compare multiple experiments",
      "inputs": {
        "experimentIds": { "type": "array", "items": { "type": "string" }, "required": true }
      },
      "outputs": {
        "comparison": { "type": "object" },
        "rankings": { "type": "array" }
      }
    },
    "recommend": {
      "description": "Recommend strategies for an agent",
      "inputs": {
        "agentId": { "type": "string", "required": true },
        "taskType": { "type": "string", "required": true }
      },
      "outputs": {
        "recommendations": { "type": "array" }
      }
    }
  },

  "systemPrompt": "You are the Experiment Manager for the Model Research workspace.\n\nYour role is to orchestrate training experiments using different strategies. You manage the full experiment lifecycle: creation, execution, monitoring, and comparison.\n\nCapabilities:\n1. Create experiments with specific strategies (SFT, RL-Fitness, Preference, etc.)\n2. Start, pause, resume, and stop experiments\n3. Monitor progress and fitness scores\n4. Compare experiments and update leaderboards\n5. Recommend strategies based on agent characteristics\n\nTools available:\n- data-store: Read/write experiment data to JSON files\n- fitness-calculator: Calculate fitness scores for iterations\n- leaderboard-manager: Update and query fitness rankings\n- metrics-collector: Track metrics over time\n- checkpoint-manager: Save/restore experiment state\n\nData is stored in the workspace data/ folder:\n- data/experiments/*.json - Experiment configurations and results\n- data/metrics/*.json - Historical metrics\n- data/leaderboard/*.json - Model rankings\n- data/checkpoints/*.json - Saved states\n\nWhen creating an experiment:\n1. Generate a unique experiment ID (exp-XXX format)\n2. Save experiment config to data/experiments/{id}.json\n3. Return the experiment ID\n\nWhen starting an experiment:\n1. Load experiment config\n2. Execute the strategy workflow block\n3. Update status and progress\n4. Calculate fitness after each iteration\n5. Update leaderboard when complete",

  "metadata": {
    "category": "orchestration",
    "tags": ["experiment", "manager", "orchestration"]
  }
}
```

### 4.2 researcher-agent.agent.block.json

```json
{
  "id": "researcher-agent",
  "name": "Researcher Agent",
  "blockType": "agent",
  "version": "1.0.0",
  "description": "Analyzes agent performance and identifies improvement opportunities",
  "isAtomic": false,
  "isSystem": false,

  "config": {
    "model": "smollm2:1.7b",
    "maxTokens": 4096,
    "temperature": 0.5,
    "capabilities": [
      "performance-analysis",
      "opportunity-identification",
      "hypothesis-generation"
    ]
  },

  "tools": [
    "data-store",
    "metrics-collector",
    "leaderboard-manager"
  ],

  "inputs": {
    "targetAgentId": { "type": "string", "required": true },
    "taskType": { "type": "string", "required": true },
    "currentMetrics": { "type": "object", "required": false }
  },

  "outputs": {
    "analysis": {
      "type": "object",
      "properties": {
        "currentFitness": { "type": "number" },
        "strengths": { "type": "array" },
        "weaknesses": { "type": "array" }
      }
    },
    "improvementPlan": {
      "type": "object",
      "properties": {
        "hypothesis": { "type": "string" },
        "suggestedStrategy": { "type": "string" },
        "expectedImprovement": { "type": "number" },
        "risks": { "type": "array" }
      }
    }
  },

  "systemPrompt": "You are the Researcher Agent in the Model Research workspace.\n\nYour role is to analyze agent performance and identify opportunities for improvement.\n\nResponsibilities:\n1. Analyze current fitness scores and metrics\n2. Identify strengths and weaknesses\n3. Compare against top performers in leaderboard\n4. Generate hypotheses for improvement\n5. Recommend training strategies\n\nWhen analyzing an agent:\n1. Load historical metrics from data-store\n2. Compare with leaderboard rankings\n3. Identify patterns in failures\n4. Suggest specific improvements\n\nOutput a structured improvement plan with:\n- Clear hypothesis to test\n- Recommended strategy\n- Expected fitness improvement\n- Potential risks",

  "metadata": {
    "category": "research",
    "tags": ["research", "analysis", "planning"]
  }
}
```

### 4.3 trainer-agent.agent.block.json

```json
{
  "id": "trainer-agent",
  "name": "Trainer Agent",
  "blockType": "agent",
  "version": "1.0.0",
  "description": "Executes training strategies and manages the training loop",
  "isAtomic": false,
  "isSystem": false,

  "config": {
    "model": "smollm2:1.7b",
    "maxTokens": 4096,
    "temperature": 0.3,
    "capabilities": [
      "strategy-execution",
      "progress-monitoring",
      "early-stopping"
    ]
  },

  "tools": [
    "data-store",
    "fitness-calculator",
    "metrics-collector",
    "checkpoint-manager"
  ],

  "workflows": [
    "training-loop"
  ],

  "inputs": {
    "targetAgentId": { "type": "string", "required": true },
    "strategyId": { "type": "string", "required": true },
    "improvementPlan": { "type": "object", "required": true },
    "config": {
      "type": "object",
      "properties": {
        "maxIterations": { "type": "integer", "default": 100 },
        "targetFitness": { "type": "number", "default": 0.8 }
      }
    }
  },

  "outputs": {
    "trainedAgentId": { "type": "string" },
    "trainingMetrics": {
      "type": "object",
      "properties": {
        "iterationsCompleted": { "type": "integer" },
        "finalFitness": { "type": "number" },
        "fitnessImprovement": { "type": "number" },
        "totalCost": { "type": "number" },
        "earlyStopReason": { "type": "string" }
      }
    }
  },

  "systemPrompt": "You are the Trainer Agent in the Model Research workspace.\n\nYour role is to execute training strategies and manage the training loop.\n\nResponsibilities:\n1. Execute the assigned training strategy\n2. Monitor fitness progress each iteration\n3. Apply early stopping when appropriate\n4. Save checkpoints at key moments\n5. Report training metrics\n\nTraining loop:\n1. For each iteration (up to maxIterations):\n   a. Execute strategy iteration\n   b. Calculate fitness score\n   c. Record metrics\n   d. Check early stopping conditions\n   e. Save checkpoint if best fitness\n2. Return final metrics and trained agent ID\n\nEarly stopping conditions:\n- Target fitness reached\n- Fitness plateau (no improvement for N iterations)\n- Maximum iterations reached\n- Cost budget exceeded",

  "metadata": {
    "category": "training",
    "tags": ["training", "execution", "strategy"]
  }
}
```

### 4.4 tester-agent.agent.block.json

```json
{
  "id": "tester-agent",
  "name": "Tester Agent",
  "blockType": "agent",
  "version": "1.0.0",
  "description": "Runs test suites and validates trained agent fitness",
  "isAtomic": false,
  "isSystem": false,

  "config": {
    "model": "smollm2:1.7b",
    "maxTokens": 4096,
    "temperature": 0.2,
    "capabilities": [
      "test-execution",
      "fitness-validation",
      "regression-detection"
    ]
  },

  "tools": [
    "data-store",
    "fitness-calculator",
    "metrics-collector"
  ],

  "inputs": {
    "trainedAgentId": { "type": "string", "required": true },
    "testSuiteId": { "type": "string", "required": false },
    "baselineAgentId": { "type": "string", "required": false }
  },

  "outputs": {
    "testResults": {
      "type": "object",
      "properties": {
        "passed": { "type": "integer" },
        "failed": { "type": "integer" },
        "skipped": { "type": "integer" },
        "passRate": { "type": "number" }
      }
    },
    "fitnessScore": { "type": "number" },
    "regressions": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "testId": { "type": "string" },
          "previousResult": { "type": "string" },
          "currentResult": { "type": "string" }
        }
      }
    },
    "approved": { "type": "boolean" }
  },

  "systemPrompt": "You are the Tester Agent in the Model Research workspace.\n\nYour role is to validate trained agents through comprehensive testing.\n\nResponsibilities:\n1. Run test suites against trained agents\n2. Calculate final fitness scores\n3. Detect regressions compared to baseline\n4. Approve or reject agents for next stage\n\nTesting process:\n1. Load test suite (default or specified)\n2. Execute each test case against trained agent\n3. Calculate pass rate and collect metrics\n4. Compare with baseline if provided\n5. Flag any regressions\n6. Calculate final fitness score\n7. Approve if fitness >= threshold (from config)\n\nApproval criteria:\n- Fitness >= workspace fitnessThreshold (0.7)\n- No critical regressions\n- Pass rate >= 80%",

  "metadata": {
    "category": "testing",
    "tags": ["testing", "validation", "quality"]
  }
}
```

### 4.5 documenter-agent.agent.block.json

```json
{
  "id": "documenter-agent",
  "name": "Documenter Agent",
  "blockType": "agent",
  "version": "1.0.0",
  "description": "Generates documentation for trained agents",
  "isAtomic": false,
  "isSystem": false,

  "config": {
    "model": "smollm2:1.7b",
    "maxTokens": 4096,
    "temperature": 0.4,
    "capabilities": [
      "documentation-generation",
      "changelog-creation",
      "comparison-reporting"
    ]
  },

  "tools": [
    "data-store"
  ],

  "inputs": {
    "trainedAgentId": { "type": "string", "required": true },
    "testResults": { "type": "object", "required": true },
    "trainingMetrics": { "type": "object", "required": true }
  },

  "outputs": {
    "documentation": {
      "type": "object",
      "properties": {
        "summary": { "type": "string" },
        "changelog": { "type": "string" },
        "performanceReport": { "type": "string" },
        "usageGuide": { "type": "string" }
      }
    }
  },

  "systemPrompt": "You are the Documenter Agent in the Model Research workspace.\n\nYour role is to generate comprehensive documentation for trained agents.\n\nResponsibilities:\n1. Create summary of training improvements\n2. Generate changelog comparing to previous version\n3. Write performance report with metrics\n4. Create usage guide for the improved agent\n\nDocumentation structure:\n1. Summary: Brief overview of what improved\n2. Changelog: List of changes with impact\n3. Performance Report: Fitness scores, test results, cost analysis\n4. Usage Guide: How to use the trained agent\n\nWrite documentation that is:\n- Clear and concise\n- Data-driven with specific metrics\n- Useful for both humans and other agents",

  "metadata": {
    "category": "documentation",
    "tags": ["documentation", "reporting", "changelog"]
  }
}
```

### 4.6 publisher-agent.agent.block.json

```json
{
  "id": "publisher-agent",
  "name": "Publisher Agent",
  "blockType": "agent",
  "version": "1.0.0",
  "description": "Publishes approved agents to the catalog",
  "isAtomic": false,
  "isSystem": false,

  "config": {
    "model": "smollm2:1.7b",
    "maxTokens": 2048,
    "temperature": 0.2,
    "capabilities": [
      "version-management",
      "catalog-publishing",
      "notification"
    ]
  },

  "tools": [
    "data-store",
    "leaderboard-manager"
  ],

  "inputs": {
    "trainedAgentId": { "type": "string", "required": true },
    "documentation": { "type": "object", "required": true },
    "fitnessScore": { "type": "number", "required": true }
  },

  "outputs": {
    "published": { "type": "boolean" },
    "version": { "type": "string" },
    "catalogEntry": {
      "type": "object",
      "properties": {
        "agentId": { "type": "string" },
        "version": { "type": "string" },
        "fitness": { "type": "number" },
        "publishedAt": { "type": "string" }
      }
    }
  },

  "systemPrompt": "You are the Publisher Agent in the Model Research workspace.\n\nYour role is to publish approved agents to the catalog.\n\nResponsibilities:\n1. Verify fitness meets publish threshold\n2. Assign version number (semver)\n3. Create catalog entry\n4. Update leaderboard\n5. Archive documentation\n\nPublishing process:\n1. Check fitness >= publishThreshold (0.75)\n2. Generate version: MAJOR.MINOR.PATCH\n   - MAJOR: Breaking changes\n   - MINOR: New capabilities\n   - PATCH: Bug fixes, minor improvements\n3. Create catalog entry with all metadata\n4. Update leaderboard with new entry\n5. Store documentation in data/\n\nOnly publish if all criteria are met:\n- Fitness >= 0.75\n- Tests passed\n- Documentation complete",

  "metadata": {
    "category": "publishing",
    "tags": ["publishing", "catalog", "versioning"]
  }
}
```

---

## 5. Workflow Blocks

### 5.1 research-team.workflow.block.json

```json
{
  "id": "research-team",
  "name": "Research Team",
  "blockType": "workflow",
  "version": "1.0.0",
  "description": "Full research pipeline: analyze, train, test, document, publish",
  "isAtomic": false,
  "isSystem": false,

  "config": {
    "maxRetries": 3,
    "parallel": false
  },

  "inputs": {
    "targetAgentId": {
      "type": "string",
      "required": true,
      "description": "ID of the agent to improve"
    },
    "taskType": {
      "type": "string",
      "required": true,
      "description": "Type of task (code, reasoning, creative, etc.)"
    },
    "maxIterations": {
      "type": "integer",
      "required": false,
      "default": 100,
      "description": "Maximum training iterations"
    }
  },

  "children": [
    {
      "id": "step-1-research",
      "blockRef": "researcher-agent",
      "inputs": {
        "targetAgentId": "{{inputs.targetAgentId}}",
        "taskType": "{{inputs.taskType}}"
      }
    },
    {
      "id": "step-2-train",
      "blockRef": "trainer-agent",
      "inputs": {
        "targetAgentId": "{{inputs.targetAgentId}}",
        "strategyId": "{{steps.step-1-research.outputs.improvementPlan.suggestedStrategy}}",
        "improvementPlan": "{{steps.step-1-research.outputs.improvementPlan}}",
        "config": {
          "maxIterations": "{{inputs.maxIterations}}"
        }
      }
    },
    {
      "id": "step-3-test",
      "blockRef": "tester-agent",
      "inputs": {
        "trainedAgentId": "{{steps.step-2-train.outputs.trainedAgentId}}",
        "baselineAgentId": "{{inputs.targetAgentId}}"
      }
    },
    {
      "id": "decision-fitness-check",
      "blockType": "decision",
      "condition": "{{steps.step-3-test.outputs.approved}} === true",
      "onTrue": "step-4-document",
      "onFalse": "step-retry-or-fail"
    },
    {
      "id": "step-retry-or-fail",
      "blockType": "decision",
      "condition": "{{context.retryCount}} < 3",
      "onTrue": "step-1-research",
      "onFalse": "output-failure"
    },
    {
      "id": "step-4-document",
      "blockRef": "documenter-agent",
      "inputs": {
        "trainedAgentId": "{{steps.step-2-train.outputs.trainedAgentId}}",
        "testResults": "{{steps.step-3-test.outputs.testResults}}",
        "trainingMetrics": "{{steps.step-2-train.outputs.trainingMetrics}}"
      }
    },
    {
      "id": "step-5-publish",
      "blockRef": "publisher-agent",
      "inputs": {
        "trainedAgentId": "{{steps.step-2-train.outputs.trainedAgentId}}",
        "documentation": "{{steps.step-4-document.outputs.documentation}}",
        "fitnessScore": "{{steps.step-3-test.outputs.fitnessScore}}"
      }
    }
  ],

  "outputs": {
    "success": {
      "type": "boolean",
      "value": "{{steps.step-5-publish.outputs.published}}"
    },
    "improvedAgentId": {
      "type": "string",
      "value": "{{steps.step-2-train.outputs.trainedAgentId}}"
    },
    "fitnessImprovement": {
      "type": "number",
      "value": "{{steps.step-2-train.outputs.trainingMetrics.fitnessImprovement}}"
    },
    "publishedVersion": {
      "type": "string",
      "value": "{{steps.step-5-publish.outputs.version}}"
    }
  },

  "metadata": {
    "category": "research",
    "tags": ["research", "pipeline", "team"],
    "estimatedDuration": "30-120 minutes depending on iterations"
  }
}
```

### 5.2 training-loop.workflow.block.json

```json
{
  "id": "training-loop",
  "name": "Training Loop",
  "blockType": "workflow",
  "version": "1.0.0",
  "description": "Core training iteration loop with fitness tracking",
  "isAtomic": false,
  "isSystem": false,

  "config": {
    "loopType": "for",
    "maxIterations": "{{inputs.maxIterations}}"
  },

  "inputs": {
    "targetAgentId": { "type": "string", "required": true },
    "strategyBlockId": { "type": "string", "required": true },
    "maxIterations": { "type": "integer", "default": 100 },
    "targetFitness": { "type": "number", "default": 0.8 },
    "config": { "type": "object" }
  },

  "children": [
    {
      "id": "init-load-config",
      "blockType": "script",
      "config": {
        "script": "const config = await loadFitnessConfig(); return { config, iteration: 0, fitnessHistory: [] };"
      }
    },
    {
      "id": "loop-start",
      "blockType": "loop",
      "config": {
        "type": "while",
        "condition": "{{context.iteration}} < {{inputs.maxIterations}} && !{{context.shouldStop}}"
      },
      "children": [
        {
          "id": "step-execute-strategy",
          "blockRef": "{{inputs.strategyBlockId}}",
          "inputs": {
            "agentId": "{{inputs.targetAgentId}}",
            "iterationNumber": "{{context.iteration}}",
            "previousState": "{{context.previousState}}"
          }
        },
        {
          "id": "step-calculate-fitness",
          "blockRef": "fitness-calculator",
          "inputs": {
            "executionMetrics": "{{steps.step-execute-strategy.outputs.metrics}}",
            "modelId": "{{context.modelId}}",
            "taskType": "{{context.taskType}}"
          }
        },
        {
          "id": "step-collect-metrics",
          "blockRef": "metrics-collector",
          "inputs": {
            "action": "record",
            "experimentId": "{{context.experimentId}}",
            "iteration": "{{context.iteration}}",
            "metrics": {
              "fitness": "{{steps.step-calculate-fitness.outputs.totalFitness}}",
              "cost": "{{steps.step-execute-strategy.outputs.cost}}",
              "duration": "{{steps.step-execute-strategy.outputs.duration}}"
            }
          }
        },
        {
          "id": "step-check-early-stop",
          "blockType": "script",
          "config": {
            "script": "return checkEarlyStopping(context.fitnessHistory, inputs.targetFitness);"
          }
        },
        {
          "id": "step-save-checkpoint-if-best",
          "blockRef": "checkpoint-manager",
          "condition": "{{steps.step-calculate-fitness.outputs.totalFitness}} > {{context.bestFitness}}",
          "inputs": {
            "action": "save",
            "experimentId": "{{context.experimentId}}",
            "iteration": "{{context.iteration}}",
            "state": "{{steps.step-execute-strategy.outputs.state}}",
            "metadata": {
              "fitness": "{{steps.step-calculate-fitness.outputs.totalFitness}}",
              "reason": "best_fitness"
            }
          }
        }
      ]
    }
  ],

  "outputs": {
    "finalFitness": { "type": "number" },
    "iterationsCompleted": { "type": "integer" },
    "fitnessHistory": { "type": "array" },
    "totalCost": { "type": "number" },
    "checkpointId": { "type": "string" }
  },

  "metadata": {
    "category": "training",
    "tags": ["training", "loop", "iteration"]
  }
}
```

### 5.3 experiment-pipeline.workflow.block.json

```json
{
  "id": "experiment-pipeline",
  "name": "Experiment Pipeline",
  "blockType": "workflow",
  "version": "1.0.0",
  "description": "Single experiment execution from start to finish",
  "isAtomic": false,
  "isSystem": false,

  "inputs": {
    "experimentId": { "type": "string", "required": true }
  },

  "children": [
    {
      "id": "step-load-experiment",
      "blockRef": "data-store",
      "inputs": {
        "action": "read",
        "collection": "experiments",
        "id": "{{inputs.experimentId}}"
      }
    },
    {
      "id": "step-update-status-running",
      "blockRef": "data-store",
      "inputs": {
        "action": "write",
        "collection": "experiments",
        "id": "{{inputs.experimentId}}",
        "data": {
          "status": "running",
          "startedAt": "{{now()}}"
        }
      }
    },
    {
      "id": "step-execute-training",
      "blockRef": "training-loop",
      "inputs": {
        "targetAgentId": "{{steps.step-load-experiment.outputs.data.targetAgentId}}",
        "strategyBlockId": "{{steps.step-load-experiment.outputs.data.strategyId}}",
        "maxIterations": "{{steps.step-load-experiment.outputs.data.config.maxIterations}}",
        "targetFitness": "{{steps.step-load-experiment.outputs.data.config.targetFitness}}"
      }
    },
    {
      "id": "step-update-leaderboard",
      "blockRef": "leaderboard-manager",
      "inputs": {
        "action": "update",
        "entry": {
          "modelId": "{{steps.step-load-experiment.outputs.data.modelId}}",
          "experimentId": "{{inputs.experimentId}}",
          "fitness": "{{steps.step-execute-training.outputs.finalFitness}}",
          "taskType": "{{steps.step-load-experiment.outputs.data.taskType}}",
          "strategy": "{{steps.step-load-experiment.outputs.data.strategyId}}"
        }
      }
    },
    {
      "id": "step-update-status-complete",
      "blockRef": "data-store",
      "inputs": {
        "action": "write",
        "collection": "experiments",
        "id": "{{inputs.experimentId}}",
        "data": {
          "status": "completed",
          "completedAt": "{{now()}}",
          "results": "{{steps.step-execute-training.outputs}}"
        }
      }
    }
  ],

  "outputs": {
    "experimentId": { "type": "string" },
    "finalFitness": { "type": "number" },
    "iterationsCompleted": { "type": "integer" },
    "leaderboardPosition": { "type": "integer" }
  },

  "metadata": {
    "category": "experiment",
    "tags": ["experiment", "pipeline", "execution"]
  }
}
```

---

## 6. Strategy Blocks

### 6.1 rl-fitness-strategy.workflow.block.json

```json
{
  "id": "rl-fitness-strategy",
  "name": "RL-Fitness Strategy",
  "blockType": "workflow",
  "version": "1.0.0",
  "description": "Reinforcement learning strategy using fitness as reward",
  "isAtomic": false,
  "isSystem": false,

  "metadata": {
    "method": "ReinforcementLearning",
    "category": "reinforcement",
    "suitableFor": ["reasoning", "code", "agentic"],
    "estimatedResources": {
      "minIterations": 50,
      "typicalIterations": 500,
      "maxIterations": 2000
    }
  },

  "config": {
    "algorithm": "PPO",
    "explorationRate": 0.1,
    "explorationDecay": 0.995,
    "rewardShaping": {
      "fitnessImprovement": 1.0,
      "costPenalty": -0.1,
      "formatCompliance": 0.2
    },
    "earlyStopping": {
      "fitnessThreshold": 0.9,
      "plateauPatience": 20
    }
  },

  "inputs": {
    "agentId": { "type": "string", "required": true },
    "taskWorkflowId": { "type": "string", "required": true },
    "iterationNumber": { "type": "integer", "required": true },
    "previousState": { "type": "object" }
  },

  "children": [
    {
      "id": "step-generate-action",
      "blockType": "inference",
      "config": {
        "model": "smollm2:1.7b",
        "prompt": "Execute task with exploration rate {{config.explorationRate}}"
      }
    },
    {
      "id": "step-execute-task",
      "blockRef": "{{inputs.taskWorkflowId}}",
      "inputs": {
        "agentId": "{{inputs.agentId}}",
        "action": "{{steps.step-generate-action.outputs.action}}"
      }
    },
    {
      "id": "step-calculate-reward",
      "blockType": "script",
      "config": {
        "script": "return calculatePPOReward(currentFitness, previousFitness, config.rewardShaping);"
      }
    },
    {
      "id": "step-update-policy",
      "blockType": "script",
      "config": {
        "script": "return updatePPOPolicy(state, reward, config);"
      }
    },
    {
      "id": "step-decay-exploration",
      "blockType": "script",
      "config": {
        "script": "return { explorationRate: context.explorationRate * config.explorationDecay };"
      }
    }
  ],

  "outputs": {
    "iterationResult": { "type": "object" },
    "metrics": {
      "type": "object",
      "properties": {
        "success": { "type": "boolean" },
        "qualityScore": { "type": "number" },
        "testsPassRate": { "type": "number" },
        "costUsd": { "type": "number" },
        "formatCompliance": { "type": "number" }
      }
    },
    "reward": { "type": "number" },
    "explorationRate": { "type": "number" },
    "state": { "type": "object" }
  }
}
```

### 6.2 sft-strategy.workflow.block.json

```json
{
  "id": "sft-strategy",
  "name": "Supervised Fine-Tuning Strategy",
  "blockType": "workflow",
  "version": "1.0.0",
  "description": "Supervised learning from examples with fitness validation",
  "isAtomic": false,
  "isSystem": false,

  "metadata": {
    "method": "SupervisedFineTuning",
    "category": "supervised",
    "suitableFor": ["instruction-following", "formatting", "simple-tasks"],
    "estimatedResources": {
      "minIterations": 10,
      "typicalIterations": 100,
      "maxIterations": 500
    }
  },

  "config": {
    "learningRate": 0.001,
    "batchSize": 4,
    "validationSplit": 0.2,
    "earlyStopping": {
      "patience": 5,
      "minDelta": 0.001
    }
  },

  "inputs": {
    "agentId": { "type": "string", "required": true },
    "trainingExamples": { "type": "array", "required": true },
    "iterationNumber": { "type": "integer", "required": true },
    "previousState": { "type": "object" }
  },

  "children": [
    {
      "id": "step-select-batch",
      "blockType": "script",
      "config": {
        "script": "return selectTrainingBatch(inputs.trainingExamples, config.batchSize, iteration);"
      }
    },
    {
      "id": "step-train-on-batch",
      "blockType": "inference",
      "config": {
        "model": "smollm2:1.7b",
        "prompt": "Learn from examples: {{steps.step-select-batch.outputs.batch}}"
      }
    },
    {
      "id": "step-validate",
      "blockType": "script",
      "config": {
        "script": "return validateOnHeldOut(validationSet);"
      }
    }
  ],

  "outputs": {
    "iterationResult": { "type": "object" },
    "metrics": {
      "type": "object",
      "properties": {
        "success": { "type": "boolean" },
        "qualityScore": { "type": "number" },
        "testsPassRate": { "type": "number" },
        "costUsd": { "type": "number" },
        "formatCompliance": { "type": "number" },
        "validationLoss": { "type": "number" }
      }
    },
    "state": { "type": "object" }
  }
}
```

---

## 7. UI Block

### 7.1 research-dashboard.ui.block.json

```json
{
  "id": "research-dashboard",
  "name": "Research Dashboard",
  "blockType": "ui",
  "version": "1.0.0",
  "description": "Custom dashboard for the research workspace",
  "isAtomic": true,
  "isSystem": false,

  "config": {
    "entrypoint": "assets/dashboard.html",
    "displayMode": "fullpage",
    "framework": "vanilla",
    "sandbox": true,
    "permissions": [
      "read-data",
      "execute-blocks"
    ],
    "refreshInterval": 5000
  },

  "dataBindings": {
    "experiments": {
      "source": "data/experiments/*.json",
      "watch": true
    },
    "leaderboard": {
      "source": "data/leaderboard/leaderboard.json",
      "watch": true
    },
    "metrics": {
      "source": "data/metrics/metrics-history.json",
      "watch": true
    },
    "config": {
      "source": "config/fitness-config.json",
      "watch": false
    }
  },

  "actions": {
    "runExperiment": {
      "blockRef": "experiment-manager",
      "action": "start"
    },
    "pauseExperiment": {
      "blockRef": "experiment-manager",
      "action": "pause"
    },
    "stopExperiment": {
      "blockRef": "experiment-manager",
      "action": "stop"
    },
    "runResearchTeam": {
      "blockRef": "research-team"
    },
    "compareExperiments": {
      "blockRef": "experiment-manager",
      "action": "compare"
    }
  },

  "styles": {
    "width": "100%",
    "height": "100%",
    "background": "var(--bg-primary)"
  },

  "metadata": {
    "category": "ui",
    "tags": ["dashboard", "monitoring", "visualization"]
  }
}
```

---

## 8. Data Schemas

### 8.1 Experiment Schema (data/experiments/*.json)

```json
{
  "$schema": "experiment-schema",
  "id": "exp-001",
  "name": "Test RL on code-gen",
  "status": "running",
  "targetAgentId": "code-gen-agent",
  "strategyId": "rl-fitness-strategy",
  "modelId": "smollm2:1.7b",
  "taskType": "code",

  "config": {
    "maxIterations": 100,
    "targetFitness": 0.8,
    "strategyConfig": {}
  },

  "progress": {
    "currentIteration": 34,
    "currentFitness": 0.723,
    "bestFitness": 0.741,
    "bestIteration": 28
  },

  "metrics": {
    "totalCost": 0.0,
    "totalDuration": 123456,
    "averageFitness": 0.65,
    "fitnessVariance": 0.02
  },

  "timestamps": {
    "createdAt": "2026-02-03T10:00:00Z",
    "startedAt": "2026-02-03T10:05:00Z",
    "lastUpdateAt": "2026-02-03T10:30:00Z",
    "completedAt": null
  },

  "results": null,
  "checkpointId": "ckpt-exp001-028"
}
```

### 8.2 Leaderboard Schema (data/leaderboard/leaderboard.json)

```json
{
  "$schema": "leaderboard-schema",
  "lastUpdated": "2026-02-03T10:30:00Z",

  "rankings": [
    {
      "rank": 1,
      "modelId": "llama3:8b",
      "experimentId": "exp-003",
      "fitness": 0.847,
      "taskType": "code",
      "strategy": "sft-strategy",
      "achievedAt": "2026-02-02T15:00:00Z",
      "previousRank": 2,
      "change": "up"
    },
    {
      "rank": 2,
      "modelId": "mistral:7b",
      "experimentId": "exp-002",
      "fitness": 0.823,
      "taskType": "code",
      "strategy": "rl-fitness-strategy",
      "achievedAt": "2026-02-01T12:00:00Z",
      "previousRank": 1,
      "change": "down"
    }
  ],

  "byTaskType": {
    "code": [...],
    "reasoning": [...],
    "creative": [...]
  }
}
```

### 8.3 Metrics History Schema (data/metrics/metrics-history.json)

```json
{
  "$schema": "metrics-history-schema",

  "experiments": {
    "exp-001": {
      "iterations": [
        {
          "iteration": 1,
          "timestamp": "2026-02-03T10:05:30Z",
          "fitness": 0.45,
          "cost": 0.0,
          "duration": 1234,
          "breakdown": {
            "performance": 0.6,
            "specialization": 0.5,
            "composability": 0.8,
            "economicCost": 1.0,
            "computeCost": 1.2,
            "hardwareCost": 0.5
          }
        }
      ],
      "aggregates": {
        "averageFitness": 0.65,
        "maxFitness": 0.741,
        "minFitness": 0.45,
        "totalCost": 0.0,
        "totalIterations": 34
      }
    }
  }
}
```

---

## 9. Usage Commands

### 9.1 Workspace Management

```bash
# View workspace info
maestro workspace info model-research

# List all blocks in workspace
maestro blocks list --workspace model-research

# View specific block
maestro blocks show experiment-manager --workspace model-research
```

### 9.2 Experiment Management

```bash
# Create new experiment
maestro run experiment-manager \
  --workspace model-research \
  --action create \
  --input name="Test RL on code-gen" \
  --input targetAgentId=code-gen-agent \
  --input strategyId=rl-fitness-strategy \
  --input config='{"maxIterations": 100}'

# Start experiment
maestro run experiment-manager \
  --workspace model-research \
  --action start \
  --input experimentId=exp-001

# List experiments
maestro run experiment-manager \
  --workspace model-research \
  --action list

# Pause experiment
maestro run experiment-manager \
  --workspace model-research \
  --action pause \
  --input experimentId=exp-001

# Compare experiments
maestro run experiment-manager \
  --workspace model-research \
  --action compare \
  --input experimentIds='["exp-001", "exp-002"]'
```

### 9.3 Full Research Pipeline

```bash
# Run complete research team workflow
maestro run research-team \
  --workspace model-research \
  --input targetAgentId=code-gen-agent \
  --input taskType=code \
  --input maxIterations=100
```

### 9.4 Direct Tool Usage

```bash
# Calculate fitness manually
maestro run fitness-calculator \
  --workspace model-research \
  --input executionMetrics='{"qualityScore": 0.8, "testsPassRate": 0.9, ...}' \
  --input modelId=smollm2:1.7b

# View leaderboard
maestro run leaderboard-manager \
  --workspace model-research \
  --action getTop \
  --input limit=10
```

---

## 10. Switching Models

When ready to use production models:

### 10.1 Edit Block Configs

```bash
# Edit trainer-agent to use better model
# In blocks/agents/trainer-agent.agent.block.json:
# Change: "model": "smollm2:1.7b" → "model": "gpt-4o-mini"
```

### 10.2 Update Model Profiles

```bash
# Ensure production model is in config/models.json
# Add profile for the new model if not present
```

### 10.3 No Code Changes Required

The workspace is fully self-contained. Changing models is just a config change.

---

*"The workspace is the experiment lab. Everything it needs is inside it."*
