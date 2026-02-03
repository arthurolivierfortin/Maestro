# Guide: System Blocks

## What are System Blocks?

**System Blocks** are the blocks that power Maestro's internal functionality. Unlike user-created blocks, they come bundled with Maestro and are used by the application itself.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│   USER CLICKS                    SYSTEM BLOCK                           │
│   "Run Test"     ─────────────►  model-capability-tester                │
│   in Frontend                    (executes automatically)               │
│                                                                          │
│   TRAINING                       SYSTEM BLOCK                           │
│   completes      ─────────────►  training-evaluator                     │
│                                  (evaluates results)                    │
│                                                                          │
│   NEW TEST                       SYSTEM BLOCK                           │
│   result stored  ─────────────►  documentation-agent                    │
│                                  (generates markdown)                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Key Properties

| Property | Description |
|----------|-------------|
| **Visible** | You can see them in Foundry (System section) |
| **Transparent** | You can inspect how they work |
| **Non-Modifiable** | You cannot edit them directly |
| **Overridable** | You can create your own version that takes priority |
| **Used by App** | Frontend and backend use these blocks |

---

## Location

System blocks live in `blocks/system/`:

```
blocks/
├── system/                         ← SYSTEM BLOCKS (read-only)
│   ├── README.md
│   │
│   ├── testing/                    Model and block testing
│   │   ├── model-capability-tester.tool.block.json
│   │   ├── run-model-tests.command.block.json
│   │   ├── analyze-test-results.inference.block.json
│   │   └── run-all-model-tests.command.block.json
│   │
│   ├── documentation/              Documentation generation
│   │   ├── documentation-agent.agent.block.json
│   │   ├── generate-model-doc.inference.block.json
│   │   └── generate-index.script.block.json
│   │
│   └── evaluation/                 Training evaluation
│       ├── training-evaluator.agent.block.json
│       └── score-calculator.script.block.json
│
├── tools/                          ← YOUR BLOCKS (read-write)
├── agents/
└── workflows/
```

---

## Viewing System Blocks

### In Foundry UI

The Foundry displays a dedicated **System** section:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           FOUNDRY                                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  📁 MY BLOCKS                                                            │
│     Your custom blocks appear here                                       │
│                                                                          │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                          │
│  🔧 SYSTEM BLOCKS                                            [Read-only] │
│     │                                                                    │
│     ├── 📂 testing/                                                      │
│     │   ├── model-capability-tester     [View] [Clone]                  │
│     │   ├── run-model-tests             [View] [Clone]                  │
│     │   └── analyze-test-results        [View] [Clone]                  │
│     │                                                                    │
│     ├── 📂 documentation/                                                │
│     │   └── documentation-agent         [View] [Clone]                  │
│     │                                                                    │
│     └── 📂 evaluation/                                                   │
│         └── training-evaluator          [View] [Clone]                  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Via CLI

```bash
# List all blocks including system
maestro blocks list --all

# List only system blocks
maestro blocks list --system

# View a system block's details
maestro blocks info model-capability-tester

# Output:
# 📄 Block Details:
#
#   ID:           model-capability-tester
#   Name:         Model Capability Tester
#   Type:         tool
#   System:       Yes (read-only)
#   Override:     blocks/tools/model-capability-tester.tool.block.json
#   ...
```

---

## Overriding System Blocks

You can customize any system block by creating your own version. Your version will be used instead of the system version.

### Step 1: Clone the Block

```bash
# Clone a system block to your blocks folder
maestro blocks clone model-capability-tester --to blocks/tools/

# Or in Foundry UI, click [Clone] button
```

This creates: `blocks/tools/model-capability-tester.tool.block.json`

### Step 2: Modify Your Copy

Edit your cloned block to customize it:

```json
{
  "id": "model-capability-tester",
  "name": "My Custom Model Tester",
  "version": "1.1.0",
  "description": "Customized model testing with extra categories",

  "children": [
    { "blockRef": "system/testing/run-model-tests" },
    { "blockRef": "system/testing/analyze-test-results" },
    { "blockRef": "my-custom-analysis" }  // Added custom step
  ]
}
```

### Step 3: Verify Override

```bash
maestro blocks info model-capability-tester

# Output shows your version is active:
#
#   ID:           model-capability-tester
#   Location:     blocks/tools/model-capability-tester.tool.block.json
#   Overrides:    blocks/system/testing/model-capability-tester.tool.block.json
```

### Resolution Order

When a block is requested, Maestro searches in this order:

| Priority | Location | Description |
|----------|----------|-------------|
| 1 (highest) | `.maestro/blocks/` | Project-specific blocks |
| 2 | `~/.maestro/blocks/` | User-global blocks |
| 3 | `blocks/` | Repository blocks |
| 4 (lowest) | `blocks/system/` | System blocks (fallback) |

**First match wins.**

---

## Common System Blocks

### model-capability-tester

**Purpose:** Test a model's capabilities and store results in Knowledge Base.

**Used by:** "Run Tests" button in Model Detail page

**Inputs:**
- `modelId` (string): HuggingFace model ID
- `categories` (string): Categories to test, or "all"
- `includeAnalysis` (boolean): Include LLM analysis

**Outputs:**
- `testResult`: Complete test results (stored in Knowledge Base)
- `summary`: Quick score summary

**Example:**
```bash
maestro blocks run model-capability-tester \
  --input modelId="HuggingFaceTB/SmolLM2-1.7B-Instruct" \
  --input categories="all"
```

### documentation-agent

**Purpose:** Generate Markdown documentation from Knowledge Base data.

**Used by:** Docs Session, automatic documentation generation

**Inputs:**
- `documentId` (string): Knowledge Base document ID
- `collection` (string): Collection name

**Outputs:**
- `markdownPath`: Path to generated markdown file
- `success`: Whether generation succeeded

### training-evaluator

**Purpose:** Evaluate training run results.

**Used by:** Foundry Session evaluation workflow

**Inputs:**
- `runId` (string): Training run ID
- `criteria` (object): Evaluation criteria

**Outputs:**
- `score`: Numeric score
- `feedback`: Detailed feedback
- `suggestions`: Improvement suggestions

---

## Why Override?

Common reasons to override system blocks:

### 1. Add Custom Test Categories

```json
{
  "id": "model-capability-tester",
  "children": [
    { "blockRef": "system/testing/run-model-tests" },
    { "blockRef": "my-domain-specific-tests" },  // Your custom tests
    { "blockRef": "system/testing/analyze-test-results" }
  ]
}
```

### 2. Change Documentation Format

```json
{
  "id": "documentation-agent",
  "config": {
    "template": "my-templates/model-doc.md",  // Custom template
    "outputFormat": "rst"  // ReStructuredText instead of Markdown
  }
}
```

### 3. Integrate External Tools

```json
{
  "id": "model-capability-tester",
  "children": [
    { "blockRef": "system/testing/run-model-tests" },
    { "blockRef": "send-to-slack" },  // Notify on completion
    { "blockRef": "upload-to-s3" }    // Backup results
  ]
}
```

### 4. Use Different LLM for Analysis

```json
{
  "id": "analyze-test-results",
  "config": {
    "model": "anthropic/claude-3-opus"  // Use Claude instead of default
  }
}
```

---

## Restoring System Defaults

If your override isn't working well, simply delete your version:

```bash
# Remove your override
rm blocks/tools/model-capability-tester.tool.block.json

# System version is now used again
maestro blocks info model-capability-tester
# Location: blocks/system/testing/model-capability-tester.tool.block.json
```

---

## Best Practices

### DO

- **View before overriding**: Understand the system block first
- **Keep the same ID**: Override must have identical ID
- **Reference system children**: Reuse parts you don't want to change
- **Version your overrides**: Track changes with version numbers
- **Document why**: Add comments explaining your customizations

### DON'T

- **Modify system folder**: Never edit `blocks/system/` directly
- **Remove required outputs**: Keep the expected interface
- **Break compatibility**: Other parts of Maestro depend on these blocks
- **Forget to test**: Verify your override works before deploying

---

## Checking for Updates

System blocks may be updated when you update Maestro. Your overrides remain unchanged.

```bash
# See if system block has been updated
maestro blocks diff model-capability-tester

# Output:
# System version: 1.2.0 (updated)
# Your override:  1.0.0
#
# Changes in system version:
# + Added new test category: multimodal
# + Improved error handling
#
# Consider updating your override to include these changes.
```

---

## Related Documentation

- [ADR-0004: System Blocks Architecture](../adr/0004-system-blocks-and-documentation-architecture.md)
- [MAESTRO-PHILOSOPHY.md](../MAESTRO-PHILOSOPHY.md)
- [Block Schema Reference](../block-schema-reference.md)
- [Knowledge Base Schemas](../knowledge-base/_schemas/)
