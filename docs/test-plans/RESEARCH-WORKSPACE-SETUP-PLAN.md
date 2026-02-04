# Research Workspace Setup Plan

**Purpose**: Step-by-step plan to set up the Model Research workspace via CLI and API
**Date**: February 4, 2026
**Status**: ✅ EXECUTED SUCCESSFULLY
**Workspace ID**: `1e6a7ad8-b09d-40b8-a34c-01fc5c7bf7e6`
**Prerequisite Documents**:
- `docs/analysis/RESEARCH-WORKSPACE-ARCHITECTURE-ANALYSIS.md`
- `docs/workspaces/WORKSPACE-SETUP-MODEL-RESEARCH.md`
- `docs/implementation/IMPLEMENTATION-PLAN-RESEARCH-WORKSPACE.md`

---

## Overview

This plan provides reproducible steps to create and populate the Model Research workspace. Each step includes:
- CLI/API command to execute
- Expected result
- Verification method
- Frontend visualization point

---

## Pre-requisites

### System Check

```bash
# 1. Start all services
powershell.exe -File C:\Meastro\scripts\dev-start.ps1

# 2. Verify services are running
cd C:\Meastro\tools\maestro-cli
node index.js health
```

**Expected Result:**
```json
{
  "status": "healthy",
  "services": {
    "backend": "running",
    "llm-provider": "running",
    "frontend": "running"
  }
}
```

**Frontend Verification:** Navigate to http://localhost:5173/ - Should see Maestro dashboard

---

## Phase 1: Create Workspace

### Step 1.1: Create Model Research Workspace

**Command:**
```bash
curl -X POST http://localhost:5000/api/workspaces \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Model Research",
    "description": "Autonomous training workspace for researching and optimizing LLM model fitness",
    "type": "Research",
    "settings": {
      "defaultModel": "smollm2:1.7b",
      "maxConcurrentSessions": 3,
      "autoArchiveAfterDays": 30
    }
  }'
```

**Expected Result:**
```json
{
  "id": "model-research",
  "name": "Model Research",
  "type": "Research",
  "status": "Active",
  "path": "data/workspaces/model-research",
  "sessionIds": [],
  "projectIds": [],
  "createdAt": "2026-02-04T...",
  "updatedAt": "2026-02-04T..."
}
```

**Frontend Verification:**
- Navigate to http://localhost:5173/workspaces
- Should see "Model Research" workspace card
- Status should show "Active"
- Type badge should show "Research"

---

### Step 1.2: Configure Workspace Permissions

**Command:**
```bash
curl -X PUT http://localhost:5000/api/workspaces/model-research/permissions \
  -H "Content-Type: application/json" \
  -d '{
    "allowedCommands": ["run", "list-tools", "list-blocks", "describe", "data", "session", "block"],
    "allowedTools": ["*"],
    "allowedBlocks": ["*"],
    "canCreateBlocks": true,
    "canCreateSessions": true,
    "dataCollections": ["*"],
    "allowedPaths": ["blocks/", "data/", "config/"]
  }'
```

**Expected Result:**
```json
{
  "success": true,
  "permissions": {
    "allowedCommands": ["run", "list-tools", "list-blocks", "describe", "data", "session", "block"],
    "allowedTools": ["*"],
    "allowedBlocks": ["*"],
    "canCreateBlocks": true,
    "canCreateSessions": true,
    "dataCollections": ["*"],
    "allowedPaths": ["blocks/", "data/", "config/"]
  }
}
```

**Frontend Verification:**
- Click on "Model Research" workspace card
- Navigate to Permissions tab
- Should show all permissions configured

---

### Step 1.3: Set Session Templates

**Command:**
```bash
curl -X PUT "http://localhost:5000/api/workspaces/model-research/session-templates/Training" \
  -H "Content-Type: application/json" \
  -d '{
    "permissions": {
      "allowedCommands": ["run", "list-tools", "data"],
      "allowedTools": ["fitness-calculator", "data-store", "metrics-collector"],
      "canCreateBlocks": false,
      "canCreateSessions": false,
      "dataCollections": ["experiments", "metrics", "checkpoints"]
    },
    "logAllCommands": true
  }'
```

**Expected Result:**
```json
{
  "success": true,
  "template": {
    "type": "Training",
    "permissions": { ... },
    "logAllCommands": true
  }
}
```

---

### Step 1.4: Set Entry Points

**Command:**
```bash
# Main entry point
curl -X PUT "http://localhost:5000/api/workspaces/model-research/entry-points/main" \
  -H "Content-Type: application/json" \
  -d '{"blockId": "research-team"}'

# Dashboard entry point
curl -X PUT "http://localhost:5000/api/workspaces/model-research/entry-points/dashboard" \
  -H "Content-Type: application/json" \
  -d '{"blockId": "research-dashboard"}'

# Experiments entry point
curl -X PUT "http://localhost:5000/api/workspaces/model-research/entry-points/experiments" \
  -H "Content-Type: application/json" \
  -d '{"blockId": "experiment-manager"}'
```

**Expected Result:**
```json
{
  "entryPoints": {
    "main": "research-team",
    "dashboard": "research-dashboard",
    "experiments": "experiment-manager"
  }
}
```

**Frontend Verification:**
- In workspace detail page, entry points should show in Overview tab
- Quick action buttons should appear for each entry point

---

## Phase 2: Create Workspace Folder Structure

### Step 2.1: Create Directory Structure

**Command (PowerShell):**
```powershell
$basePath = "C:\Meastro\data\workspaces\model-research"

# Create folder structure
New-Item -ItemType Directory -Force -Path @(
    "$basePath\blocks\agents",
    "$basePath\blocks\workflows",
    "$basePath\blocks\strategies",
    "$basePath\blocks\tools",
    "$basePath\blocks\ui",
    "$basePath\blocks\ui\assets",
    "$basePath\data\experiments",
    "$basePath\data\metrics",
    "$basePath\data\leaderboard",
    "$basePath\data\checkpoints",
    "$basePath\config"
)
```

**Expected Result:**
```
Directory structure created:
data/workspaces/model-research/
├── blocks/
│   ├── agents/
│   ├── workflows/
│   ├── strategies/
│   ├── tools/
│   └── ui/
│       └── assets/
├── data/
│   ├── experiments/
│   ├── metrics/
│   ├── leaderboard/
│   └── checkpoints/
└── config/
```

**Verification:**
```powershell
Get-ChildItem -Recurse "C:\Meastro\data\workspaces\model-research" -Directory | Select-Object FullName
```

---

## Phase 3: Create Configuration Files

### Step 3.1: Create models.json

**Command:**
```powershell
$modelsJson = @'
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
      "modelId": "gpt-4o-mini",
      "displayName": "GPT-4o Mini",
      "parameterCount": 8000000000,
      "flopsPerToken": 16000000000,
      "vramRequirementMB": 0,
      "ramRequirementMB": 0,
      "requiresGPU": false,
      "costPer1kTokens": 0.00015,
      "provider": "openai"
    }
  ]
}
'@
$modelsJson | Out-File -FilePath "C:\Meastro\data\workspaces\model-research\config\models.json" -Encoding UTF8
```

**Verification:**
```powershell
Get-Content "C:\Meastro\data\workspaces\model-research\config\models.json" | ConvertFrom-Json | Select-Object -ExpandProperty profiles | Format-Table modelId, displayName
```

---

### Step 3.2: Create fitness-config.json

**Command:**
```powershell
$fitnessConfig = @'
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
'@
$fitnessConfig | Out-File -FilePath "C:\Meastro\data\workspaces\model-research\config\fitness-config.json" -Encoding UTF8
```

---

## Phase 4: Create Tool Blocks

### Step 4.1: Create fitness-calculator Block

**Command:**
```bash
curl -X POST http://localhost:5000/api/blocks \
  -H "Content-Type: application/json" \
  -d '{
    "id": "fitness-calculator",
    "name": "Fitness Calculator",
    "blockType": "tool",
    "version": "1.0.0",
    "description": "Calculates model fitness score using the Maestro formula",
    "isAtomic": true,
    "isSystem": false,
    "workspaceId": "model-research",
    "config": {
      "toolType": "script",
      "runtime": "javascript"
    },
    "inputs": {
      "executionMetrics": {
        "type": "object",
        "required": true
      },
      "modelId": {
        "type": "string",
        "required": true
      },
      "taskType": {
        "type": "string",
        "default": "general"
      }
    },
    "outputs": {
      "totalFitness": { "type": "number" },
      "breakdown": { "type": "object" },
      "interpretation": { "type": "string" }
    },
    "metadata": {
      "category": "metrics",
      "tags": ["fitness", "evaluation", "metrics"]
    }
  }'
```

**Expected Result:**
```json
{
  "id": "fitness-calculator",
  "name": "Fitness Calculator",
  "blockType": "tool",
  "workspaceId": "model-research",
  "createdAt": "..."
}
```

**Frontend Verification:**
- Navigate to http://localhost:5173/workspaces/model-research
- Click on "Blocks" tab
- Should see "Fitness Calculator" block listed as tool type

---

### Step 4.2: Create data-store Block

**Command:**
```bash
curl -X POST http://localhost:5000/api/blocks \
  -H "Content-Type: application/json" \
  -d '{
    "id": "data-store",
    "name": "Data Store",
    "blockType": "tool",
    "version": "1.0.0",
    "description": "Reads and writes JSON data files in the workspace data folder",
    "isAtomic": true,
    "isSystem": false,
    "workspaceId": "model-research",
    "config": {
      "toolType": "script",
      "runtime": "javascript",
      "basePath": "data/"
    },
    "inputs": {
      "action": {
        "type": "string",
        "enum": ["read", "write", "list", "delete", "append"]
      },
      "collection": {
        "type": "string",
        "required": true
      },
      "id": { "type": "string" },
      "data": { "type": "object" },
      "filter": { "type": "object" }
    },
    "outputs": {
      "success": { "type": "boolean" },
      "data": { "type": "any" },
      "error": { "type": "string" }
    },
    "metadata": {
      "category": "storage",
      "tags": ["data", "json", "persistence"]
    }
  }'
```

---

### Step 4.3: Create metrics-collector Block

**Command:**
```bash
curl -X POST http://localhost:5000/api/blocks \
  -H "Content-Type: application/json" \
  -d '{
    "id": "metrics-collector",
    "name": "Metrics Collector",
    "blockType": "tool",
    "version": "1.0.0",
    "description": "Collects and aggregates metrics over time",
    "isAtomic": true,
    "isSystem": false,
    "workspaceId": "model-research",
    "config": {
      "toolType": "script",
      "runtime": "javascript"
    },
    "inputs": {
      "action": {
        "type": "string",
        "enum": ["record", "aggregate", "history", "compare"]
      },
      "experimentId": { "type": "string", "required": true },
      "iteration": { "type": "integer" },
      "metrics": { "type": "object" }
    },
    "outputs": {
      "success": { "type": "boolean" },
      "aggregated": { "type": "object" },
      "history": { "type": "array" }
    },
    "metadata": {
      "category": "metrics",
      "tags": ["metrics", "aggregation", "history"]
    }
  }'
```

---

### Step 4.4: Create leaderboard-manager Block

**Command:**
```bash
curl -X POST http://localhost:5000/api/blocks \
  -H "Content-Type: application/json" \
  -d '{
    "id": "leaderboard-manager",
    "name": "Leaderboard Manager",
    "blockType": "tool",
    "version": "1.0.0",
    "description": "Manages the fitness leaderboard rankings",
    "isAtomic": true,
    "isSystem": false,
    "workspaceId": "model-research",
    "config": {
      "toolType": "script",
      "runtime": "javascript",
      "maxEntries": 50
    },
    "inputs": {
      "action": {
        "type": "string",
        "enum": ["update", "get", "getTop", "getByModel", "clear"]
      },
      "entry": { "type": "object" },
      "limit": { "type": "integer", "default": 10 },
      "taskType": { "type": "string" }
    },
    "outputs": {
      "success": { "type": "boolean" },
      "leaderboard": { "type": "array" }
    },
    "metadata": {
      "category": "metrics",
      "tags": ["leaderboard", "ranking", "comparison"]
    }
  }'
```

---

### Step 4.5: Create checkpoint-manager Block

**Command:**
```bash
curl -X POST http://localhost:5000/api/blocks \
  -H "Content-Type: application/json" \
  -d '{
    "id": "checkpoint-manager",
    "name": "Checkpoint Manager",
    "blockType": "tool",
    "version": "1.0.0",
    "description": "Manages training checkpoints for recovery and comparison",
    "isAtomic": true,
    "isSystem": false,
    "workspaceId": "model-research",
    "config": {
      "toolType": "script",
      "runtime": "javascript",
      "maxCheckpoints": 10
    },
    "inputs": {
      "action": {
        "type": "string",
        "enum": ["save", "load", "list", "delete", "getBest"]
      },
      "experimentId": { "type": "string", "required": true },
      "iteration": { "type": "integer" },
      "state": { "type": "object" },
      "metadata": { "type": "object" }
    },
    "outputs": {
      "success": { "type": "boolean" },
      "checkpointId": { "type": "string" },
      "state": { "type": "object" },
      "checkpoints": { "type": "array" }
    },
    "metadata": {
      "category": "training",
      "tags": ["checkpoint", "recovery", "state"]
    }
  }'
```

**Frontend Verification (After all tools):**
- Navigate to Blocks tab in workspace
- Should see 5 tool blocks: fitness-calculator, data-store, metrics-collector, leaderboard-manager, checkpoint-manager

---

## Phase 5: Create Agent Blocks

### Step 5.1: Create experiment-manager Agent

**Command:**
```bash
curl -X POST http://localhost:5000/api/blocks \
  -H "Content-Type: application/json" \
  -d '{
    "id": "experiment-manager",
    "name": "Experiment Manager",
    "blockType": "agent",
    "version": "1.0.0",
    "description": "Orchestrates training experiments using different strategies",
    "isAtomic": false,
    "isSystem": false,
    "workspaceId": "model-research",
    "config": {
      "model": "smollm2:1.7b",
      "maxTokens": 4096,
      "temperature": 0.3,
      "capabilities": ["experiment-lifecycle", "strategy-selection", "parallel-execution", "result-comparison"]
    },
    "systemPrompt": "You are the Experiment Manager for the Model Research workspace.\n\nYour role is to orchestrate training experiments using different strategies. You manage the full experiment lifecycle: creation, execution, monitoring, and comparison.\n\nCapabilities:\n1. Create experiments with specific strategies (SFT, RL-Fitness, Preference, etc.)\n2. Start, pause, resume, and stop experiments\n3. Monitor progress and fitness scores\n4. Compare experiments and update leaderboards\n5. Recommend strategies based on agent characteristics\n\nTools available: data-store, fitness-calculator, leaderboard-manager, metrics-collector, checkpoint-manager",
    "metadata": {
      "category": "orchestration",
      "tags": ["experiment", "manager", "orchestration"]
    }
  }'
```

---

### Step 5.2: Create researcher-agent Agent

**Command:**
```bash
curl -X POST http://localhost:5000/api/blocks \
  -H "Content-Type: application/json" \
  -d '{
    "id": "researcher-agent",
    "name": "Researcher Agent",
    "blockType": "agent",
    "version": "1.0.0",
    "description": "Analyzes agent performance and identifies improvement opportunities",
    "isAtomic": false,
    "isSystem": false,
    "workspaceId": "model-research",
    "config": {
      "model": "smollm2:1.7b",
      "maxTokens": 4096,
      "temperature": 0.5,
      "capabilities": ["performance-analysis", "opportunity-identification", "hypothesis-generation"]
    },
    "systemPrompt": "You are the Researcher Agent in the Model Research workspace.\n\nYour role is to analyze agent performance and identify opportunities for improvement.\n\nResponsibilities:\n1. Analyze current fitness scores and metrics\n2. Identify strengths and weaknesses\n3. Compare against top performers in leaderboard\n4. Generate hypotheses for improvement\n5. Recommend training strategies",
    "metadata": {
      "category": "research",
      "tags": ["research", "analysis", "planning"]
    }
  }'
```

---

### Step 5.3: Create trainer-agent Agent

**Command:**
```bash
curl -X POST http://localhost:5000/api/blocks \
  -H "Content-Type: application/json" \
  -d '{
    "id": "trainer-agent",
    "name": "Trainer Agent",
    "blockType": "agent",
    "version": "1.0.0",
    "description": "Executes training strategies and manages the training loop",
    "isAtomic": false,
    "isSystem": false,
    "workspaceId": "model-research",
    "config": {
      "model": "smollm2:1.7b",
      "maxTokens": 4096,
      "temperature": 0.3,
      "capabilities": ["strategy-execution", "progress-monitoring", "early-stopping"]
    },
    "systemPrompt": "You are the Trainer Agent in the Model Research workspace.\n\nYour role is to execute training strategies and manage the training loop.\n\nResponsibilities:\n1. Execute the assigned training strategy\n2. Monitor fitness progress each iteration\n3. Apply early stopping when appropriate\n4. Save checkpoints at key moments\n5. Report training metrics",
    "metadata": {
      "category": "training",
      "tags": ["training", "execution", "strategy"]
    }
  }'
```

---

### Step 5.4: Create tester-agent Agent

**Command:**
```bash
curl -X POST http://localhost:5000/api/blocks \
  -H "Content-Type: application/json" \
  -d '{
    "id": "tester-agent",
    "name": "Tester Agent",
    "blockType": "agent",
    "version": "1.0.0",
    "description": "Runs test suites and validates trained agent fitness",
    "isAtomic": false,
    "isSystem": false,
    "workspaceId": "model-research",
    "config": {
      "model": "smollm2:1.7b",
      "maxTokens": 4096,
      "temperature": 0.2,
      "capabilities": ["test-execution", "fitness-validation", "regression-detection"]
    },
    "systemPrompt": "You are the Tester Agent in the Model Research workspace.\n\nYour role is to validate trained agents through comprehensive testing.\n\nResponsibilities:\n1. Run test suites against trained agents\n2. Calculate final fitness scores\n3. Detect regressions compared to baseline\n4. Approve or reject agents for next stage",
    "metadata": {
      "category": "testing",
      "tags": ["testing", "validation", "quality"]
    }
  }'
```

---

### Step 5.5: Create documenter-agent Agent

**Command:**
```bash
curl -X POST http://localhost:5000/api/blocks \
  -H "Content-Type: application/json" \
  -d '{
    "id": "documenter-agent",
    "name": "Documenter Agent",
    "blockType": "agent",
    "version": "1.0.0",
    "description": "Generates documentation for trained agents",
    "isAtomic": false,
    "isSystem": false,
    "workspaceId": "model-research",
    "config": {
      "model": "smollm2:1.7b",
      "maxTokens": 4096,
      "temperature": 0.4,
      "capabilities": ["documentation-generation", "changelog-creation", "comparison-reporting"]
    },
    "systemPrompt": "You are the Documenter Agent in the Model Research workspace.\n\nYour role is to generate comprehensive documentation for trained agents.\n\nResponsibilities:\n1. Create summary of training improvements\n2. Generate changelog comparing to previous version\n3. Write performance report with metrics\n4. Create usage guide for the improved agent",
    "metadata": {
      "category": "documentation",
      "tags": ["documentation", "reporting", "changelog"]
    }
  }'
```

---

### Step 5.6: Create publisher-agent Agent

**Command:**
```bash
curl -X POST http://localhost:5000/api/blocks \
  -H "Content-Type: application/json" \
  -d '{
    "id": "publisher-agent",
    "name": "Publisher Agent",
    "blockType": "agent",
    "version": "1.0.0",
    "description": "Publishes approved agents to the catalog",
    "isAtomic": false,
    "isSystem": false,
    "workspaceId": "model-research",
    "config": {
      "model": "smollm2:1.7b",
      "maxTokens": 2048,
      "temperature": 0.2,
      "capabilities": ["version-management", "catalog-publishing", "notification"]
    },
    "systemPrompt": "You are the Publisher Agent in the Model Research workspace.\n\nYour role is to publish approved agents to the catalog.\n\nResponsibilities:\n1. Verify fitness meets publish threshold (0.75)\n2. Assign version number (semver)\n3. Create catalog entry\n4. Update leaderboard\n5. Archive documentation",
    "metadata": {
      "category": "publishing",
      "tags": ["publishing", "catalog", "versioning"]
    }
  }'
```

**Frontend Verification (After all agents):**
- Navigate to Blocks tab in workspace
- Should see 6 agent blocks listed
- Each should show "agent" type badge

---

## Phase 6: Create Workflow Blocks

### Step 6.1: Create research-team Workflow

**Command:**
```bash
curl -X POST http://localhost:5000/api/blocks \
  -H "Content-Type: application/json" \
  -d '{
    "id": "research-team",
    "name": "Research Team",
    "blockType": "workflow",
    "version": "1.0.0",
    "description": "Full research pipeline: analyze, train, test, document, publish",
    "isAtomic": false,
    "isSystem": false,
    "workspaceId": "model-research",
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
        "default": 100,
        "description": "Maximum training iterations"
      }
    },
    "children": [
      {"id": "step-1-research", "blockRef": "researcher-agent"},
      {"id": "step-2-train", "blockRef": "trainer-agent"},
      {"id": "step-3-test", "blockRef": "tester-agent"},
      {"id": "step-4-document", "blockRef": "documenter-agent"},
      {"id": "step-5-publish", "blockRef": "publisher-agent"}
    ],
    "outputs": {
      "success": { "type": "boolean" },
      "improvedAgentId": { "type": "string" },
      "fitnessImprovement": { "type": "number" },
      "publishedVersion": { "type": "string" }
    },
    "metadata": {
      "category": "research",
      "tags": ["research", "pipeline", "team"],
      "estimatedDuration": "30-120 minutes depending on iterations"
    }
  }'
```

---

### Step 6.2: Create training-loop Workflow

**Command:**
```bash
curl -X POST http://localhost:5000/api/blocks \
  -H "Content-Type: application/json" \
  -d '{
    "id": "training-loop",
    "name": "Training Loop",
    "blockType": "workflow",
    "version": "1.0.0",
    "description": "Core training iteration loop with fitness tracking",
    "isAtomic": false,
    "isSystem": false,
    "workspaceId": "model-research",
    "config": {
      "loopType": "for"
    },
    "inputs": {
      "targetAgentId": { "type": "string", "required": true },
      "strategyBlockId": { "type": "string", "required": true },
      "maxIterations": { "type": "integer", "default": 100 },
      "targetFitness": { "type": "number", "default": 0.8 }
    },
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
  }'
```

---

### Step 6.3: Create experiment-pipeline Workflow

**Command:**
```bash
curl -X POST http://localhost:5000/api/blocks \
  -H "Content-Type: application/json" \
  -d '{
    "id": "experiment-pipeline",
    "name": "Experiment Pipeline",
    "blockType": "workflow",
    "version": "1.0.0",
    "description": "Single experiment execution from start to finish",
    "isAtomic": false,
    "isSystem": false,
    "workspaceId": "model-research",
    "inputs": {
      "experimentId": { "type": "string", "required": true }
    },
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
  }'
```

**Frontend Verification:**
- Navigate to Blocks tab
- Should see 3 workflow blocks with appropriate badges

---

## Phase 7: Create Strategy Blocks

### Step 7.1: Create rl-fitness-strategy

**Command:**
```bash
curl -X POST http://localhost:5000/api/blocks \
  -H "Content-Type: application/json" \
  -d '{
    "id": "rl-fitness-strategy",
    "name": "RL-Fitness Strategy",
    "blockType": "workflow",
    "version": "1.0.0",
    "description": "Reinforcement learning strategy using fitness as reward",
    "isAtomic": false,
    "isSystem": false,
    "workspaceId": "model-research",
    "config": {
      "algorithm": "PPO",
      "explorationRate": 0.1,
      "explorationDecay": 0.995,
      "rewardShaping": {
        "fitnessImprovement": 1.0,
        "costPenalty": -0.1,
        "formatCompliance": 0.2
      }
    },
    "metadata": {
      "method": "ReinforcementLearning",
      "category": "reinforcement",
      "suitableFor": ["reasoning", "code", "agentic"],
      "estimatedResources": {
        "minIterations": 50,
        "typicalIterations": 500,
        "maxIterations": 2000
      }
    }
  }'
```

---

### Step 7.2: Create sft-strategy

**Command:**
```bash
curl -X POST http://localhost:5000/api/blocks \
  -H "Content-Type: application/json" \
  -d '{
    "id": "sft-strategy",
    "name": "Supervised Fine-Tuning Strategy",
    "blockType": "workflow",
    "version": "1.0.0",
    "description": "Supervised learning from examples with fitness validation",
    "isAtomic": false,
    "isSystem": false,
    "workspaceId": "model-research",
    "config": {
      "learningRate": 0.001,
      "batchSize": 4,
      "validationSplit": 0.2
    },
    "metadata": {
      "method": "SupervisedFineTuning",
      "category": "supervised",
      "suitableFor": ["instruction-following", "formatting", "simple-tasks"],
      "estimatedResources": {
        "minIterations": 10,
        "typicalIterations": 100,
        "maxIterations": 500
      }
    }
  }'
```

---

## Phase 8: Initialize Data Files

### Step 8.1: Create Empty Leaderboard

**Command:**
```powershell
$leaderboard = @'
{
  "lastUpdated": "2026-02-04T00:00:00Z",
  "rankings": [],
  "byTaskType": {
    "code": [],
    "reasoning": [],
    "creative": []
  }
}
'@
$leaderboard | Out-File -FilePath "C:\Meastro\data\workspaces\model-research\data\leaderboard\leaderboard.json" -Encoding UTF8
```

---

### Step 8.2: Create Empty Metrics History

**Command:**
```powershell
$metrics = @'
{
  "experiments": {}
}
'@
$metrics | Out-File -FilePath "C:\Meastro\data\workspaces\model-research\data\metrics\metrics-history.json" -Encoding UTF8
```

---

## Phase 9: Final Verification

### Step 9.1: Verify Workspace via API

**Command:**
```bash
curl http://localhost:5000/api/workspaces/model-research
```

**Expected Result:**
```json
{
  "id": "model-research",
  "name": "Model Research",
  "type": "Research",
  "status": "Active",
  "sessionIds": [],
  "projectIds": [],
  "entryPoints": {
    "main": "research-team",
    "dashboard": "research-dashboard",
    "experiments": "experiment-manager"
  }
}
```

---

### Step 9.2: Verify Blocks via API

**Command:**
```bash
curl "http://localhost:5000/api/blocks?workspaceId=model-research"
```

**Expected Result:**
Should list all 16 blocks:
- 5 tools (fitness-calculator, data-store, metrics-collector, leaderboard-manager, checkpoint-manager)
- 6 agents (experiment-manager, researcher-agent, trainer-agent, tester-agent, documenter-agent, publisher-agent)
- 3 workflows (research-team, training-loop, experiment-pipeline)
- 2 strategies (rl-fitness-strategy, sft-strategy)

---

### Step 9.3: Frontend Complete Verification

**Steps:**
1. Navigate to http://localhost:5173/workspaces
2. Verify "Model Research" workspace appears
3. Click on workspace card
4. Verify Overview tab shows:
   - Status: Active
   - Type: Research
   - Entry points: main, dashboard, experiments
5. Click on Blocks tab
6. Verify all 16 blocks are listed with correct types
7. Verify tools show as "tool" type
8. Verify agents show as "agent" type
9. Verify workflows show as "workflow" type

---

## Summary

| Phase | Items Created | Count |
|-------|---------------|-------|
| 1. Workspace | Workspace entity + permissions | 1 |
| 2. Folders | Directory structure | 12 folders |
| 3. Config | models.json, fitness-config.json | 2 files |
| 4. Tools | Tool blocks | 5 blocks |
| 5. Agents | Agent blocks | 6 blocks |
| 6. Workflows | Workflow blocks | 3 blocks |
| 7. Strategies | Strategy blocks | 2 blocks |
| 8. Data | Initial data files | 2 files |
| **Total** | | **16 blocks, 4 config files** |

---

## Rollback Commands

If needed, to delete the workspace and start over:

```bash
# Delete workspace
curl -X DELETE http://localhost:5000/api/workspaces/model-research

# Remove folder structure
powershell -Command "Remove-Item -Recurse -Force 'C:\Meastro\data\workspaces\model-research'"
```

---

## Execution Report (February 4, 2026)

### Actual Workspace ID
The workspace was created with ID: `1e6a7ad8-b09d-40b8-a34c-01fc5c7bf7e6`

### Execution Summary

| Phase | Status | Notes |
|-------|--------|-------|
| Pre-requisites | ✅ Complete | Backend started on port 5000, Frontend on 5173 |
| Phase 1: Create Workspace | ✅ Complete | Created with full permissions |
| Phase 2: Folder Structure | ✅ Complete | All directories created |
| Phase 3: Configuration | ✅ Complete | models.json, fitness-config.json |
| Phase 4: Tool Blocks | ✅ Complete | 5 tools created |
| Phase 5: Agent Blocks | ✅ Complete | 6 agents created (note: publisher-agent included) |
| Phase 6: Workflow Blocks | ✅ Complete | 3 workflows created |
| Phase 7: Strategy Blocks | ✅ Complete | 2 strategies created |
| Phase 8: Data Files | ✅ Complete | leaderboard.json, metrics-history.json |
| Phase 9: Verification | ✅ Complete | API and frontend verified |

### Blocks Created

**Tools (5):**
- fitness-calculator
- data-store
- metrics-collector
- leaderboard-manager
- checkpoint-manager

**Agents (6):**
- experiment-manager
- researcher-agent
- trainer-agent
- tester-agent
- documenter-agent
- publisher-agent

**Workflows (5):**
- research-team
- training-loop
- experiment-pipeline
- rl-fitness-strategy
- sft-strategy

### Scripts Created
The following helper scripts were created during execution:
- `scripts/create-research-blocks.ps1` - Creates all blocks for the workspace
- `scripts/verify-blocks.ps1` - Verifies blocks were created correctly
- `scripts/check-backend.ps1` - Checks backend health

### Frontend Access
- Workspaces list: http://localhost:5173/workspaces
- Model Research workspace: http://localhost:5173/workspaces/1e6a7ad8-b09d-40b8-a34c-01fc5c7bf7e6

### Re-execution Notes
To recreate this workspace from scratch:
1. Run rollback commands first (if workspace exists)
2. Start services: `powershell -File C:\Meastro\scripts\dev-start.ps1`
3. Wait for backend (port 5000) and frontend (port 5173)
4. Run: `powershell -ExecutionPolicy Bypass -File C:\Meastro\scripts\create-research-blocks.ps1`

---

*"The workspace is the experiment lab. Everything it needs is inside it."*
