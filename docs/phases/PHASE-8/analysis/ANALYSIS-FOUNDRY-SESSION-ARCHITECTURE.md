# Analysis Document: Foundry Session Architecture
**Phase 8 - First Functional Session**
**Date**: February 5, 2026
**Author**: Claude Opus 4.5

---

## 1. Executive Summary

This document captures the comprehensive analysis of the Maestro codebase performed to design Phase 8. It clearly separates:
- **Generic Infrastructure**: What Maestro/Foundry provides to ALL sessions
- **Session-Specific Content**: What THIS particular session (generate-commit-tool) defines

This separation is crucial: the power of Maestro is that the infrastructure is reusable across ANY session with ANY internal architecture.

---

## 2. Architectural Separation Principle

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         SEPARATION OF CONCERNS                                   │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                    GENERIC INFRASTRUCTURE (Maestro)                      │   │
│  │                                                                          │   │
│  │  Provided by the system, same for ALL sessions:                         │   │
│  │                                                                          │   │
│  │  • Maestro Shell (interactive CLI)                                      │   │
│  │  • Monitor Shell Framework (with pluggable widgets)                     │   │
│  │  • Session Variables (generic key-value store)                          │   │
│  │  • Block Approval System                                                │   │
│  │  • Session Lifecycle (start/pause/stop)                                 │   │
│  │  • Repository/Sandbox Binding                                           │   │
│  │  • Event/Command History                                                │   │
│  │  • Entry Points mechanism                                               │   │
│  │  • Block Registry per session                                           │   │
│  │                                                                          │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                       │                                         │
│                                       │ Session uses infrastructure             │
│                                       │ and defines its own content             │
│                                       ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │              SESSION-SPECIFIC CONTENT (Defined by creator)               │   │
│  │                                                                          │   │
│  │  Example: "Generate Commit Tool Foundry" session                        │   │
│  │                                                                          │   │
│  │  • Internal workflow (3-phase pipeline - specific to this session)      │   │
│  │  • Variables values (qualityThreshold=0.8 - specific to this session)   │   │
│  │  • Custom widgets (PhaseProgress, ScoreHistory - specific)              │   │
│  │  • Entry points (start-creation, start-optimization - specific)         │   │
│  │  • Test cases and evaluation logic (specific)                           │   │
│  │                                                                          │   │
│  │  Another session could have completely different:                        │   │
│  │  • A continuous improvement loop instead of phases                      │   │
│  │  • Variables like maxTokenBudget, targetAccuracy                        │   │
│  │  • Different widgets for different metrics                              │   │
│  │                                                                          │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Existing Infrastructure Analysis

### 3.1 CLI Structure

**Location**: `tools/maestro-cli/index.js` (4953 lines)

**Key Findings**:
- Command-based architecture using `minimist` for argument parsing
- Two-level command hierarchy: `maestro <command> [subcommand] [args]`
- **No interactive shell mode exists** - each invocation is a new Node process
- API client at `tools/shared/api-client.js` with retry logic
- 100+ commands across 14 categories

**Gap Identified**: No interactive REPL/shell mode like Claude Code terminal.

### 3.2 Session Architecture

**Class Hierarchy**:
```
ContainerSession (abstract)
├── Workspace
└── Session (abstract)
    ├── ProjectSession (repository-bound)
    └── FoundrySession (sandbox/repository)
```

**Key Point**: `FoundrySession` is a GENERIC container. It does NOT define what workflow runs inside - that's up to the session creator.

**Existing FoundrySession Features** (all generic):
- Training lifecycle (Idle/Running/Paused/Completed/Stopped)
- Iteration tracking (generic - tracks ANY iterations)
- Evaluation system (generic framework)
- Improvement suggestions tracking
- SessionMetrics aggregation

**Locations**:
- Domain: `backend/src/Maestro.Domain/Entities/FoundrySession.cs`
- Repository: `backend/src/Maestro.Infrastructure/Repositories/FileSystemFoundrySessionRepository.cs`

### 3.3 Block System

**13 Block Types**:
- **Atomic**: prompt, instruction, command, decision, validator, trigger, inference, script, context
- **Composite**: workflow, task, agent, tool

**Key Insight**: Any session can use ANY combination of these blocks. The internal architecture is defined by the session creator, not by Maestro.

### 3.4 Control Flow Blocks

**Design Document**: `DESIGN-CONTROL-FLOW-BLOCKS.md`

These are GENERIC building blocks that any session can use:
- `while` - loop while condition
- `foreach` - iterate over collection
- `decision` - if/else branching
- `parallel` - concurrent execution
- `retry` - retry on failure

A session's internal workflow USES these blocks but defines its own structure.

---

## 4. Generic Infrastructure Design Decisions

### 4.1 Maestro Shell (Generic)

**Decision**: Implement REPL-style interactive shell in Node.js

**What it provides** (same for ALL users):
- Interactive prompt
- Command history
- Session context tracking
- Access to all maestro commands

**What it does NOT provide**:
- Session-specific commands (those come from entry points)
- Hardcoded workflows

### 4.2 Session Variables (Generic)

**Decision**: Add generic `Variables` dictionary to `ContainerSession` base class

**What it provides**:
```csharp
// Generic storage - session defines whatever keys it needs
public Dictionary<string, object> Variables { get; protected set; }
```

**What it does NOT provide**:
- Pre-defined variable names
- Hardcoded thresholds
- Session-type-specific variables

**Example usage by different sessions**:
```
Session A (commit-tool):     Session B (code-reviewer):
  qualityThreshold: 0.8        accuracyTarget: 0.95
  maxIterations: 10            maxReviewTime: 30
  currentPhase: 1              reviewDepth: "thorough"
```

### 4.3 Monitor Shell Framework (Generic with Pluggable Widgets)

**Decision**: Generic monitor with extensible widget system

**What is GENERIC** (same for all sessions):
- Session header (name, status, duration)
- Execution tree (shows current blocks running)
- Event log (shows session events)
- Variables display (shows session.Variables)
- Controls (refresh, exit)

**What is PLUGGABLE** (session-specific):
- Custom widgets registered by the session
- Widget types are reusable, but configuration is session-specific

**Widget System**:
```json
// Session registers its custom widgets
{
  "monitorWidgets": [
    {
      "id": "phase-progress",
      "type": "progress-bar",        // Generic widget type
      "config": {                     // Session-specific config
        "label": "Phase",
        "current": "$.variables.currentPhase",
        "max": "$.variables.totalPhases"
      }
    }
  ]
}
```

### 4.4 Entry Points (Generic Mechanism)

**Decision**: Sessions define their own entry points

**What Maestro provides**:
- Mechanism to register entry points
- CLI command to invoke entry points: `session invoke <id> <entry-point>`
- Default entry point: `start`

**What sessions define**:
```json
// Session A might have:
{
  "entryPoints": {
    "start": "workflow:three-phase-pipeline",
    "resume-from-phase2": "workflow:phase-2-optimization"
  }
}

// Session B might have:
{
  "entryPoints": {
    "start": "workflow:continuous-improvement",
    "run-single-test": "workflow:single-test-run"
  }
}
```

### 4.5 Block Approval System (Generic)

**Decision**: Generic approval workflow usable by any session

Any session that creates a block and wants to publish it can use:
- `maestro block publish <id>` - submit for approval
- `maestro block --pending-approval` - list pending
- `maestro block approve/reject <id>` - review

This is infrastructure, not session-specific.

---

## 5. Session-Specific Content (This Session)

The following is specific to the "Generate Commit Tool Foundry" session and should NOT be part of generic infrastructure:

### 5.1 Three-Phase Pipeline

This is the INTERNAL WORKFLOW of this specific session:
- Phase 1: Creation (AI creates the workflow)
- Phase 2: Optimization (reduce tokens)
- Phase 3: Publication (validate and publish)

**Another session might have**:
- No phases at all
- 5 phases
- A continuous loop
- Something completely different

### 5.2 Specific Variables

These are THIS session's variables:
- `qualityThreshold: 0.8`
- `maxIterations: 10`
- `currentPhase: 1`
- `scoreHistory: [...]`

### 5.3 Specific Blocks/Workflows

These are created FOR this session:
- `creator-context.context.block.json` - specific system prompt
- `evaluator.inference.block.json` - specific evaluation criteria
- `test-case-generator.py` - specific test cases for commit descriptions

### 5.4 Custom Monitor Widgets

This session might register:
- `PhaseProgressWidget` - shows Phase 1/2/3 progress
- `ScoreHistoryWidget` - shows quality score over iterations

---

## 6. How Sessions Define Their Content

### 6.1 Session Template (Optional)

Sessions can be created from templates:
```bash
maestro session create --type foundry --template generate-tool-foundry
```

The template provides:
- Initial workflow structure
- Default variables
- Suggested entry points
- Custom widgets

But templates are OPTIONAL. A session can be created empty and the user/AI builds everything from scratch.

### 6.2 During Session

The session creator (human or AI) can:
1. Create blocks using `maestro blocks create`
2. Set variables using `session vars set`
3. Define entry points
4. Register custom widgets

### 6.3 Session Repository

If repository-bound, the session's content lives in:
```
{repository}/
├── .maestro/
│   ├── session.json          # Session metadata
│   ├── variables.json        # Session variables
│   ├── widgets.json          # Custom widget definitions
│   └── entry-points.json     # Entry point mappings
├── blocks/
│   └── (session-created blocks)
└── (other session files)
```

---

## 7. Technology Decisions

### 7.1 Interactive Shell

**Technology**: Node.js with `readline` module
**Scope**: Generic infrastructure

### 7.2 Monitor Shell

**Technology**: Node.js with terminal UI
**Scope**: Generic framework + pluggable widget system

**Widget Types** (provided by Maestro, reusable):
- `progress-bar` - shows progress toward a goal
- `score-chart` - shows numeric values over time
- `status-indicator` - shows boolean states
- `log-viewer` - shows filtered logs
- `key-value-list` - shows variable pairs

Sessions pick which widgets to use and configure them.

### 7.3 Session Content Storage

**For this specific session**:
- Workflows stored in session repository
- Templates can be provided but are optional

---

## 8. Existing Commands Verification

### 8.1 Commands That Need Creation (Generic Infrastructure)

| Command | Scope | Notes |
|---------|-------|-------|
| `maestro` (no args) | Generic | Launch interactive shell |
| `session vars` | Generic | Manage ANY session's variables |
| `block publish` | Generic | Submit ANY block for approval |
| `block --pending-approval` | Generic | List pending approvals |
| `monitor <session-id>` | Generic | Monitor ANY session |

### 8.2 Commands That Are Session-Specific

| Command | Scope | Notes |
|---------|-------|-------|
| `session invoke <id> <entry-point>` | Generic mechanism | But entry points are session-defined |

---

## 9. Risk Analysis

### 9.1 Risks of Mixing Generic/Specific

| Risk | Impact | Mitigation |
|------|--------|------------|
| Hardcoding session logic in infrastructure | Other sessions won't work | Clear separation as documented |
| Monitor assumes specific structure | Breaks for different sessions | Pluggable widget system |
| Variables have assumed names | Confusing for other sessions | Generic dictionary, no defaults |

### 9.2 Risks for This Specific Session

| Risk | Impact | Mitigation |
|------|--------|------------|
| 3-phase pipeline too complex | Takes too long | Simpler workflow as fallback |
| Creator agent stuck | Infinite loop | maxIterations variable |
| Evaluator quality | Poor feedback | Can use external LLM |

---

## 10. Summary: What Goes Where

### Generic Infrastructure (Maestro provides)

| Component | Location | Description |
|-----------|----------|-------------|
| Maestro Shell | `tools/maestro-cli/shell.js` | Interactive CLI for all users |
| Monitor Framework | `tools/maestro-cli/monitor.js` | Generic monitor with widget slots |
| Widget Types | `tools/maestro-cli/widgets/` | Reusable widget implementations |
| Session Variables | `ContainerSession.Variables` | Generic key-value store |
| Entry Points | `Session.EntryPoints` | Generic mechanism |
| Block Approval | `BlockApprovalService` | Generic approval workflow |

### Session-Specific Content (This session defines)

| Component | Location | Description |
|-----------|----------|-------------|
| 3-Phase Workflow | Session repository | This session's internal workflow |
| Creator Context | Session repository | Specific system prompt |
| Evaluator | Session repository | Specific evaluation criteria |
| Test Cases | Session repository | Specific to commit descriptions |
| Variables | Session.Variables | qualityThreshold, etc. |
| Custom Widgets | Session config | PhaseProgress, ScoreHistory |

---

*This analysis document clearly separates generic infrastructure from session-specific content, enabling any agent to understand what Maestro provides versus what this particular session defines.*
