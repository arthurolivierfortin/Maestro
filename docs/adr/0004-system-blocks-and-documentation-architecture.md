# ADR 0004: System Blocks and Documentation Architecture

**Status**: Accepted
**Date**: 2026-02-02
**Decision Makers**: Architecture Team

---

## Context

Maestro needs two interconnected systems:

1. **System Blocks**: Built-in blocks that power Maestro's internal functionality (model testing, documentation generation, evaluation). These must be visible, transparent, and overridable by users.

2. **Documentation System**: A way to persist and display results from runs (model tests, agent evaluations, workflow executions) both as structured data for the frontend and as human-readable documentation.

### The Problems

1. **Visibility vs Modification**: Users should see how Maestro works internally, but shouldn't accidentally break core functionality.

2. **Data Duplication**: Test results need to be:
   - Queryable by the frontend (JSON)
   - Readable by humans (Markdown)
   - Persistent and versioned

3. **Async Documentation**: Documentation generation shouldn't block test execution.

4. **Consistency**: The pattern used for training evaluation (pending → evaluated) should apply to documentation.

---

## Decision

We implement a **three-layer architecture** with **System Blocks**, **Knowledge Base (JSON)**, and **Generated Documentation (Markdown)**.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           LAYER 1: EXECUTION                             │
│                                                                          │
│  Frontend Button     CLI Command          Scheduled Task                 │
│  "Run Tests"         `maestro test`       (cron)                        │
│       │                   │                   │                          │
│       └───────────────────┼───────────────────┘                          │
│                           ▼                                              │
│              ┌─────────────────────────┐                                 │
│              │     SYSTEM BLOCK        │                                 │
│              │  model-capability-tester│                                 │
│              │  (visible, overridable) │                                 │
│              └────────────┬────────────┘                                 │
└───────────────────────────┼──────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     LAYER 2: KNOWLEDGE BASE (JSON)                       │
│                                                                          │
│  docs/knowledge-base/                                                    │
│  ├── _schemas/                    JSON Schemas for validation            │
│  ├── models/                      Model test results                     │
│  ├── model-test-runs/             Individual test runs                   │
│  ├── runs/                        Workflow execution logs                │
│  ├── agents/                      Agent configurations & metrics         │
│  └── architecture/                Architecture decisions                 │
│                                                                          │
│  Each document includes:                                                 │
│  {                                                                       │
│    "id": "smollm2-1.7b-20260202",                                       │
│    "collection": "models",                                               │
│    "document": { ... },           // Actual data                        │
│    "docStatus": "pending",        // pending | generated | outdated     │
│    "docPath": null                // Path to generated markdown          │
│  }                                                                       │
│                                                                          │
│  ► Frontend reads this layer directly via API                           │
│  ► Source of truth for all structured data                              │
└─────────────────────────────────────────────────────────────────────────┘
                            │
                            │ Docs Session processes pending items
                            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   LAYER 3: DOCUMENTATION (Markdown)                      │
│                                                                          │
│  docs/                                                                   │
│  ├── models/                                                             │
│  │   ├── index.md                 Auto-generated index                  │
│  │   ├── smollm2-1.7b.md          Generated from Knowledge Base         │
│  │   └── deepseek-r1-1.5b.md      Generated from Knowledge Base         │
│  ├── agents/                                                             │
│  │   └── index.md                                                        │
│  └── runs/                                                               │
│      └── index.md                                                        │
│                                                                          │
│  ► Human-readable encyclopedia                                           │
│  ► Can be served as static site (GitHub Pages)                          │
│  ► Git-versioned for history                                            │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Part 1: System Blocks

### Definition

**System Blocks** are blocks that power Maestro's internal functionality. They are:

| Property | Description |
|----------|-------------|
| **Visible** | Users can see them in Foundry catalog (System section) |
| **Transparent** | Users can inspect their implementation |
| **Non-modifiable** | Cannot be edited directly in the system folder |
| **Overridable** | Users can clone to `blocks/` and their version takes priority |
| **Used by App** | Frontend buttons and internal processes execute these blocks |

### Location

```
blocks/
├── system/                         ← SYSTEM BLOCKS (read-only)
│   ├── README.md
│   ├── testing/
│   │   ├── model-capability-tester.tool.block.json
│   │   ├── run-model-tests.command.block.json
│   │   └── analyze-test-results.inference.block.json
│   ├── documentation/
│   │   ├── documentation-agent.agent.block.json
│   │   ├── generate-model-doc.inference.block.json
│   │   └── generate-index.script.block.json
│   └── evaluation/
│       ├── training-evaluator.agent.block.json
│       └── score-calculator.script.block.json
│
├── tools/                          ← USER BLOCKS (read-write)
├── agents/
└── workflows/
```

### Override Mechanism

**Resolution Order** (highest to lowest priority):

1. `.maestro/blocks/` - Project-specific blocks
2. `~/.maestro/blocks/` - User-global blocks
3. `blocks/` - Repository blocks (user-created)
4. `blocks/system/` - System blocks (fallback)

**Example Override:**

```
blocks/
├── system/testing/model-capability-tester.tool.block.json  (v1.0 - system)
└── tools/model-capability-tester.tool.block.json           (v1.1 - user override)
```

When `model-capability-tester` is requested, the user's version in `blocks/tools/` is used.

### Foundry Integration

The Foundry UI displays blocks in sections:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         FOUNDRY - Block Catalog                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  📁 MY BLOCKS                                                            │
│  ├── autonomous-programmer (agent)                                       │
│  ├── code-reviewer (agent)                                               │
│  └── commit-message-generator (tool)                                     │
│                                                                          │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                          │
│  🔧 SYSTEM BLOCKS                              [Read-only] [Can Override]│
│  │                                                                       │
│  ├── 📂 testing/                                                         │
│  │   ├── model-capability-tester (tool)        [Clone to Override]      │
│  │   ├── run-model-tests (command)             [Clone to Override]      │
│  │   └── analyze-test-results (inference)      [Clone to Override]      │
│  │                                                                       │
│  ├── 📂 documentation/                                                   │
│  │   ├── documentation-agent (agent)           [Clone to Override]      │
│  │   └── generate-model-doc (inference)        [Clone to Override]      │
│  │                                                                       │
│  └── 📂 evaluation/                                                      │
│      └── training-evaluator (agent)            [Clone to Override]      │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Actions available on System Blocks:**

| Action | Available | Description |
|--------|-----------|-------------|
| View | Yes | See block definition and documentation |
| Edit | No | Cannot modify system blocks directly |
| Clone | Yes | Copy to `blocks/` for customization |
| Delete | No | Cannot delete system blocks |
| Execute | Yes | Run via CLI or API |
| Override | Yes | Create same-ID block in user folder |

### Block Metadata for System Blocks

```json
{
  "id": "model-capability-tester",
  "blockType": "tool",
  "metadata": {
    "system": true,
    "category": "testing",
    "canOverride": true,
    "readOnly": true,
    "author": "Maestro Team",
    "documentation": "docs/guides/SYSTEM-BLOCKS-GUIDE.md",
    "overrideInstructions": "Clone this tool to customize testing workflow."
  }
}
```

---

## Part 2: Knowledge Base (JSON Layer)

### Purpose

The Knowledge Base is the **source of truth** for all structured data in Maestro:

- Model test results
- Workflow execution logs
- Agent performance metrics
- Architecture decisions

### Structure

```
docs/knowledge-base/
├── _schemas/                           JSON Schemas
│   ├── model-test-result.schema.json
│   ├── run-log.schema.json
│   └── document-envelope.schema.json
│
├── models/                             Model test results
│   ├── _index.json                     Collection index
│   ├── smollm2-1.7b.json
│   └── deepseek-r1-1.5b.json
│
├── model-test-runs/                    Individual test runs
│   ├── _index.json
│   └── smollm2-1.7b-20260202-143052.json
│
├── runs/                               Workflow/agent execution logs
│   ├── _index.json
│   └── run-001.json
│
└── agents/                             Agent documentation
    ├── _index.json
    └── autonomous-programmer.json
```

### Document Envelope

Every document is wrapped in an envelope with metadata:

```json
{
  "$schema": "../_schemas/document-envelope.schema.json",

  "id": "smollm2-1.7b-20260202-143052",
  "collection": "model-test-runs",
  "title": "SmolLM2-1.7B Test Results",

  "createdAt": "2026-02-02T14:30:52Z",
  "updatedAt": "2026-02-02T14:30:52Z",
  "version": 1,

  "linkedRunId": "run-005",
  "tags": ["model-test", "smollm2", "tool-calling"],

  "schemaRef": "_schemas/model-test-result.schema.json",

  "docStatus": "pending",
  "docPath": null,
  "docGeneratedAt": null,

  "document": {
    "meta": { ... },
    "model": { ... },
    "summary": { ... },
    "categories": { ... }
  }
}
```

### Document Status Flow

```
┌──────────┐     Store      ┌──────────┐    Generate    ┌───────────┐
│  (new)   │ ───────────► │ pending  │ ─────────────► │ generated │
└──────────┘               └──────────┘                └───────────┘
                                                              │
                                                              │ Source updated
                                                              ▼
                                                       ┌───────────┐
                                                       │ outdated  │
                                                       └───────────┘
                                                              │
                                                              │ Regenerate
                                                              ▼
                                                       ┌───────────┐
                                                       │ generated │
                                                       └───────────┘
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/knowledge-base/collections` | List all collections |
| GET | `/api/knowledge-base/{collection}` | List documents in collection |
| GET | `/api/knowledge-base/{collection}/{id}` | Get document |
| POST | `/api/knowledge-base/{collection}` | Store document |
| PUT | `/api/knowledge-base/{collection}/{id}` | Update document |
| DELETE | `/api/knowledge-base/{collection}/{id}` | Delete document |
| GET | `/api/knowledge-base/search?q=query` | Search across collections |
| GET | `/api/knowledge-base/pending` | Get docs with status "pending" |

---

## Part 3: Documentation Session (Docs Session)

### Purpose

A new session type dedicated to generating and maintaining documentation from Knowledge Base data.

### Session Type Definition

Following the pattern from `GUIDE-SESSION-TYPES.md`:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       DOCS SESSION SERVER                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Context: Documentation folder (docs/)                                   │
│  Authority: Human / AI / documentation-agent                            │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    QUEUE MANAGEMENT                               │   │
│  │                                                                   │   │
│  │  • pending              List items awaiting documentation         │   │
│  │  • show <id>            Preview source data (JSON)               │   │
│  │  • outdated             List docs needing regeneration           │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    GENERATION                                     │   │
│  │                                                                   │   │
│  │  • process <id>         Generate doc for specific item           │   │
│  │  • process-all          Process all pending items                │   │
│  │  • preview <id>         Preview generated markdown               │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    MAINTENANCE                                    │   │
│  │                                                                   │   │
│  │  • rebuild              Regenerate all documentation             │   │
│  │  • index                Regenerate all index files               │   │
│  │  • validate             Check for broken links, missing docs     │   │
│  │  • stats                Show documentation statistics            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    SESSION CONTROL                                │   │
│  │                                                                   │   │
│  │  • auto on/off          Toggle automatic doc generation          │   │
│  │  • watch                Watch for new items and auto-process     │   │
│  │  • exit                 End session                               │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### CLI Commands

```bash
# Session management
maestro session create --docs --authority human
maestro session create --docs --authority agent:documentation-agent

# Quick commands (outside session)
maestro docs pending                    # List pending items
maestro docs process <document-id>      # Generate doc for one item
maestro docs process-all                # Process all pending
maestro docs rebuild                    # Regenerate everything

# Within session
session> pending
session> process smollm2-1.7b-20260202-143052
session> preview smollm2-1.7b-20260202-143052
session> index
session> exit
```

### Documentation Agent (System Block)

```json
{
  "id": "documentation-agent",
  "name": "Documentation Agent",
  "blockType": "agent",
  "version": "1.0.0",
  "description": "Agent that generates and maintains Markdown documentation from Knowledge Base data.",

  "config": {
    "model": "HuggingFaceTB/SmolLM2-1.7B-Instruct",
    "systemPrompt": "You are a documentation generator. Given structured JSON data, produce clear, well-formatted Markdown documentation...",
    "sessionType": "docs"
  },

  "tools": [
    { "blockRef": "system/documentation/read-knowledge-base" },
    { "blockRef": "system/documentation/write-markdown" },
    { "blockRef": "system/documentation/update-doc-status" },
    { "blockRef": "system/documentation/generate-index" }
  ],

  "metadata": {
    "system": true,
    "category": "documentation",
    "canOverride": true
  }
}
```

---

## Part 4: Generated Documentation (Markdown Layer)

### Structure

```
docs/
├── models/
│   ├── index.md                    # Auto-generated index of all models
│   ├── smollm2-1.7b.md            # Generated from knowledge-base/models/
│   ├── deepseek-r1-1.5b.md
│   └── _template.md               # Template for generation
│
├── agents/
│   ├── index.md
│   ├── autonomous-programmer.md
│   └── _template.md
│
├── runs/
│   ├── index.md                   # Index of recent runs
│   ├── RUN-001.md
│   └── _template.md
│
└── knowledge-base/                # JSON source (Layer 2)
    └── ...
```

### Generated Document Example

```markdown
# SmolLM2-1.7B-Instruct

> Auto-generated from Knowledge Base on 2026-02-02

## Overview

| Property | Value |
|----------|-------|
| **Model ID** | HuggingFaceTB/SmolLM2-1.7B-Instruct |
| **Provider** | HuggingFace |
| **Parameters** | 1.7B |
| **Last Tested** | 2026-02-02 14:30 |

## Test Summary

| Metric | Score |
|--------|-------|
| **Total Score** | 32/190 (17%) |
| **Classification** | Insufficient |
| **Passed Tests** | 6 |
| **Failed Tests** | 13 |

## Capabilities

| Capability | Status | Confidence | Quality |
|------------|--------|------------|---------|
| Tool Calling | ✅ Supported | 95% | Excellent |
| JSON Output | ✅ Supported | 85% | Good |
| Reasoning | ❌ Not Supported | 20% | Poor |

## Recommendations

### Best Use Cases
- Simple tool calling tasks
- Structured JSON output

### Avoid For
- Complex reasoning
- Multi-step planning
- Code generation

## Test History

| Date | Score | Classification |
|------|-------|----------------|
| 2026-02-02 | 32/190 (17%) | Insufficient |
| 2026-02-01 | 30/190 (16%) | Insufficient |

---

*Source: [knowledge-base/models/smollm2-1.7b.json](../knowledge-base/models/smollm2-1.7b.json)*
*Generated by: documentation-agent v1.0.0*
```

### Linking Back to Source

Every generated markdown includes:
1. Header indicating it's auto-generated
2. Link to the source JSON in Knowledge Base
3. Generator version for reproducibility

---

## Part 5: Frontend Integration

### Model Detail Page Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    ModelDetailPage Component                             │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Tab: "Capability Tests"                                          │   │
│  │                                                                   │   │
│  │  ┌─────────────┐  ┌─────────────┐                                │   │
│  │  │  Provider   │  │  Test Runs  │  ← Tabs                        │   │
│  │  └─────────────┘  └─────────────┘                                │   │
│  │                                                                   │   │
│  │  [Run New Test]  ← Button triggers system block                  │   │
│  │       │                                                           │   │
│  │       ▼                                                           │   │
│  │  POST /api/blocks/execute                                        │   │
│  │  { blockId: "model-capability-tester", inputs: { modelId } }     │   │
│  │       │                                                           │   │
│  │       ▼                                                           │   │
│  │  Results stored in Knowledge Base                                │   │
│  │       │                                                           │   │
│  │       ▼                                                           │   │
│  │  Component refreshes via GET /api/knowledge-base/models/{id}/runs│   │
│  │                                                                   │   │
│  │  ┌───────────────────────────────────────────────────────────┐   │   │
│  │  │  Test Run: 2026-02-02 14:30                                │   │   │
│  │  │  Score: 32/190 (17%) - Insufficient                       │   │   │
│  │  │  ✅ 6 passed  ❌ 13 failed                                 │   │   │
│  │  │                                                            │   │   │
│  │  │  [View Details]  [View Documentation] ← Links to markdown │   │   │
│  │  └───────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### API Integration

```typescript
// Frontend: Trigger test via system block
const handleRunTests = async () => {
  const response = await fetch(`${API_BASE}/api/blocks/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      blockId: 'model-capability-tester',  // System block
      inputs: { modelId, categories: 'all', includeAnalysis: true }
    })
  });

  if (response.ok) {
    // Refresh test runs list
    await fetchTestRuns();
  }
};

// Frontend: Fetch test results from Knowledge Base
const fetchTestRuns = async () => {
  const response = await fetch(
    `${API_BASE}/api/knowledge-base/models/${documentId}/runs`
  );
  const data = await response.json();
  setTestRunsData(data);
};

// Frontend: Link to generated documentation
const viewDocumentation = (runId: string) => {
  window.open(`/docs/models/${modelId}.md`, '_blank');
};
```

---

## Consequences

### Positive

1. **Transparency**: Users can see and understand system internals
2. **Flexibility**: Override pattern allows customization without breaking
3. **Separation of Concerns**: JSON for data, Markdown for documentation
4. **Async Processing**: Documentation generation doesn't block execution
5. **Consistency**: Same pattern for testing, evaluation, and documentation
6. **Versioning**: Both JSON and Markdown are git-trackable

### Negative

1. **Complexity**: Three-layer architecture adds cognitive overhead
2. **Duplication**: Data exists in both JSON and Markdown forms
3. **Sync Issues**: Markdown can become outdated if regeneration fails
4. **Storage**: More disk space for redundant data

### Mitigations

- Clear documentation and guides for the architecture
- `docStatus` field ensures we know when regeneration is needed
- Automated validation to detect sync issues
- Cleanup tools to remove orphaned documentation

---

## Implementation Phases

### Phase 1: System Blocks Foundation ✅
- [x] Add `system` metadata field to block schema
- [x] Implement override resolution in BlockDiscoveryService
- [x] Add "System" section to Foundry UI
- [x] Implement "Clone to Override" action

### Phase 2: Knowledge Base Enhancement ✅
- [x] Add `docStatus` and `docPath` fields to DocumentEnvelope
- [x] Add `/api/knowledge-base/pending` endpoint
- [x] Add `/api/knowledge-base/outdated` endpoint
- [x] Add `/api/knowledge-base/docs/stats` endpoint

### Phase 3: Docs Session ✅
- [x] Create documentation system blocks (documentation-agent, generate-model-doc, generate-index, fetch-pending-docs)
- [x] Create Handlebars templates for documentation generation
- [x] Add CLI commands for docs management (`maestro docs`)
- [x] Update system blocks README

### Phase 4: Frontend Integration ✅
- [x] Connect "Run Tests" button to block execution API
- [x] Display System Blocks section in Foundry sidebar
- [x] Add system block cards with Clone functionality
- [x] Add doc status indicators (Knowledge Base endpoints)

---

## Related Documents

- [ADR-0001: Model-Agnostic Design](0001-model-agnostic-design.md)
- [GUIDE-SESSION-TYPES.md](../guides/GUIDE-SESSION-TYPES.md)
- [MAESTRO-PHILOSOPHY.md](../MAESTRO-PHILOSOPHY.md)
- [Knowledge Base Schemas](../knowledge-base/_schemas/)

---

## Status History

- 2026-02-02: Accepted
- 2026-02-02: All phases implemented
