# System Blocks

> **Documentation**: [SYSTEM-BLOCKS-GUIDE.md](../../docs/guides/SYSTEM-BLOCKS-GUIDE.md)
> **Architecture**: [ADR-0004](../../docs/adr/0004-system-blocks-and-documentation-architecture.md)

## What are System Blocks?

System Blocks power Maestro's internal functionality. They are the blocks that the application uses to perform core operations like testing models, generating documentation, and evaluating training runs.

**Key Properties:**

| Property | Description |
|----------|-------------|
| **Visible** | See them in Foundry (System section) |
| **Transparent** | Inspect how they work |
| **Non-Modifiable** | Cannot edit directly in this folder |
| **Overridable** | Clone to `blocks/` to customize |
| **Used by App** | Frontend and backend execute these |

---

## Categories

### testing/

Blocks for testing and evaluating models.

| Block | Type | Description | Used By |
|-------|------|-------------|---------|
| `model-capability-tester` | tool | Complete model testing workflow | "Run Tests" button in Model Detail |
| `run-model-tests` | command | Executes test suite via PowerShell | model-capability-tester |
| `analyze-test-results` | inference | LLM analysis of test results | model-capability-tester |
| `run-all-model-tests` | command | Batch test multiple models | CLI batch testing |

### documentation/

Blocks for generating documentation from Knowledge Base.

| Block | Type | Description | Used By |
|-------|------|-------------|---------|
| `documentation-agent` | agent | Generates Markdown from JSON | Docs Session, CLI |
| `generate-model-doc` | inference | Generates model documentation | documentation-agent |
| `generate-index` | script | Generates index pages | documentation-agent |
| `fetch-pending-docs` | tool | Fetches documents needing documentation | documentation-agent |

### evaluation/ (planned)

Blocks for evaluating training runs.

| Block | Type | Description | Used By |
|-------|------|-------------|---------|
| `training-evaluator` | agent | Evaluates training iterations | Foundry Session |
| `score-calculator` | script | Computes evaluation scores | training-evaluator |

---

## Override Pattern

To customize a system block:

### 1. Clone

```bash
maestro blocks clone model-capability-tester --to blocks/tools/
```

Or in Foundry UI: click **[Clone]** button on any system block.

### 2. Modify

Edit your copy in `blocks/tools/model-capability-tester.tool.block.json`:

```json
{
  "id": "model-capability-tester",
  "version": "1.1.0",
  "children": [
    { "blockRef": "system/testing/run-model-tests" },
    { "blockRef": "my-custom-tests" },           // Added
    { "blockRef": "system/testing/analyze-test-results" }
  ]
}
```

### 3. Use

Maestro automatically uses your version:

```
blocks/
├── system/testing/model-capability-tester.tool.block.json  (v1.0 - ignored)
└── tools/model-capability-tester.tool.block.json           (v1.1 - USED)
```

---

## Resolution Order

When Maestro looks for a block, it searches in priority order:

| Priority | Location | Type |
|----------|----------|------|
| 1 (highest) | `.maestro/blocks/` | Project blocks |
| 2 | `~/.maestro/blocks/` | User blocks |
| 3 | `blocks/` | Repository blocks |
| 4 (lowest) | `blocks/system/` | System blocks |

**First match wins.**

---

## Block Metadata

System blocks include special metadata:

```json
{
  "id": "model-capability-tester",
  "metadata": {
    "system": true,           // Marks as system block
    "category": "testing",    // Category for UI grouping
    "canOverride": true,      // Can be overridden by user
    "readOnly": true,         // Cannot be edited in place
    "author": "Maestro Team",
    "documentation": "docs/guides/SYSTEM-BLOCKS-GUIDE.md",
    "overrideInstructions": "Clone to customize the testing workflow."
  }
}
```

---

## Usage Examples

### Run Model Tests (from CLI)

```bash
# Execute the model-capability-tester system block
maestro blocks run model-capability-tester \
  --input modelId="HuggingFaceTB/SmolLM2-1.7B-Instruct" \
  --input categories="all"
```

### Run Model Tests (from Frontend)

The "Run Tests" button in Model Detail page calls:

```typescript
POST /api/blocks/execute
{
  "blockId": "model-capability-tester",
  "inputs": {
    "modelId": "HuggingFaceTB/SmolLM2-1.7B-Instruct",
    "categories": "all",
    "includeAnalysis": true
  }
}
```

---

## Restoring Defaults

If your override causes issues, simply delete it:

```bash
rm blocks/tools/model-capability-tester.tool.block.json

# System version is now used again
maestro blocks info model-capability-tester
# Location: blocks/system/testing/model-capability-tester.tool.block.json
```

---

## Contributing

If you create a better version of a system block:

1. Test thoroughly
2. Document changes
3. Submit a PR with your improvements
4. If accepted, it becomes the new system default

---

## Related Documentation

- [System Blocks Guide](../../docs/guides/SYSTEM-BLOCKS-GUIDE.md)
- [ADR-0004: Architecture](../../docs/adr/0004-system-blocks-and-documentation-architecture.md)
- [Maestro Philosophy](../../docs/MAESTRO-PHILOSOPHY.md)
- [Docs Session Guide](../../docs/guides/DOCS-SESSION-DETAILED-GUIDE.md)
