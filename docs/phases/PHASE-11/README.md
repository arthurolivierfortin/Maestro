# Phase 8: Generic Session Infrastructure & First Functional Session

**Status**: Design Complete - Ready for Implementation
**Date**: February 5, 2026

---

## Overview

Phase 8 has two distinct parts:

**Part A: Generic Infrastructure** - Features that work with ANY session
**Part B: Sample Session** - A specific session demonstrating the infrastructure

This separation is critical: the power of Maestro is that infrastructure is reusable across sessions with ANY internal architecture.

---

## Key Principle: Generic vs Specific

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                 │
│  GENERIC INFRASTRUCTURE (Maestro provides - same for ALL sessions)             │
│                                                                                 │
│  • Maestro Shell - Interactive CLI                                             │
│  • Monitor Shell Framework - With pluggable widget zones                       │
│  • Session Variables - Generic key-value store                                 │
│  • Entry Points - Generic mechanism to invoke workflows                        │
│  • Block Approval - Generic publication workflow                               │
│  • Widget Types - Reusable (progress-bar, score-chart, etc.)                  │
│                                                                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  SESSION-SPECIFIC CONTENT (Each session defines its own)                       │
│                                                                                 │
│  Session A: "Generate Commit Tool"    Session B: "Code Reviewer"              │
│  • 3-phase pipeline workflow          • File-by-file review workflow          │
│  • qualityThreshold variable          • reviewDepth variable                   │
│  • PhaseProgress widget               • FilesProgress widget                   │
│  • Commit evaluation logic            • Issue detection logic                  │
│                                                                                 │
│  COMPLETELY DIFFERENT internal architectures, SAME infrastructure              │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Deliverables

### Part A: Generic Infrastructure

| Feature | Description |
|---------|-------------|
| **Maestro Shell** | Interactive CLI for all users, works with any session |
| **Monitor Shell Framework** | Generic monitoring with pluggable widget zones |
| **Widget System** | Reusable widget types (progress-bar, score-chart, etc.) |
| **Session Variables** | Generic key-value store (sessions define their own keys) |
| **Entry Points** | Generic mechanism (sessions define their own entry points) |
| **Block Approval** | Generic workflow for publishing blocks |

### Part B: Sample Session

| Component | Description |
|-----------|-------------|
| **3-Phase Pipeline** | Creation → Optimization → Publication |
| **Custom Widgets** | PhaseProgress, QualityScore |
| **Session Variables** | qualityThreshold, maxIterations, currentPhase |
| **Template** | Optional template for similar sessions |

---

## Documentation Structure

```
PHASE-8/
├── README.md                           # This file
├── user-request/
│   └── user-request--1.md              # Original requirements
├── analysis/
│   └── ANALYSIS-FOUNDRY-SESSION-ARCHITECTURE.md
│       # Clear separation of generic vs specific
│       # Infrastructure analysis
│       # Design decisions
├── design/
│   └── DESIGN-FOUNDRY-SESSION-GENERATE-COMMIT-TOOL.md
│       # Part A: Generic infrastructure design
│       # Part B: Sample session design
│       # UI mockups for generic monitor with widgets
│       # Shows how different sessions look different
└── implementation/
    └── IMPLEMENTATION-PLAN.md
        # Part A: Generic infrastructure WPs (WP1-WP6)
        # Part B: Sample session WPs (WP7-WP8)
        # Clear dependency graph
```

---

## Quick Links

| Document | Purpose |
|----------|---------|
| [Analysis](analysis/ANALYSIS-FOUNDRY-SESSION-ARCHITECTURE.md) | Understanding generic vs specific |
| [Design](design/DESIGN-FOUNDRY-SESSION-GENERATE-COMMIT-TOOL.md) | Complete design with correct separation |
| [Implementation](implementation/IMPLEMENTATION-PLAN.md) | Technical plan with correct scoping |

---

## Monitor Shell: Generic with Pluggable Widgets

The key insight is that the Monitor Shell is GENERIC but sessions can register CUSTOM WIDGETS:

```
┌─────────────────────────────────────────────────────────────────┐
│  MONITOR: <any-session>                                         │
│  Status: <status> | Duration: <time>                            │
├─────────────────────────────────────────────────────────────────┤
│  GENERIC: Variables (shows whatever keys the session has)       │
├─────────────────────────────────────────────────────────────────┤
│  GENERIC: Execution Tree (shows current blocks - any structure) │
├─────────────────────────────────────────────────────────────────┤
│  GENERIC: Events (session events log)                           │
├─────────────────────────────────────────────────────────────────┤
│  PLUGGABLE: Custom Widgets                                      │
│  (Each session registers its own widgets using generic types)   │
│                                                                 │
│  Session A might show:     Session B might show:                │
│  [Phase Progress]          [Files Reviewed]                     │
│  [Quality Score]           [Issues Found]                       │
└─────────────────────────────────────────────────────────────────┘
```

Widget TYPES are generic (progress-bar, score-chart).
Widget CONFIGURATION is session-specific.

---

## Session Variables: Generic Store

```csharp
// Generic API - sessions define whatever keys they need
session.SetVariable("myKey", myValue);
session.GetVariable<T>("myKey", defaultValue);
```

```bash
# Generic CLI - works for any session
maestro session vars <id> set <key> <value>
maestro session vars <id> get <key>
```

No predefined variable names. Each session defines its own.

---

## Entry Points: Generic Mechanism

```json
// Session defines its own entry points
{
  "entryPoints": {
    "start": "workflow:my-main-workflow",
    "custom": "workflow:another-workflow"
  }
}
```

```bash
# Generic CLI
maestro session invoke <id> start
maestro session invoke <id> custom
```

---

## Implementation Order

**Phase 1: Core Infrastructure**
1. WP1: Session Variables
2. WP2: Maestro Shell
3. WP4: Entry Points

**Phase 2: Monitoring & Approval**
4. WP3: Monitor Shell Framework
5. WP6: Widget Registration
6. WP5: Block Approval System

**Phase 3: Sample Session (Optional)**
7. WP7: Session Template
8. WP8: Sample Workflows

---

## Success Criteria

### Generic Infrastructure (Required)
- [ ] Shell works with any session type
- [ ] Monitor works with any session (generic + custom widgets)
- [ ] Variables work for any session (no predefined keys)
- [ ] Entry points work for any session
- [ ] Approval works for any session

### Sample Session (Demonstrates Infrastructure)
- [ ] Session runs with its specific 3-phase workflow
- [ ] Custom widgets display correctly
- [ ] Block is published for approval

---

## Why This Separation Matters

The original documents incorrectly mixed:
- Generic infrastructure (what Maestro provides)
- Session-specific content (what THIS session defines)

**Incorrect**: "FoundrySession has CurrentPhase property"
**Correct**: "This session stores currentPhase in its Variables"

**Incorrect**: "Monitor shows Phase Progress"
**Correct**: "This session registers a PhaseProgress widget on the generic monitor"

**Incorrect**: "Foundry sessions have 3 phases"
**Correct**: "This session happens to use a 3-phase workflow; another could be completely different"

This separation ensures ANY future session can have ANY architecture while benefiting from common tooling.

---

*"L'infrastructure est générique, le contenu est spécifique. C'est la force de Maestro."*
