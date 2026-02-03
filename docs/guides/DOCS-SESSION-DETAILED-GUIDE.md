# Guide: Docs Session

## Overview

A **Docs Session** is an interactive environment for generating and maintaining documentation from Knowledge Base data. It follows the same session architecture as Project and Foundry sessions but is specialized for documentation tasks.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│   KNOWLEDGE BASE (JSON)              DOCS SESSION              DOCS (MD) │
│   ┌─────────────────┐                                    ┌─────────────┐│
│   │ models/         │                                    │ models/     ││
│   │ ├── smollm2.json│───► pending ───► process ───►     │ ├── smollm2 ││
│   │ └── deepseek.json    items         docs              │ └── deepseek││
│   │                 │                                    │             ││
│   │ runs/           │                                    │ runs/       ││
│   │ └── run-001.json│                                    │ └── RUN-001 ││
│   └─────────────────┘                                    └─────────────┘│
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Purpose

The Docs Session provides:

1. **Queue Management**: Track which Knowledge Base items need documentation
2. **Generation**: Create Markdown from JSON data using templates or LLM
3. **Maintenance**: Keep documentation in sync with source data
4. **Indexing**: Auto-generate index pages for each collection

---

## Session Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       DOCS SESSION SERVER                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Context: Documentation folder (docs/)                                   │
│  Authority: Human / AI / documentation-agent                            │
│  Binding: docs/ directory                                                │
│                                                                          │
│  Sources (read):                                                         │
│  ├── docs/knowledge-base/models/                                         │
│  ├── docs/knowledge-base/runs/                                           │
│  ├── docs/knowledge-base/agents/                                         │
│  └── docs/knowledge-base/architecture/                                   │
│                                                                          │
│  Outputs (write):                                                        │
│  ├── docs/models/                                                        │
│  ├── docs/runs/                                                          │
│  ├── docs/agents/                                                        │
│  └── docs/architecture/                                                  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Starting a Docs Session

### Via CLI

```bash
# Create and start a docs session with human authority
maestro session create --docs --authority human
maestro session connect <session-id>

# Create with documentation-agent as authority (autonomous)
maestro session create --docs --authority agent:documentation-agent

# Quick: process all pending without creating session
maestro docs process-all
```

### Session States

| State | Description |
|-------|-------------|
| `created` | Session configured, not started |
| `running` | Active, accepting commands |
| `watching` | Auto-processing new items |
| `paused` | Temporarily suspended |
| `completed` | Finished processing |
| `stopped` | Manually stopped |

---

## Commands

### Queue Management

```bash
# List items awaiting documentation
session> pending

# Output:
# 📋 Pending Documentation (3 items)
#
# Collection: models
#   • smollm2-1.7b-20260202-143052    SmolLM2 Test Results      2 min ago
#   • deepseek-r1-20260202-150312     DeepSeek Test Results     5 min ago
#
# Collection: runs
#   • run-007                          Workflow Execution        1 hour ago

# List outdated docs (source updated after doc generation)
session> outdated

# Show details of a pending item
session> show smollm2-1.7b-20260202-143052
```

### Generation

```bash
# Generate documentation for one item
session> process smollm2-1.7b-20260202-143052

# Output:
# ✅ Generated: docs/models/smollm2-1.7b.md
# Updated docStatus: generated
# Updated docPath: docs/models/smollm2-1.7b.md

# Process all pending items
session> process-all

# Output:
# Processing 3 items...
# ✅ docs/models/smollm2-1.7b.md
# ✅ docs/models/deepseek-r1-1.5b.md
# ✅ docs/runs/RUN-007.md
#
# Done: 3/3 successful

# Preview without saving
session> preview smollm2-1.7b-20260202-143052
```

### Maintenance

```bash
# Regenerate all documentation (fresh rebuild)
session> rebuild

# Regenerate only outdated docs
session> rebuild --outdated-only

# Regenerate all index files
session> index

# Validate documentation (check links, missing docs)
session> validate

# Output:
# 🔍 Validation Results
#
# ✅ 15 documents valid
# ⚠️  2 broken links found:
#    • docs/models/gpt4.md → knowledge-base/models/gpt4.json (missing)
#    • docs/runs/RUN-003.md → ../agents/coder.md (404)
#
# ❌ 1 orphaned doc (no source):
#    • docs/models/old-model.md

# Show statistics
session> stats

# Output:
# 📊 Documentation Statistics
#
# Collection      | Source | Docs | Pending | Outdated
# ----------------|--------|------|---------|----------
# models          |     12 |   10 |       2 |        1
# runs            |     45 |   40 |       5 |        3
# agents          |      8 |    8 |       0 |        0
# architecture    |      5 |    5 |       0 |        0
# ----------------|--------|------|---------|----------
# Total           |     70 |   63 |       7 |        4
```

### Watch Mode

```bash
# Enable auto-processing of new items
session> auto on

# Output:
# 🔄 Auto-processing enabled
# Watching for new items in Knowledge Base...

# Watch and show real-time activity
session> watch

# Output:
# 👀 Watching Knowledge Base...
# [14:32:15] New item: models/qwen-7b-20260202
# [14:32:16] Processing...
# [14:32:18] ✅ Generated: docs/models/qwen-7b.md

# Disable auto-processing
session> auto off
```

### Session Control

```bash
# Pause session
session> pause

# Resume session
session> resume

# End session
session> exit
```

---

## Document Status Flow

Every Knowledge Base document has a `docStatus` field:

```
┌──────────┐     Store      ┌──────────┐    process     ┌───────────┐
│  (new)   │ ───────────► │ pending  │ ─────────────► │ generated │
└──────────┘               └──────────┘                └───────────┘
                                                              │
                                                              │ Source updated
                                                              ▼
                                                       ┌───────────┐
                                                       │ outdated  │
                                                       └───────────┘
                                                              │
                                                              │ rebuild
                                                              ▼
                                                       ┌───────────┐
                                                       │ generated │
                                                       └───────────┘
```

### Status Values

| Status | Meaning |
|--------|---------|
| `pending` | New item, no documentation generated yet |
| `generated` | Documentation exists and is current |
| `outdated` | Source updated after doc was generated |
| `error` | Generation failed (check logs) |
| `skipped` | Manually marked to skip |

---

## Templates

Documentation is generated using templates in `docs/_templates/`:

```
docs/_templates/
├── model.md.hbs           # Handlebars template for models
├── run.md.hbs             # Template for run logs
├── agent.md.hbs           # Template for agent docs
└── index.md.hbs           # Template for index pages
```

### Example Template (model.md.hbs)

```handlebars
# {{model.displayName}}

> Auto-generated on {{formatDate updatedAt}}

## Overview

| Property | Value |
|----------|-------|
| **Model ID** | {{model.id}} |
| **Provider** | {{model.provider}} |
| **Parameters** | {{model.parameters}} |
| **Last Tested** | {{formatDate meta.timestamp}} |

## Test Summary

| Metric | Score |
|--------|-------|
| **Total Score** | {{summary.totalScore}}/{{summary.maxScore}} ({{summary.percentage}}%) |
| **Classification** | {{summary.classification}} |
| **Passed Tests** | {{summary.passedTests}} |
| **Failed Tests** | {{summary.failedTests}} |

## Capabilities

| Capability | Status | Quality |
|------------|--------|---------|
{{#each capabilities}}
| {{@key}} | {{#if this.supported}}✅{{else}}❌{{/if}} | {{this.quality}} |
{{/each}}

{{#if recommendations}}
## Recommendations

### Best Use Cases
{{#each recommendations.bestUseCases}}
- {{this}}
{{/each}}

### Avoid For
{{#each recommendations.avoidFor}}
- {{this}}
{{/each}}
{{/if}}

---

*Source: [{{sourceFile}}]({{sourcePath}})*
*Generated by: documentation-agent v{{generatorVersion}}*
```

### Using LLM Instead of Templates

For more intelligent documentation, the documentation-agent can use an LLM:

```json
{
  "id": "documentation-agent",
  "config": {
    "generationMode": "llm",  // "template" or "llm"
    "model": "HuggingFaceTB/SmolLM2-1.7B-Instruct",
    "systemPrompt": "Generate clear, well-structured Markdown documentation..."
  }
}
```

---

## CLI Quick Reference

Outside a session, use `maestro docs`:

```bash
# Queue management
maestro docs pending                      # List pending items
maestro docs pending --collection models  # Filter by collection
maestro docs outdated                     # List outdated docs

# Generation
maestro docs process <document-id>        # Generate one doc
maestro docs process-all                  # Process all pending
maestro docs process-all --collection runs # Process pending in collection

# Maintenance
maestro docs rebuild                      # Regenerate all
maestro docs rebuild --outdated           # Only outdated
maestro docs index                        # Regenerate indexes
maestro docs validate                     # Check for issues
maestro docs stats                        # Show statistics

# Watch mode
maestro docs watch                        # Watch and auto-process
```

---

## Integration with Other Sessions

### After Model Testing

When a model test completes:

```
┌──────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Model Detail │     │ System Block    │     │ Knowledge Base  │
│ Page         │────►│ model-          │────►│ docStatus:      │
│ [Run Tests]  │     │ capability-     │     │ "pending"       │
└──────────────┘     │ tester          │     └────────┬────────┘
                     └─────────────────┘              │
                                                      │ Triggers
                                                      ▼
                                          ┌─────────────────────┐
                                          │ Docs Session        │
                                          │ (if auto on)        │
                                          │ generates markdown  │
                                          └─────────────────────┘
```

### After Training Evaluation

```
┌──────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Foundry      │     │ System Block    │     │ Knowledge Base  │
│ Session      │────►│ training-       │────►│ docStatus:      │
│ eval submit  │     │ evaluator       │     │ "pending"       │
└──────────────┘     └─────────────────┘     └────────┬────────┘
                                                      │
                                                      ▼
                                          ┌─────────────────────┐
                                          │ Docs Session        │
                                          │ generates agent     │
                                          │ performance report  │
                                          └─────────────────────┘
```

---

## Configuration

### Session Configuration File

Create `.maestro/docs-session.json`:

```json
{
  "autoProcess": true,
  "watchCollections": ["models", "runs", "agents"],
  "generationMode": "template",
  "templates": {
    "models": "docs/_templates/model.md.hbs",
    "runs": "docs/_templates/run.md.hbs",
    "agents": "docs/_templates/agent.md.hbs"
  },
  "outputPaths": {
    "models": "docs/models/",
    "runs": "docs/runs/",
    "agents": "docs/agents/"
  },
  "indexGeneration": true,
  "validation": {
    "checkLinks": true,
    "checkOrphans": true
  }
}
```

### Environment Variables

```bash
# Override output directory
export MAESTRO_DOCS_OUTPUT=docs/

# Override Knowledge Base path
export MAESTRO_KB_PATH=docs/knowledge-base/

# Enable verbose logging
export MAESTRO_DOCS_VERBOSE=true
```

---

## Troubleshooting

### Pending items not processing

```bash
# Check item status
maestro docs show <document-id>

# Force reprocess
maestro docs process <document-id> --force
```

### Generated docs look wrong

```bash
# Preview without saving
session> preview <document-id>

# Check template syntax
maestro docs validate-template docs/_templates/model.md.hbs
```

### Watch mode not detecting changes

```bash
# Check file watcher status
session> watch --debug

# Restart watcher
session> watch --restart
```

---

## Related Documentation

- [ADR-0004: System Blocks Architecture](../adr/0004-system-blocks-and-documentation-architecture.md)
- [GUIDE-SESSION-TYPES.md](GUIDE-SESSION-TYPES.md)
- [SYSTEM-BLOCKS-GUIDE.md](SYSTEM-BLOCKS-GUIDE.md)
- [Knowledge Base Schemas](../knowledge-base/_schemas/)
