# Design Document: Phase 8 - Generic Infrastructure & Sample Session
**Date**: February 5, 2026
**Status**: Draft for Review

---

## 1. Executive Summary

This document specifies:

**Part A: Generic Infrastructure** (applies to ALL sessions)
- Maestro Shell
- Monitor Shell Framework with Pluggable Widgets
- Session Variables System
- Entry Points Mechanism
- Block Approval System

**Part B: Sample Session** ("Generate Commit Tool Foundry")
- A specific session that uses the generic infrastructure
- Demonstrates how sessions define their own content

---

# PART A: GENERIC INFRASTRUCTURE

---

## 2. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              MAESTRO SYSTEM                                      │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                   GENERIC HUMAN INTERFACE LAYER                          │   │
│  │                                                                          │   │
│  │   ┌──────────────────┐    ┌──────────────────────────────────────────┐  │   │
│  │   │  Maestro Shell   │    │         Monitor Shell Framework          │  │   │
│  │   │  (Interactive)   │    │                                          │  │   │
│  │   │                  │    │  ┌────────────────────────────────────┐  │  │   │
│  │   │  maestro>        │    │  │ Generic Zones (same for all):     │  │  │   │
│  │   │                  │    │  │  • Header (session info, status)  │  │  │   │
│  │   │  Works with ANY  │    │  │  • Execution Tree (current blocks)│  │  │   │
│  │   │  session type    │    │  │  • Event Log                      │  │  │   │
│  │   │                  │    │  │  • Variables Display              │  │  │   │
│  │   │                  │    │  │  • Controls                       │  │  │   │
│  │   │                  │    │  └────────────────────────────────────┘  │  │   │
│  │   │                  │    │  ┌────────────────────────────────────┐  │  │   │
│  │   │                  │    │  │ Pluggable Widget Zone:            │  │  │   │
│  │   │                  │    │  │  (Session registers custom widgets)│  │  │   │
│  │   │                  │    │  └────────────────────────────────────┘  │  │   │
│  │   └──────────────────┘    └──────────────────────────────────────────┘  │   │
│  │                                                                          │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                       │                                         │
│                                       ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                    GENERIC SESSION INFRASTRUCTURE                        │   │
│  │                                                                          │   │
│  │   ┌────────────────┐  ┌────────────────┐  ┌────────────────┐            │   │
│  │   │ Variables      │  │ Entry Points   │  │ Block Registry │            │   │
│  │   │ (key-value)    │  │ (workflow refs)│  │ (available)    │            │   │
│  │   └────────────────┘  └────────────────┘  └────────────────┘            │   │
│  │                                                                          │   │
│  │   ┌────────────────┐  ┌────────────────┐  ┌────────────────┐            │   │
│  │   │ Widget Config  │  │ Repository     │  │ Event/Command  │            │   │
│  │   │ (custom views) │  │ Binding        │  │ History        │            │   │
│  │   └────────────────┘  └────────────────┘  └────────────────┘            │   │
│  │                                                                          │   │
│  │   ┌─────────────────────────────────────────────────────────────────┐   │   │
│  │   │              Block Approval System (for publishing)              │   │   │
│  │   └─────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                          │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                       │                                         │
│          Session-specific content     │     is stored/executed here             │
│                                       ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │              SESSION CONTENT (Defined by session creator)                │   │
│  │                                                                          │   │
│  │   Whatever workflows, blocks, variables, widgets the creator defines    │   │
│  │   This is NOT part of Maestro - it's what the USER puts in the session  │   │
│  │                                                                          │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Maestro Shell (Generic)

### 3.1 Design

The Maestro Shell is a generic interactive CLI that works with ANY session type.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Terminal - Maestro Shell                                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  $ maestro                                                                      │
│                                                                                 │
│  ╔═══════════════════════════════════════════════════════════════════════════╗ │
│  ║                                                                           ║ │
│  ║   ███╗   ███╗ █████╗ ███████╗███████╗████████╗██████╗  ██████╗           ║ │
│  ║   ████╗ ████║██╔══██╗██╔════╝██╔════╝╚══██╔══╝██╔══██╗██╔═══██╗          ║ │
│  ║   ██╔████╔██║███████║█████╗  ███████╗   ██║   ██████╔╝██║   ██║          ║ │
│  ║   ██║╚██╔╝██║██╔══██║██╔══╝  ╚════██║   ██║   ██╔══██╗██║   ██║          ║ │
│  ║   ██║ ╚═╝ ██║██║  ██║███████╗███████║   ██║   ██║  ██║╚██████╔╝          ║ │
│  ║   ╚═╝     ╚═╝╚═╝  ╚═╝╚══════╝╚══════╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝           ║ │
│  ║                                                                           ║ │
│  ║   Workflow Orchestration Framework v1.0.0                                 ║ │
│  ║   Type 'help' for commands, 'exit' to quit                               ║ │
│  ║                                                                           ║ │
│  ╚═══════════════════════════════════════════════════════════════════════════╝ │
│                                                                                 │
│  maestro> help                                                                  │
│                                                                                 │
│  Session Management:                                                            │
│    session list                    List all sessions                            │
│    session create --type <type>    Create session (foundry, project)            │
│    session start <id>              Start session                                │
│    session stop <id>               Stop session                                 │
│    session vars <id> list          List session variables                       │
│    session vars <id> get <key>     Get variable value                           │
│    session vars <id> set <k> <v>   Set variable value                           │
│    session invoke <id> <entry>     Invoke session entry point                   │
│                                                                                 │
│  Monitoring:                                                                    │
│    monitor <session-id>            Monitor any session (generic view)           │
│                                                                                 │
│  Block Management:                                                              │
│    blocks                          List blocks                                  │
│    block publish <id>              Submit block for approval                    │
│    block --pending-approval        List pending approvals                       │
│    block approve <id>              Approve pending block                        │
│    block reject <id> --reason "x"  Reject with feedback                         │
│                                                                                 │
│  maestro>                                                                       │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Key Points

- **Generic**: Works the same regardless of session type or content
- **No session-specific logic**: Doesn't know about "phases" or specific workflows
- **Entry Points**: Uses generic `session invoke` to trigger session-defined entry points

---

## 4. Monitor Shell Framework (Generic with Pluggable Widgets)

### 4.1 Generic Structure

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  MONITOR: <any-session-id>                                                       │
│  Status: <Running|Paused|...> | Duration: <time>                                │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  GENERIC ZONE: Variables                                                        │
│  ─────────────────────────────────────────────────────────────────────────────  │
│  (Shows whatever variables the session has defined)                             │
│                                                                                 │
│    key1: value1                                                                 │
│    key2: value2                                                                 │
│    ...                                                                          │
│                                                                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  GENERIC ZONE: Execution Tree                                                   │
│  ─────────────────────────────────────────────────────────────────────────────  │
│  (Shows whatever blocks are currently executing - structure varies by session)  │
│                                                                                 │
│  ▶ Workflow: <name>                                              [<status>]    │
│    ├─ ▶ Block: <name>                                            [<status>]    │
│    │     Output: <last output snippet>                                         │
│    └─ ▶ Block: <name>                                            [<status>]    │
│                                                                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  GENERIC ZONE: Recent Events                                                    │
│  ─────────────────────────────────────────────────────────────────────────────  │
│                                                                                 │
│  [HH:MM:SS] Event description                                                   │
│  [HH:MM:SS] Event description                                                   │
│  [HH:MM:SS] Event description                                                   │
│                                                                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  PLUGGABLE ZONE: Custom Widgets (session-specific)                              │
│  ─────────────────────────────────────────────────────────────────────────────  │
│                                                                                 │
│  (If the session registered custom widgets, they appear here)                   │
│  (If no custom widgets, this zone is empty or shows "No custom widgets")        │
│                                                                                 │
│  ┌─────────────────────────────────┐  ┌─────────────────────────────────────┐  │
│  │ Widget: <registered-widget-1>   │  │ Widget: <registered-widget-2>       │  │
│  │ (rendered based on widget type) │  │ (rendered based on widget type)     │  │
│  └─────────────────────────────────┘  └─────────────────────────────────────┘  │
│                                                                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│  [r] Refresh | [v] Toggle variables | [w] Toggle widgets | [Ctrl+C] Exit       │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Widget System

**Widget Types** (provided by Maestro, reusable across any session):

| Type | Description | Config |
|------|-------------|--------|
| `progress-bar` | Shows progress toward a goal | label, current, max |
| `score-chart` | Shows numeric values over time | label, data, threshold |
| `status-list` | Shows list of items with status | label, items |
| `counter` | Shows a single numeric value | label, value, unit |
| `text-display` | Shows text content | label, content |

**Widget Registration** (by session):

```json
{
  "monitorWidgets": [
    {
      "id": "my-custom-widget",
      "type": "progress-bar",
      "config": {
        "label": "Custom Progress",
        "current": "$.variables.someValue",
        "max": "$.variables.someMax"
      }
    }
  ]
}
```

The `$.variables.xxx` syntax references session variables, making widgets data-driven.

### 4.3 Status Icons (Generic)

| Icon | Status | Used For |
|------|--------|----------|
| `◯` | Pending | Any pending block |
| `⟳` | Running | Any running block |
| `✓` | Completed | Any completed block |
| `✗` | Failed | Any failed block |
| `◼` | Skipped | Any skipped block |
| `⊘` | Cancelled | Any cancelled block |

---

## 5. Session Variables System (Generic)

### 5.1 Design

```csharp
// In ContainerSession base class
public Dictionary<string, object> Variables { get; protected set; } = new();

public void SetVariable(string key, object value);
public T GetVariable<T>(string key, T defaultValue = default);
public bool HasVariable(string key);
public void RemoveVariable(string key);
```

### 5.2 CLI Commands

```bash
# Generic commands that work with ANY session
maestro session vars <session-id> list
maestro session vars <session-id> get <key>
maestro session vars <session-id> set <key> <value>
maestro session vars <session-id> set <key> --json '{"complex": "value"}'
maestro session vars <session-id> remove <key>
```

### 5.3 Key Point

Variables are a **generic key-value store**. Maestro does NOT predefine any variable names. Sessions define whatever variables they need.

---

## 6. Entry Points Mechanism (Generic)

### 6.1 Design

Sessions can define multiple entry points that map to workflows:

```json
{
  "entryPoints": {
    "start": "workflow:main-workflow",
    "custom-action": "workflow:another-workflow",
    "test-single": "workflow:test-runner"
  }
}
```

### 6.2 CLI Commands

```bash
# List entry points for a session
maestro session entry-points <session-id>

# Invoke an entry point
maestro session invoke <session-id> start
maestro session invoke <session-id> custom-action --input key=value
```

### 6.3 Key Point

Entry points are a **generic mechanism**. What they invoke is **session-specific**.

---

## 7. Block Approval System (Generic)

### 7.1 Design

Any session that creates a block can submit it for human approval:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          BLOCK APPROVAL WORKFLOW                                 │
│                                                                                 │
│   Session creates block                                                         │
│          │                                                                      │
│          ▼                                                                      │
│   maestro block publish <block-id>                                              │
│          │                                                                      │
│          ▼                                                                      │
│   Block added to pending-approval queue                                         │
│          │                                                                      │
│          ▼                                                                      │
│   Human reviews: maestro block --pending-approval                               │
│          │                                                                      │
│     ┌────┴────┐                                                                 │
│     │         │                                                                 │
│     ▼         ▼                                                                 │
│  Approve   Reject                                                               │
│     │         │                                                                 │
│     ▼         ▼                                                                 │
│  Published  Feedback stored                                                     │
│  to global  in session repo                                                     │
│  catalog    for iteration                                                       │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 CLI Interface

```bash
# Submit for approval
maestro block publish <block-id> --from-session <session-id>

# List pending
maestro block --pending-approval

# Review details
maestro block info <pending-id>

# Approve
maestro block approve <pending-id>

# Reject with feedback
maestro block reject <pending-id> --reason "Need to handle edge case X"
```

---

# PART B: SAMPLE SESSION - "Generate Commit Tool Foundry"

---

## 8. Sample Session Overview

This section describes ONE SPECIFIC session that uses the generic infrastructure. Another session could have a completely different internal architecture.

### 8.1 Session Definition

```json
{
  "id": "foundry-gen-commit-001",
  "type": "foundry",
  "name": "Generate Commit Tool Foundry",

  "binding": {
    "type": "repository",
    "path": "C:/Users/arthu/foundry-repos/gen-commit"
  },

  "variables": {
    "qualityThreshold": 0.8,
    "maxIterations": 10,
    "maxOptimizationRounds": 5,
    "currentPhase": 1,
    "scoreHistory": []
  },

  "entryPoints": {
    "start": "workflow:three-phase-pipeline",
    "phase2": "workflow:optimization-phase",
    "phase3": "workflow:publication-phase"
  },

  "monitorWidgets": [
    {
      "id": "phase-progress",
      "type": "progress-bar",
      "config": {
        "label": "Phase",
        "current": "$.variables.currentPhase",
        "max": 3
      }
    },
    {
      "id": "quality-score",
      "type": "score-chart",
      "config": {
        "label": "Quality Score",
        "data": "$.variables.scoreHistory",
        "threshold": "$.variables.qualityThreshold"
      }
    }
  ],

  "blockRegistry": [
    "system:maestro-cli",
    "tools/git-status",
    "tools/git-diff",
    "tools/git-log",
    "tools/file-read",
    "tools/file-write",
    "tools/shell-execute"
  ]
}
```

### 8.2 This Session's Internal Architecture

**Note**: This is what THIS session does. Another session could be completely different.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│           THIS SESSION'S INTERNAL WORKFLOW (Session-Specific)                    │
│                                                                                 │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                         PHASE 1: CREATION                                │   │
│   │                                                                          │   │
│   │   While: !done && iterations < maxIterations                            │   │
│   │     │                                                                    │   │
│   │     ├─ Inference: Creator Agent                                         │   │
│   │     │    - Creates/modifies commit-description workflow                 │   │
│   │     │    - Uses maestro-cli to create blocks                            │   │
│   │     │                                                                    │   │
│   │     └─ When done → Test & Evaluate                                      │   │
│   │          - Run test cases                                                │   │
│   │          - Grade results                                                 │   │
│   │          - If score < threshold → feed back to creator                  │   │
│   │                                                                          │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                       │                                         │
│                          score >= threshold                                     │
│                                       ▼                                         │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                       PHASE 2: OPTIMIZATION                              │   │
│   │                                                                          │   │
│   │   While: canOptimize && rounds < maxOptimizationRounds                  │   │
│   │     │                                                                    │   │
│   │     ├─ Inference: Optimizer Agent                                       │   │
│   │     │    - Suggests token reduction changes                             │   │
│   │     │    - Maintains quality above baseline                             │   │
│   │     │                                                                    │   │
│   │     └─ Re-evaluate                                                       │   │
│   │          - If quality dropped → rollback                                │   │
│   │          - If no more optimizations → proceed                           │   │
│   │                                                                          │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                       │                                         │
│                                       ▼                                         │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                       PHASE 3: PUBLICATION                               │   │
│   │                                                                          │   │
│   │   1. Final validation                                                    │   │
│   │   2. Package as tool (wrapper around workflow)                          │   │
│   │   3. Submit for approval: maestro block publish                         │   │
│   │   4. Session complete                                                    │   │
│   │                                                                          │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 8.3 Monitor View FOR THIS SESSION

When monitoring THIS specific session, the custom widgets show phase/score info:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  MONITOR: foundry-gen-commit-001                                                │
│  Status: Running | Duration: 12m 34s                                            │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  Variables:                                                                     │
│    qualityThreshold: 0.8                                                        │
│    maxIterations: 10                                                            │
│    currentPhase: 1                                                              │
│    scoreHistory: [0.42, 0.61, 0.72]                                            │
│                                                                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  Execution Tree:                                                                │
│                                                                                 │
│  ▶ Workflow: three-phase-pipeline                                     [⟳]      │
│    └─ ▶ Workflow: creation-phase                                      [⟳]      │
│         ├─ ▶ While: creation-loop                               [⟳ i=3]       │
│         │    ├─ ▶ Inference: creator-agent                          [✓]       │
│         │    └─ ▶ Tool: maestro-cli                                 [✓]       │
│         └─ ▶ Workflow: test-and-evaluate                            [◯]       │
│                                                                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  Recent Events:                                                                 │
│    [12:45:32] creator-agent completed                                          │
│    [12:45:33] maestro-cli executed: blocks update...                           │
│    [12:45:34] Starting iteration 4                                             │
│                                                                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  Custom Widgets (this session):                                                 │
│                                                                                 │
│  ┌─────────────────────────────┐  ┌─────────────────────────────────────────┐  │
│  │ Phase Progress              │  │ Quality Score History                   │  │
│  │                             │  │                                         │  │
│  │ Phase 1 ████████████░░░ 3   │  │ 1.0 ┤                                   │  │
│  │         ░░░░░░░░░░░░░░░     │  │     │              ╭─ threshold (0.8)   │  │
│  │         ░░░░░░░░░░░░░░░     │  │ 0.5 ┤    ╭────╮   ╭──────────────       │  │
│  │                             │  │     │ ╭──╯    ╰───╯                     │  │
│  │ [Phase 1 of 3]             │  │ 0.0 ┼─────────────────────               │  │
│  │                             │  │       1   2   3   4   5                 │  │
│  └─────────────────────────────┘  └─────────────────────────────────────────┘  │
│                                                                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│  [r] Refresh | [v] Variables | [w] Widgets | [Ctrl+C] Exit                     │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 8.4 Contrast: A Different Session

A DIFFERENT Foundry session might look completely different:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  MONITOR: foundry-code-reviewer-001                                             │
│  Status: Running | Duration: 5m 12s                                             │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  Variables:                                                                     │
│    reviewDepth: "thorough"                                                      │
│    maxIssuesPerFile: 10                                                         │
│    currentFile: "src/utils.ts"                                                  │
│    filesReviewed: 3                                                             │
│    totalFiles: 12                                                               │
│                                                                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  Execution Tree:                                                                │
│                                                                                 │
│  ▶ Workflow: review-all-files                                         [⟳]      │
│    └─ ▶ ForEach: file in changedFiles                            [⟳ 3/12]     │
│         └─ ▶ Agent: code-reviewer                                     [⟳]      │
│                                                                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  Custom Widgets (this session):                                                 │
│                                                                                 │
│  ┌─────────────────────────────┐  ┌─────────────────────────────────────────┐  │
│  │ Files Progress              │  │ Issues Found                            │  │
│  │                             │  │                                         │  │
│  │ ████████░░░░░░░░░░░░ 3/12  │  │ Critical: 0                             │  │
│  │                             │  │ Warning:  5                             │  │
│  │ Current: src/utils.ts       │  │ Info:     12                            │  │
│  │                             │  │                                         │  │
│  └─────────────────────────────┘  └─────────────────────────────────────────┘  │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Same generic monitor framework, completely different content.**

---

## 9. User Journey for This Sample Session

```
STEP 1: Start Maestro Shell
─────────────────────────────────────────────────────────────────────────────────
$ maestro
maestro>


STEP 2: Create the Session
─────────────────────────────────────────────────────────────────────────────────
maestro> session create --type foundry --name "Generate Commit Tool"

  ? Repository (new/existing): new
  ? Path: C:\Users\arthu\foundry-repos\gen-commit

  Session created: foundry-gen-commit-001


STEP 3: Configure Variables (session-specific)
─────────────────────────────────────────────────────────────────────────────────
maestro> session vars foundry-gen-commit-001 set qualityThreshold 0.8
maestro> session vars foundry-gen-commit-001 set maxIterations 10


STEP 4: Load Session Content (workflows, blocks)
─────────────────────────────────────────────────────────────────────────────────
(User would either import a template or create workflows manually)

maestro> session import foundry-gen-commit-001 --template generate-tool-foundry

  Imported:
    - workflow: three-phase-pipeline
    - workflow: creation-phase
    - workflow: optimization-phase
    - workflow: publication-phase
    - block: creator-context
    - block: evaluator
    - script: test-case-generator.py
    - widgets: phase-progress, quality-score


STEP 5: Start Session
─────────────────────────────────────────────────────────────────────────────────
maestro> session start foundry-gen-commit-001

  Starting session...
  Invoking entry point: start → workflow:three-phase-pipeline

  Session is now Running.


STEP 6: Monitor (optional)
─────────────────────────────────────────────────────────────────────────────────
maestro> monitor foundry-gen-commit-001

  [Generic monitor with this session's custom widgets]


STEP 7: Approval (when session publishes)
─────────────────────────────────────────────────────────────────────────────────
maestro> block --pending-approval
maestro> block approve pending-001

```

---

## 10. Summary: Generic vs Specific

| Aspect | Generic (Maestro) | Specific (This Session) |
|--------|-------------------|------------------------|
| **Shell** | Same for all | - |
| **Monitor Framework** | Same for all | Widgets registered by this session |
| **Variables System** | Same API for all | Keys/values defined by this session |
| **Entry Points** | Same mechanism | Workflows defined by this session |
| **Approval** | Same for all | - |
| **Internal Workflow** | - | 3-phase pipeline |
| **Test Cases** | - | Commit description scenarios |
| **Evaluation Criteria** | - | Commit quality metrics |

---

*This design correctly separates generic Maestro infrastructure from session-specific content, enabling any session to have any internal architecture while benefiting from common tooling.*
