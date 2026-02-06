# Workspace UI Visualization Guide

**Document**: Analysis of Workspace Implementation and UI Pages
**Date**: February 4, 2026
**Related Documents**:
- `docs/test-plans/RESEARCH-WORKSPACE-SETUP-PLAN.md`
- `docs/workspaces/WORKSPACE-SETUP-MODEL-RESEARCH.md`

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Implementation Status](#2-implementation-status)
3. [UI Pages Visualization](#3-ui-pages-visualization)
4. [Component Architecture](#4-component-architecture)
5. [Research Workspace Example](#5-research-workspace-example)
6. [Static Workspace Views (Proposed)](#6-static-workspace-views-proposed)

---

## 1. Architecture Overview

### Container Hierarchy

The workspace and session system is built on a unified container-based architecture with permission inheritance:

```
ContainerSession (abstract base)
├── Workspace (root container)
│   ├── Permissions (root of inheritance chain)
│   ├── SessionTemplates (preset configurations)
│   ├── EntryPoints (named block references)
│   └── Isolation (optional Docker config)
│
└── Session (abstract, extends ContainerSession)
    ├── ProjectSession (interactive project environment)
    │   ├── Repository binding
    │   ├── Agent execution tracking
    │   ├── File change tracking
    │   └── Test/Linter results
    │
    └── FoundrySession (block improvement sandbox)
        ├── Iteration tracking
        ├── Training metrics
        ├── Improvement suggestions
        └── Draft management
```

### Key Concepts

| Concept | Description |
|---------|-------------|
| **Workspace** | Top-level container for blocks, sessions, and projects |
| **Session** | Execution context within a workspace |
| **EntryPoint** | Named reference to a block for quick access |
| **SessionTemplate** | Preset permission configuration for session creation |
| **Isolation** | Optional Docker-based resource isolation |
| **Topology** | Graph of relationships between workspaces |

---

## 2. Implementation Status

### Fully Implemented

| Feature | Frontend | Backend | Notes |
|---------|----------|---------|-------|
| Workspace CRUD | ✅ | ✅ | Create, read, update, delete |
| Session/Project association | ✅ | ✅ | Add/remove sessions and projects |
| Lifecycle management | ✅ | ✅ | Pause, resume, archive |
| Settings configuration | ✅ | ✅ | Model, limits, auto-promotion |
| Isolation configuration | ✅ | ✅ | Docker network, resources |
| Session templates | ✅ | ✅ | Preset permission configs |
| Entry points | ✅ | ✅ | Quick action buttons |
| Workspace topology | ✅ | ✅ | Cross-workspace relationships |
| Real-time canvas | ✅ | ✅ | Live visualization |
| Session monitoring | ✅ | ✅ | Progress, logs, controls |
| Permission inheritance | ✅ | ✅ | Context-based restrictions |

### Partially Implemented

| Feature | Status | Notes |
|---------|--------|-------|
| Agent promotion | 🔄 | Infrastructure ready, some handlers TODO |
| Session control actions | 🔄 | Pause/resume/stop handlers marked TODO |
| Timeline view | 🔄 | View mode available, implementation pending |

---

## 3. UI Pages Visualization

### 3.1 Workspaces List Page

**Route**: `/workspaces`
**Component**: `WorkspacesPage`

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Maestro > Workspaces                                       [+ New Workspace]│
├─────────────────────────────────────────────────────────────────────────────┤
│  Filter: [All v]  [Active *] [Paused o] [Archived o]    Search: [________] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Model Research                                        [Research]   │   │
│  │ ─────────────────────────────────────────────────────────────────── │   │
│  │ Autonomous training workspace for researching and optimizing        │   │
│  │ LLM model fitness                                                   │   │
│  │                                                                     │   │
│  │ Status: * Active     Sessions: 0     Projects: 0     Blocks: 16    │   │
│  │                                                                     │   │
│  │ Created: Feb 4, 2026                                               │   │
│  │                                                                     │   │
│  │                         [Open]  [Pause]  [Archive]  [Delete]        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Staging Environment                                   [Staging]    │   │
│  │ ─────────────────────────────────────────────────────────────────── │   │
│  │ Pre-production testing environment for validated agents             │   │
│  │                                                                     │   │
│  │ Status: o Paused     Sessions: 2     Projects: 1     Blocks: 8     │   │
│  │                                                                     │   │
│  │                         [Open]  [Resume]  [Archive]  [Delete]       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Features**:
- Status filter chips (Active, Paused, Archived)
- Search by name/description
- Workspace cards with summary info
- Inline lifecycle actions
- Session/project/block counts

---

### 3.2 Workspace Detail - Overview Tab

**Route**: `/workspaces/{id}`
**Component**: `WorkspaceDetailPage`

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Model Research                                       Status: * Active      │
│  Research Workspace                                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  [Overview *]  [Canvas]  [Blocks]  [Sessions]  [Logs]                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─ Quick Actions ─────────────────────────────────────────────────────┐   │
│  │  [> Research Team]  [Dashboard]  [Experiments]                      │   │
│  │  (main)              (dashboard)   (experiments)                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─ Workspace Content ─────────────────┐  ┌─ Workspace Health ──────────┐  │
│  │                                     │  │                             │  │
│  │  Blocks             16 total        │  │  Sessions Active    0       │  │
│  │     * Tools          5              │  │  Block Executions   0       │  │
│  │     * Agents         6              │  │  Error Rate         0%      │  │
│  │     * Workflows      5              │  │  Avg Latency        --      │  │
│  │                                     │  │                             │  │
│  │  Sessions            0              │  │  ┌─────────────────────┐    │  │
│  │  Projects            0              │  │  │ ========            │    │  │
│  │                                     │  │  │ Fitness: N/A       │    │  │
│  │  Default Model: smollm2:1.7b        │  │  └─────────────────────┘    │  │
│  │  Max Sessions: 3                    │  │                             │  │
│  └─────────────────────────────────────┘  └─────────────────────────────┘  │
│                                                                             │
│  ┌─ Recent Activity ───────────────────────────────────────────────────┐   │
│  │  Feb 4, 14:32  Workspace created                                    │   │
│  │  Feb 4, 14:33  16 blocks imported                                   │   │
│  │  Feb 4, 14:33  Entry points configured                              │   │
│  │  Feb 4, 14:35  Session template "Training" added                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Components**:
- `QuickActions` - Entry point buttons
- `WorkspaceContent` - Block/session/project summary
- `WorkspaceHealth` - Real-time metrics
- `RecentActivity` - Activity timeline

---

### 3.3 Workspace Detail - Blocks Tab

**Route**: `/workspaces/{id}#blocks`
**Component**: `BlocksPanel`

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [Overview]  [Canvas]  [Blocks *]  [Sessions]  [Logs]                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  Filter: [All Types v]  Category: [All v]           Search: [__________]   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  -- Tools (5) ----------------------------------------------------------   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  fitness-calculator      │ Calculates model fitness score     [tool]│   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │  data-store              │ Reads/writes JSON data files       [tool]│   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │  metrics-collector       │ Collects and aggregates metrics    [tool]│   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │  leaderboard-manager     │ Manages fitness leaderboard        [tool]│   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │  checkpoint-manager      │ Manages training checkpoints       [tool]│   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  -- Agents (6) ---------------------------------------------------------   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  experiment-manager      │ Orchestrates training experiments [agent]│   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │  researcher-agent        │ Analyzes performance              [agent]│   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │  trainer-agent           │ Executes training strategies      [agent]│   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │  tester-agent            │ Runs test suites                  [agent]│   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │  documenter-agent        │ Generates documentation           [agent]│   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │  publisher-agent         │ Publishes to catalog              [agent]│   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  -- Workflows (5) ------------------------------------------------------   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  research-team           │ Full research pipeline          [workflow]│   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │  training-loop           │ Core training iteration loop    [workflow]│   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │  experiment-pipeline     │ Single experiment execution     [workflow]│   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │  rl-fitness-strategy     │ RL using fitness as reward      [workflow]│   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │  sft-strategy            │ Supervised fine-tuning          [workflow]│   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Features**:
- Filter by block type (tool, agent, workflow, etc.)
- Filter by category/tags
- Search by name/description
- Grouped display by type
- Type badge indicators

---

### 3.4 Workspace Detail - Canvas Tab (WorkspaceLiveView)

**Route**: `/workspaces/{id}#canvas`
**Component**: `WorkspaceLiveView`

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [Overview]  [Canvas *]  [Blocks]  [Sessions]  [Logs]                      │
│  View: [Live *] [Design] [Topology] [Timeline]                [Zoom: 100%] │
├───────────────┬─────────────────────────────────────┬───────────────────────┤
│ HIERARCHY     │         WORKSPACE CANVAS            │     INSPECTOR         │
│               │                                     │                       │
│ v Model       │    ┌─────────────────────────┐     │  No selection         │
│   Research    │    │    research-team        │     │                       │
│               │    │    ==================   │     │  Select a session     │
│   o No active │    │    [workflow]           │     │  or block to view     │
│     sessions  │    │                         │     │  details              │
│               │    │  ┌─────┐ ┌─────┐ ┌─────┐│     │                       │
│   > Blocks    │    │  │res. │>│train│>│test ││     │                       │
│     (16)      │    │  │agent│ │agent│ │agent││     │                       │
│               │    │  └─────┘ └─────┘ └─────┘│     │                       │
│   > Entry     │    │           |              │     │                       │
│     Points    │    │           v              │     │                       │
│     (3)       │    │  ┌─────┐ ┌─────┐        │     │                       │
│               │    │  │doc. │>│pub. │        │     │                       │
│               │    │  │agent│ │agent│        │     │                       │
│               │    │  └─────┘ └─────┘        │     │                       │
│               │    └─────────────────────────┘     │                       │
│               │                                     │                       │
│               │    ┌──────────────┐                │                       │
│               │    │ experiment-  │                │                       │
│               │    │ manager      │                │                       │
│               │    │ [agent]      │                │                       │
│               │    └──────────────┘                │                       │
│               │                                     │                       │
│               │         [MiniMap]                  │                       │
├───────────────┴─────────────────────────────────────┴───────────────────────┤
│  CONSOLE                                                        [Clear]     │
│  ─────────────────────────────────────────────────────────────────────────  │
│  [INFO]  14:32:15  Workspace loaded successfully                            │
│  [INFO]  14:32:15  16 blocks available                                      │
│  [INFO]  14:32:16  No active sessions                                       │
│  > _                                                                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Layout Panels**:

| Panel | Component | Purpose |
|-------|-----------|---------|
| Left | `HierarchyPanel` | Tree view of sessions and blocks |
| Center | `WorkspaceCanvas` | React Flow visualization |
| Right | `InspectorPanel` | Selected item details |
| Bottom | `ConsolePanel` | Real-time logs |

**View Modes**:

| Mode | Description |
|------|-------------|
| Live | Real-time session monitoring |
| Design | Edit block structure |
| Topology | View workspace connections |
| Timeline | Execution history |

---

### 3.5 Workspace Detail - Sessions Tab

**Route**: `/workspaces/{id}#sessions`

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [Overview]  [Canvas]  [Blocks]  [Sessions *]  [Logs]      [+ New Session]  │
├─────────────────────────────────────────────────────────────────────────────┤
│  Filter: [All v]  Status: [Running *] [Paused o] [Completed o]             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Training Session #1                                 * Running      │   │
│  │ ─────────────────────────────────────────────────────────────────── │   │
│  │ Type: FoundrySession    Strategy: rl-fitness-strategy               │   │
│  │                                                                     │   │
│  │ Progress: ================------------  48/100 iterations           │   │
│  │                                                                     │   │
│  │ Current Block: trainer-agent                                        │   │
│  │ Fitness:       0.62 (+0.15 from baseline)                          │   │
│  │ Duration:      12m 34s                                              │   │
│  │                                                                     │   │
│  │ Recent Logs:                                                        │   │
│  │   14:45:12 [trainer] Iteration 48 complete, fitness: 0.62          │   │
│  │   14:45:10 [trainer] Running test suite...                         │   │
│  │   14:45:08 [trainer] Applied prompt modification #23               │   │
│  │                                                                     │   │
│  │                                  [Pause]  [Stop]  [Details]         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Training Session #0                                 * Completed    │   │
│  │ ─────────────────────────────────────────────────────────────────── │   │
│  │ Type: FoundrySession    Strategy: sft-strategy                      │   │
│  │ Final Fitness: 0.47    Duration: 8m 12s    Iterations: 50          │   │
│  │                                              [Details]  [Delete]    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Training Session #-1                                x Failed       │   │
│  │ ─────────────────────────────────────────────────────────────────── │   │
│  │ Type: FoundrySession    Strategy: rl-fitness-strategy               │   │
│  │ Error: Model timeout after 30s                                      │   │
│  │ Duration: 2m 15s    Iterations: 12                                  │   │
│  │                                      [Retry]  [Details]  [Delete]   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Session Card Information**:
- Session type (ProjectSession / FoundrySession)
- Current status with color indicator
- Progress bar with iteration count
- Current executing block
- Fitness score with delta from baseline
- Duration
- Recent log entries
- Control buttons (Pause, Stop, Details)

---

### 3.6 Canvas Topology View

**Route**: `/workspaces/{id}#canvas` (Topology mode)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  View: [Live] [Design] [Topology *] [Timeline]                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                    ┌─────────────────┐                                      │
│                    │  Training       │                                      │
│                    │  [Training]     │                                      │
│                    │  o Offline      │                                      │
│                    └────────┬────────┘                                      │
│                             │ read                                          │
│                             v                                               │
│         ┌─────────────────────────────────────────┐                        │
│         │              Model Research             │                        │
│         │              [Research]                 │                        │
│         │              * Active                   │                        │
│         │              Sessions: 1                │                        │
│         └──────────┬─────────────────┬────────────┘                        │
│                    │                 │                                      │
│                    │ promotion       │ write                               │
│                    v                 v                                      │
│         ┌─────────────────┐  ┌─────────────────┐                           │
│         │  Staging        │  │  Analytics      │                           │
│         │  [Staging]      │  │  [Custom]       │                           │
│         │  o Offline      │  │  o Offline      │                           │
│         └────────┬────────┘  └─────────────────┘                           │
│                  │                                                          │
│                  │ promotion                                                │
│                  v                                                          │
│         ┌─────────────────┐                                                 │
│         │  Production     │                                                 │
│         │  [Production]   │                                                 │
│         │  o Offline      │                                                 │
│         └─────────────────┘                                                 │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Legend:  ---> promotion    ....> read    ===> write                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Edge Types**:

| Type | Visual | Description |
|------|--------|-------------|
| Promotion | Solid arrow | Agent promotion pathway |
| Read | Dotted arrow | Cross-workspace data reading |
| Write | Double line | Cross-workspace data writing |
| Message | Dashed arrow | Message passing |

**Node Information**:
- Workspace name and type badge
- Status indicator (Active/Paused/Offline)
- Session count (if online)

---

### 3.7 Inspector Panel

**Component**: `InspectorPanel`

```
┌─────────────────────────────────────┐
│  INSPECTOR                          │
│  ===================================│
│                                     │
│  research-team                      │
│  -----------------------------------│
│  Type:     workflow                 │
│  Version:  1.0.0                    │
│  Atomic:   No (composite)           │
│                                     │
│  Description:                       │
│  Full research pipeline: analyze,   │
│  train, test, document, publish     │
│                                     │
│  --- Inputs ---                     │
│  * targetAgentId (string) required  │
│  * taskType (string) required       │
│  * maxIterations (int) default: 100 │
│                                     │
│  --- Children (5) ---               │
│  1. researcher-agent                │
│  2. trainer-agent                   │
│  3. tester-agent                    │
│  4. documenter-agent                │
│  5. publisher-agent                 │
│                                     │
│  --- Outputs ---                    │
│  * success (boolean)                │
│  * improvedAgentId (string)         │
│  * fitnessImprovement (number)      │
│  * publishedVersion (string)        │
│                                     │
│  --- Metadata ---                   │
│  Category: research                 │
│  Tags: research, pipeline, team     │
│  Est. Duration: 30-120 minutes      │
│                                     │
│  [> Execute]  [Edit]  [Copy]        │
└─────────────────────────────────────┘
```

**Sections**:
1. **Header** - Block name, type, version, atomic status
2. **Description** - Block purpose
3. **Inputs** - Required and optional parameters
4. **Children** - Child blocks (for composite blocks)
5. **Outputs** - Return values
6. **Metadata** - Category, tags, custom fields
7. **Actions** - Execute, Edit, Copy buttons

---

## 4. Component Architecture

### Frontend Component Tree

```
src/
├── pages/
│   ├── WorkspacesPage.tsx           # List all workspaces
│   └── WorkspaceDetailPage.tsx      # Workspace detail with tabs
│
├── components/workspace/
│   ├── WorkspaceLiveView/
│   │   └── WorkspaceLiveView.tsx    # Main canvas layout
│   │
│   ├── WorkspaceCanvas/
│   │   └── WorkspaceCanvas.tsx      # React Flow visualization
│   │
│   ├── HierarchyPanel.tsx           # Left tree panel
│   ├── InspectorPanel.tsx           # Right details panel
│   ├── ConsolePanel.tsx             # Bottom logs panel
│   ├── BlocksPanel.tsx              # Blocks tab content
│   ├── LogsPanel.tsx                # Logs tab content
│   ├── QuickActions.tsx             # Entry point buttons
│   ├── WorkspaceContent.tsx         # Content summary
│   ├── WorkspaceHealth.tsx          # Health metrics
│   └── RecentActivity.tsx           # Activity timeline
│
├── store/
│   ├── workspaceStore.ts            # Workspace state (Zustand)
│   └── sessionStore.ts              # Session state (Zustand)
│
├── services/
│   ├── workspaceService.ts          # Workspace API client
│   └── sessionService.ts            # Session API client
│
├── hooks/
│   ├── useWorkspaceRealtime.ts      # WebSocket connection
│   └── useWorkspaceLayout.ts        # Canvas auto-layout
│
└── types/
    ├── workspace.types.ts           # Workspace interfaces
    ├── session.types.ts             # Session interfaces
    └── workspace-canvas.types.ts    # Canvas node/edge types
```

### State Management (Zustand)

```typescript
// workspaceStore.ts
interface WorkspaceStore {
  // Data
  workspaces: Workspace[];
  selectedWorkspace: Workspace | null;
  topology: TopologyGraph | null;

  // Filters
  statusFilter: WorkspaceStatus | null;
  searchQuery: string;

  // Actions
  loadWorkspaces(): Promise<void>;
  loadWorkspace(id: string): Promise<void>;
  createWorkspace(data: CreateWorkspaceRequest): Promise<Workspace>;
  updateWorkspace(id: string, data: UpdateWorkspaceRequest): Promise<void>;
  deleteWorkspace(id: string): Promise<void>;

  // Lifecycle
  pauseWorkspace(id: string): Promise<void>;
  resumeWorkspace(id: string): Promise<void>;
  archiveWorkspace(id: string): Promise<void>;

  // Associations
  addSession(workspaceId: string, sessionId: string): Promise<void>;
  removeSession(workspaceId: string, sessionId: string): Promise<void>;

  // Computed
  filteredWorkspaces(): Workspace[];
  countByStatus(): Record<WorkspaceStatus, number>;
}
```

---

## 5. Research Workspace Example

### Configuration Summary

| Setting | Value |
|---------|-------|
| **Name** | Model Research |
| **Type** | Research |
| **Status** | Active |
| **Default Model** | smollm2:1.7b |
| **Max Concurrent Sessions** | 3 |
| **Auto Archive** | After 30 days |

### Blocks Inventory

| Category | Blocks | Count |
|----------|--------|-------|
| **Tools** | fitness-calculator, data-store, metrics-collector, leaderboard-manager, checkpoint-manager | 5 |
| **Agents** | experiment-manager, researcher-agent, trainer-agent, tester-agent, documenter-agent, publisher-agent | 6 |
| **Workflows** | research-team, training-loop, experiment-pipeline, rl-fitness-strategy, sft-strategy | 5 |
| **Total** | | **16** |

### Entry Points

| Name | Block Reference | Purpose |
|------|-----------------|---------|
| main | research-team | Full research pipeline |
| dashboard | research-dashboard | Monitoring dashboard |
| experiments | experiment-manager | Experiment management |

### Folder Structure

```
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
    ├── models.json
    └── fitness-config.json
```

---

## 6. Static Workspace Views (Proposed)

### 6.1 Problem Statement

**Current Gap**: When a workspace has no active sessions, the user experience is limited:

| Current View | Problem |
|--------------|---------|
| **Blocks Tab** | Flat list without context - doesn't show how blocks connect |
| **Canvas Tab** | Empty or minimal - designed for "live" session monitoring |
| **Overview Tab** | Statistics only - no visual representation of structure |

**User Need**: Users should be able to visualize and understand the workspace structure **before** launching a session. They need to see:
- How blocks are composed and connected
- What each entry point will execute
- The dependencies between blocks
- The "blueprint" of workflows

---

### 6.2 Proposed Solutions

#### Option A: Blueprint Mode in Canvas

**Priority**: HIGH
**Location**: New view mode in Canvas tab
**Purpose**: Show static block structure when no sessions are active

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  View: [Live] [Blueprint *] [Topology] [Timeline]                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ENTRY POINTS                        BLOCK STRUCTURE                       │
│   -------------                       ---------------                       │
│                                                                             │
│   [main]---------------->  ┌─────────────────────────────────────┐         │
│                            │         research-team               │         │
│                            │         [workflow]                  │         │
│                            │                                     │         │
│                            │  ┌──────────┐      ┌──────────┐    │         │
│                            │  │researcher│ --->  │ trainer  │    │         │
│                            │  │  agent   │      │  agent   │    │         │
│                            │  └──────────┘      └────┬─────┘    │         │
│                            │                         │          │         │
│                            │                         v          │         │
│                            │  ┌──────────┐      ┌──────────┐    │         │
│                            │  │  tester  │ <--  │  trainer │    │         │
│                            │  │  agent   │      │  output  │    │         │
│                            │  └────┬─────┘      └──────────┘    │         │
│                            │       │                            │         │
│                            │       v                            │         │
│                            │  ┌──────────┐      ┌──────────┐    │         │
│                            │  │  docum.  │ --->  │ publisher│    │         │
│                            │  │  agent   │      │  agent   │    │         │
│                            │  └──────────┘      └──────────┘    │         │
│                            └─────────────────────────────────────┘         │
│                                                                             │
│   [experiments]--------->  ┌──────────────┐                                │
│                            │ experiment-  │                                │
│                            │ manager      │                                │
│                            │ [agent]      │                                │
│                            └──────────────┘                                │
│                                                                             │
│   AVAILABLE TOOLS            AVAILABLE STRATEGIES                          │
│   ---------------            --------------------                          │
│   ┌────────────────┐         ┌────────────────┐                            │
│   │ fitness-calc   │         │ rl-fitness     │                            │
│   │ data-store     │         │ sft-strategy   │                            │
│   │ metrics-collect│         └────────────────┘                            │
│   │ leaderboard-mgr│                                                       │
│   │ checkpoint-mgr │                                                       │
│   └────────────────┘                                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Features**:
- Shows entry points and what they trigger
- Visualizes workflow composition with child blocks
- Lists available tools and strategies
- Interactive: click on blocks to see details in Inspector
- Can launch session directly from any entry point

**Implementation Notes**:
- Add "Blueprint" to ViewMode enum
- Create `BlueprintCanvas` component
- Parse workflow children to build graph
- Auto-layout using dagre or similar

---

#### Option B: Workflow Explorer Tab

**Priority**: MEDIUM
**Location**: New tab or sub-view in Blocks tab
**Purpose**: Detailed exploration of workflows before execution

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [Overview]  [Canvas]  [Blocks]  [Workflows *]  [Sessions]  [Logs]         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─ research-team ──────────────────────────────────────────────────────┐  │
│  │                                                                       │  │
│  │  Full research pipeline: analyze, train, test, document, publish     │  │
│  │                                                                       │  │
│  │  EXECUTION FLOW:                                                      │  │
│  │  ┌────────────┐   ┌────────────┐   ┌────────────┐                    │  │
│  │  │ 1. Research│-->│ 2. Train   │-->│ 3. Test    │                    │  │
│  │  │ researcher │   │ trainer    │   │ tester     │                    │  │
│  │  │ -agent     │   │ -agent     │   │ -agent     │                    │  │
│  │  └────────────┘   └────────────┘   └────────────┘                    │  │
│  │        │                                  │                           │  │
│  │        │              ┌────────────┐   ┌──┴───────────┐              │  │
│  │        │              │ 5. Publish │<──│ 4. Document  │              │  │
│  │        │              │ publisher  │   │ documenter   │              │  │
│  │        │              │ -agent     │   │ -agent       │              │  │
│  │        │              └────────────┘   └──────────────┘              │  │
│  │        │                                                              │  │
│  │  REQUIRED INPUTS:                      OUTPUTS:                       │  │
│  │  ┌─────────────────────────────┐      ┌─────────────────────────────┐│  │
│  │  │ * targetAgentId (string)   │      │ * success (boolean)         ││  │
│  │  │ * taskType (string)        │      │ * improvedAgentId (string)  ││  │
│  │  │ * maxIterations (int: 100) │      │ * fitnessImprovement (num)  ││  │
│  │  └─────────────────────────────┘      │ * publishedVersion (string)││  │
│  │                                        └─────────────────────────────┘│  │
│  │  TOOLS USED:                                                          │  │
│  │  fitness-calculator, data-store, metrics-collector, checkpoint-mgr   │  │
│  │                                                                       │  │
│  │  ESTIMATED RESOURCES:                                                 │  │
│  │  Duration: 30-120 min | Model: smollm2:1.7b | Sessions: 1            │  │
│  │                                                                       │  │
│  │                                      [> Start Session]  [Edit]  [Copy]│  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─ training-loop (collapsed) ──────────────────────────────────────────┐  │
│  │  Core training iteration loop with fitness tracking                  │  │
│  │  Children: 3 blocks | Tools: 4                    [Expand]  [Start]  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─ experiment-pipeline (collapsed) ────────────────────────────────────┐  │
│  │  Single experiment execution from start to finish                    │  │
│  │  Children: 2 blocks | Tools: 3                    [Expand]  [Start]  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Features**:
- Expandable/collapsible workflow cards
- Visual flow diagram for each workflow
- Complete I/O documentation
- Tool dependency list
- Resource estimates
- Direct "Start Session" action

**Implementation Notes**:
- Create `WorkflowExplorerPanel` component
- Filter blocks by type === 'workflow'
- Build flow visualization from children array
- Add expand/collapse state management

---

#### Option C: Enhanced Overview with Entry Point Previews

**Priority**: HIGH
**Location**: Overview tab enhancement
**Purpose**: Quick visual preview of workspace capabilities

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [Overview *]  [Canvas]  [Blocks]  [Sessions]  [Logs]                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─ Entry Points ───────────────────────────────────────────────────────┐  │
│  │                                                                       │  │
│  │  ┌─ main ────────────────────┐  ┌─ experiments ──────────────────┐   │  │
│  │  │                           │  │                                 │   │  │
│  │  │  research-team            │  │  experiment-manager             │   │  │
│  │  │  ┌───┐>┌───┐>┌───┐       │  │  ┌─────────────────┐            │   │  │
│  │  │  │ R │ │ T │ │ T │       │  │  │                 │            │   │  │
│  │  │  └───┘ └───┘ └─┬─┘       │  │  │  Orchestrates   │            │   │  │
│  │  │          ┌───┐<┴─┌───┐   │  │  │  experiments    │            │   │  │
│  │  │          │ P │<──│ D │   │  │  │                 │            │   │  │
│  │  │          └───┘   └───┘   │  │  └─────────────────┘            │   │  │
│  │  │                           │  │                                 │   │  │
│  │  │  5 agents | workflow      │  │  1 agent | interactive         │   │  │
│  │  │  [> Start]    [Preview]   │  │  [> Start]      [Preview]      │   │  │
│  │  └───────────────────────────┘  └─────────────────────────────────┘   │  │
│  │                                                                       │  │
│  │  ┌─ dashboard ───────────────┐                                       │  │
│  │  │                           │                                       │  │
│  │  │  research-dashboard       │                                       │  │
│  │  │  ┌─────────────────┐     │                                       │  │
│  │  │  │  [UI Panel]     │     │                                       │  │
│  │  │  │  Metrics view   │     │                                       │  │
│  │  │  └─────────────────┘     │                                       │  │
│  │  │                           │                                       │  │
│  │  │  UI block | read-only     │                                       │  │
│  │  │  [> Open]       [Preview] │                                       │  │
│  │  └───────────────────────────┘                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─ Block Composition ──────────────────────────────────────────────────┐  │
│  │                                                                       │  │
│  │    WORKFLOWS (5)              AGENTS (6)              TOOLS (5)      │  │
│  │    ┌─────────────┐           ┌─────────────┐         ┌───────────┐   │  │
│  │    │research-team│ --------> │researcher   │ ------> │fitness-   │   │  │
│  │    │training-loop│ --------> │trainer      │ ------> │calculator │   │  │
│  │    │experiment-  │ --------> │tester       │ ------> │data-store │   │  │
│  │    │  pipeline   │           │documenter   │         │metrics-   │   │  │
│  │    │rl-fitness   │           │publisher    │         │  collector│   │  │
│  │    │sft-strategy │           │experiment-  │         │leaderboard│   │  │
│  │    │             │           │  manager    │         │checkpoint │   │  │
│  │    └─────────────┘           └─────────────┘         └───────────┘   │  │
│  │                                                                       │  │
│  │    Workflows orchestrate agents, which use tools to perform actions  │  │
│  │                                                                       │  │
│  │    [View All Blocks]                [View Dependencies]              │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─ Workspace Content ─────────────────┐  ┌─ Workspace Health ──────────┐  │
│  │  ... (existing content)             │  │  ... (existing content)     │  │
│  └─────────────────────────────────────┘  └─────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Features**:
- Mini flow diagrams for each entry point
- Block type and count summary
- Visual composition diagram (workflows -> agents -> tools)
- Direct launch buttons
- Preview links to detailed views

**Implementation Notes**:
- Create `EntryPointCard` component with mini-graph
- Create `BlockCompositionDiagram` component
- Add to existing Overview layout
- Keep existing WorkspaceContent and WorkspaceHealth

---

#### Option D: Block Dependency Graph

**Priority**: LOW
**Location**: Canvas sub-view or separate panel
**Purpose**: Technical view of all block dependencies

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Canvas > Dependencies View                                    [Export SVG] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Filter: [All v]  Highlight: [None v]  Layout: [Hierarchical v]            │
│                                                                             │
│                        ┌─────────────────────────────┐                     │
│                        │      research-team          │                     │
│                        │      [workflow]             │                     │
│                        └──────────────┬──────────────┘                     │
│                 ┌──────────┬──────────┼──────────┬──────────┐              │
│                 v          v          v          v          v              │
│           ┌──────────┐┌──────────┐┌──────────┐┌──────────┐┌──────────┐     │
│           │researcher││ trainer  ││  tester  ││documenter││publisher │     │
│           │  -agent  ││  -agent  ││  -agent  ││  -agent  ││  -agent  │     │
│           │ [agent]  ││ [agent]  ││ [agent]  ││ [agent]  ││ [agent]  │     │
│           └────┬─────┘└────┬─────┘└────┬─────┘└────┬─────┘└────┬─────┘     │
│                │           │           │           │           │           │
│                └─────┬─────┴─────┬─────┴─────┬─────┘           │           │
│                      v           v           v                 v           │
│                ┌──────────┐┌──────────┐┌──────────┐      ┌──────────┐      │
│                │ fitness- ││  data-   ││ metrics- │      │leaderboard│     │
│                │calculator││  store   ││collector │      │ -manager │      │
│                │  [tool]  ││  [tool]  ││  [tool]  │      │  [tool]  │      │
│                └──────────┘└────┬─────┘└──────────┘      └──────────┘      │
│                                 │                                          │
│                                 v                                          │
│                           ┌──────────┐                                     │
│                           │checkpoint│                                     │
│                           │ -manager │                                     │
│                           │  [tool]  │                                     │
│                           └──────────┘                                     │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Legend:  ---> contains/uses    ....> optional dependency                  │
│                                                                             │
│  Statistics:                                                                │
│  Total blocks: 16 | Max depth: 3 | Leaf nodes: 5 | Root nodes: 3          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Features**:
- Full dependency graph of all blocks
- Filter by block type
- Highlight specific dependency chains
- Multiple layout options (hierarchical, force-directed, radial)
- Export to SVG/PNG
- Statistics summary

**Implementation Notes**:
- Analyze block configs for tool/block references
- Build adjacency list for dependencies
- Use React Flow with custom layout algorithms
- Add export functionality

---

### 6.3 Implementation Roadmap

#### Phase 1: Essential Static Views (High Priority)

| Task | Component | Effort |
|------|-----------|--------|
| Add Blueprint mode to Canvas | `BlueprintCanvas.tsx` | Medium |
| Enhance Overview with entry point cards | `EntryPointCard.tsx` | Medium |
| Add block composition diagram | `BlockCompositionDiagram.tsx` | Low |

**Outcome**: Users can visualize workspace structure without running sessions

#### Phase 2: Detailed Exploration (Medium Priority)

| Task | Component | Effort |
|------|-----------|--------|
| Create Workflow Explorer tab | `WorkflowExplorerPanel.tsx` | High |
| Add flow visualization to workflows | `WorkflowFlowDiagram.tsx` | Medium |
| Implement expand/collapse for workflow cards | State management | Low |

**Outcome**: Users can explore workflow details before execution

#### Phase 3: Advanced Analysis (Low Priority)

| Task | Component | Effort |
|------|-----------|--------|
| Create dependency graph view | `DependencyGraphView.tsx` | High |
| Add graph layout algorithms | `useGraphLayout.ts` | Medium |
| Implement export functionality | `exportGraph.ts` | Low |

**Outcome**: Power users can analyze block architecture

---

### 6.4 Component Summary

| Component | Location | Purpose |
|-----------|----------|---------|
| `BlueprintCanvas` | Canvas view mode | Static block structure visualization |
| `EntryPointCard` | Overview tab | Mini-preview of entry point workflows |
| `BlockCompositionDiagram` | Overview tab | Workflows -> Agents -> Tools diagram |
| `WorkflowExplorerPanel` | New Workflows tab | Detailed workflow exploration |
| `WorkflowFlowDiagram` | Workflow cards | Visual execution flow |
| `DependencyGraphView` | Canvas sub-view | Full dependency analysis |

---

### 6.5 User Journey with Static Views

```
User opens workspace (no active sessions)
         │
         v
┌─────────────────────────────────────────────────────────────┐
│  OVERVIEW TAB (Default)                                     │
│  - See entry point cards with mini-previews                 │
│  - Understand workspace capabilities at a glance            │
│  - Click [Start] to launch directly                         │
│  - Click [Preview] to see more details                      │
└─────────────────────────────────────────────────────────────┘
         │
         │ Want more detail?
         v
┌─────────────────────────────────────────────────────────────┐
│  CANVAS > BLUEPRINT MODE                                    │
│  - See full block structure                                 │
│  - Explore entry points visually                            │
│  - Click blocks to see Inspector details                    │
│  - Understand composition before running                    │
└─────────────────────────────────────────────────────────────┘
         │
         │ Want workflow specifics?
         v
┌─────────────────────────────────────────────────────────────┐
│  WORKFLOWS TAB                                              │
│  - Expand specific workflow                                 │
│  - See inputs/outputs/tools                                 │
│  - Review execution flow                                    │
│  - Configure and launch session                             │
└─────────────────────────────────────────────────────────────┘
         │
         │ Technical analysis needed?
         v
┌─────────────────────────────────────────────────────────────┐
│  CANVAS > DEPENDENCIES VIEW                                 │
│  - Analyze full dependency graph                            │
│  - Export for documentation                                 │
│  - Debug circular dependencies                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Appendix A: API Endpoints

### Workspace Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/workspaces` | List all workspaces |
| GET | `/api/workspaces/{id}` | Get workspace by ID |
| POST | `/api/workspaces` | Create workspace |
| PUT | `/api/workspaces/{id}` | Update workspace |
| DELETE | `/api/workspaces/{id}` | Delete workspace |
| POST | `/api/workspaces/{id}/sessions` | Add session |
| DELETE | `/api/workspaces/{id}/sessions/{sessionId}` | Remove session |
| PUT | `/api/workspaces/{id}/permissions` | Update permissions |
| PUT | `/api/workspaces/{id}/session-templates/{type}` | Set session template |
| PUT | `/api/workspaces/{id}/entry-points/{name}` | Set entry point |
| GET | `/api/workspaces/topology` | Get workspace topology |

### Session Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sessions` | List sessions (with filters) |
| GET | `/api/sessions/{id}` | Get session by ID |
| POST | `/api/sessions` | Create session |
| DELETE | `/api/sessions/{id}` | Delete session |
| POST | `/api/sessions/{id}/start` | Start session |
| POST | `/api/sessions/{id}/pause` | Pause session |
| POST | `/api/sessions/{id}/resume` | Resume session |
| POST | `/api/sessions/{id}/stop` | Stop session |

---

## Appendix B: URL Route Summary

| Page | Route | Component |
|------|-------|-----------|
| Workspaces List | `/workspaces` | `WorkspacesPage` |
| Workspace Detail | `/workspaces/{id}` | `WorkspaceDetailPage` |
| Canvas View | `/workspaces/{id}#canvas` | `WorkspaceLiveView` |
| Blocks View | `/workspaces/{id}#blocks` | `BlocksPanel` |
| Sessions View | `/workspaces/{id}#sessions` | Sessions list |
| Logs View | `/workspaces/{id}#logs` | `LogsPanel` |

---

*Document generated from workspace implementation analysis - February 4, 2026*
