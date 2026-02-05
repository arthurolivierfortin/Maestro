# ARCHIVED - Plan Training Strategies V2

> **This document has been archived and replaced.**

## Reason for Archival

The original plan violated Maestro Philosophy V2 principles:
- Created backend APIs for experiments (`ExperimentsController.cs`)
- Created CLI commands bypassing blocks (`maestro experiment`)
- Stored data in global database instead of workspace-local JSON files

## Replacement Documents

The following documents now define the correct architecture:

### 1. Workspace Setup (Internal Configuration)
**File**: `docs/workspaces/WORKSPACE-SETUP-MODEL-RESEARCH.md`

Contains:
- Complete workspace folder structure
- All block definitions (agents, workflows, tools, strategies, UI)
- Configuration files (models.json, fitness-config.json)
- Data schemas
- Usage commands

### 2. Implementation Plan (How to Build)
**File**: `docs/implementation/IMPLEMENTATION-PLAN-RESEARCH-WORKSPACE.md`

Contains:
- 8 implementation phases
- Backend infrastructure for workspaces
- Workspace-scoped block resolution
- Tool block implementations
- UI Block rendering

### 3. Architecture Analysis
**File**: `docs/analysis/RESEARCH-WORKSPACE-ARCHITECTURE-ANALYSIS.md`

Contains:
- Philosophy alignment analysis
- Block hierarchy diagrams
- Data flow diagrams
- What should NOT exist vs. what should exist

## Archived Original
**File**: `docs/archive/ARCHIVED-PLAN-TRAINING-STRATEGIES-V2.md`

---

*Archived on: February 3, 2026*
