# Current Pipeline: What Works Today

This document describes the **actual working pipeline** for creating and using blocks in Maestro. For the full vision with auto-evaluation and improvement suggestions, see [full-pipeline.md](full-pipeline.md).

---

## The Pipeline

```
1. CONTRACT        →  Define the role (or pick an existing one)
2. CREATE BLOCK    →  Write block JSON + system prompt, declare contract + capabilities
3. TEST            →  Generate tests with test-designer, run in a session, iterate
4. PUBLISH         →  Submit for approval
5. APPROVE         →  Review and approve → published to catalog
6. USE             →  Reference in project sessions / workflows
```

---

## Step 0: Understand Contracts

A **contract** defines a verifiable role. A **block** implements a contract. Multiple blocks can implement the same contract with different capabilities and models.

```
CONTRACT = role definition (e.g. "maestro-assistant")
  FEATURES = functional groupings with weights and minimum scores
    CAPABILITIES = atomic competences required per feature
    TESTS = concrete prompt/check pairs that verify the feature
```

Contracts live in `content/system/contracts/*.contract.json`. See [contracts.md](../../system/architecture/contracts.md) for full reference.

Existing contracts:

| Contract | Features | Tests |
|----------|----------|-------|
| `maestro-assistant` | conversation, operations, orchestration, memory | 10 |
| `test-designer` | contract-analysis, test-generation, test-quality | 7 |
| `agent-creator` | block-gen, prompt-writing, improvement, adaptation | 9 |
| `block-forge` | end-to-end, compliance, adaptation | 7 |

To create a new contract:

```bash
# Create the contract file
cat > content/system/contracts/my-contract.contract.json << 'EOF'
{
  "id": "my-contract",
  "name": "My Contract",
  "version": "1.0.0",
  "description": "What this role does",
  "requiredCapabilities": ["conversation"],
  "minimumFitness": 0.5,
  "features": {
    "core-feature": {
      "description": "The main thing this block must do",
      "requires": ["conversation"],
      "weight": 1.0,
      "minimumScore": 0.7,
      "tests": [
        {
          "id": "basic-test",
          "description": "Verifies the block does X",
          "prompt": "Do X",
          "check": { "type": "contains", "value": "expected" }
        }
      ]
    }
  },
  "scoring": { "method": "weighted-average" }
}
EOF

# Verify it's served by the API
curl http://localhost:5000/api/contracts/my-contract
```

---

## Step 1: Create a Block

Create a `.block.json` file and optionally a `system-prompt.md`. **Declare `contract` and `capabilities`** to link the block to its role definition.

```bash
mkdir content/system/blocks/agents/my-agent
```

**my-agent.agent.block.json**:
```json
{
  "id": "my-agent",
  "name": "My Agent",
  "blockType": "agent",
  "version": "1.0.0",
  "isAtomic": true,
  "description": "Does something useful",
  "contract": "my-contract",
  "capabilities": ["conversation", "structured-output"],
  "inputs": [
    { "id": "task", "type": "string", "required": true }
  ],
  "outputs": [
    { "id": "result", "type": "string" }
  ],
  "config": {
    "model": "claude-sonnet-4-6",
    "maxIterations": 10,
    "systemPromptFile": "system-prompt.md"
  }
}
```

For tool blocks, use `"blockType": "tool"` and add `config.toolType`, `config.scriptFile`, etc.

---

## Step 2: Generate and Run Tests

### Generate tests with test-designer

The `test-designer` agent reads a contract and produces a comprehensive test suite:

```bash
cd packages/maestro-cli

# 1. Create a session
node index.js session create --type project --name "Testing my-agent" --repo C:\Meastro --start

# 2. Register the test-designer as entry point
node index.js session entry-points <session-id> register run-tests test-designer

# 3. Set permissions for reading contracts
curl -X PUT http://localhost:5000/api/sessions/<session-id>/permissions \
  -H "Content-Type: application/json" \
  -d '{"allowedPaths":["C:\\Meastro\\content"]}'

# 4. Launch monitor
powershell.exe -Command "Start-Process powershell -ArgumentList '-NoExit','-Command','cd C:\Meastro\packages\maestro-cli; node index.js monitor <session-id>'"

# 5. Invoke test-designer on your contract
node index.js session invoke <session-id> run-tests \
  --input contractId=my-contract \
  --input "outputDir=C:\Meastro\content\system\test-suites"
```

Output: `content/system/test-suites/my-contract.test-suite.json` with 10-15 tests covering all features.

### Direct execution (quick test, no session context)

```bash
node index.js run my-agent --input task="test input"
```

### In a session (with monitoring)

```bash
# 1. Create a session
node index.js session create --type project --name "Testing my-agent" --repo C:\my-project --start

# 2. Register your block as entry point
node index.js session entry-points <session-id> register run-agent my-agent

# 3. Open monitor
powershell.exe -Command "Start-Process powershell -ArgumentList '-NoExit','-Command','cd C:\Meastro\packages\maestro-cli; node index.js monitor <session-id>'"

# 4. Invoke
node index.js session invoke <session-id> run-agent --input task="real task"
```

### Iterate

If the output isn't good enough:
- **Change the prompt** in `system-prompt.md` or `config.systemPrompt`
- **Switch models** — try at least 2-3 models before concluding a block doesn't work
- **Adjust inputs** — add more context, be more specific
- **Add validation** — use `json-validator` to catch malformed outputs
- **Run the test-designer again** to get fresh test coverage after prompt changes

---

## Step 3: Publish (Submit for Approval)

When you're satisfied with the block's quality:

```bash
# Submit the block for approval
node index.js block publish my-agent
```

The block enters a **pending** state. Quality gates enforce:
- Block must have a name
- Block must have a version set
- Block must have content (systemPrompt, scriptFile, or workflow nodes)

If the same block@version already exists, you'll get a version conflict error. Either increment the version or use `--force`.

---

## Step 4: Approve

```bash
# List pending approvals
node index.js approvals list

# Review and approve
node index.js approvals approve <approval-id>
```

On approval, the block is:
1. Published to `content/user/blocks/{type}/{id}/`
2. Added to the catalog index at `content/user/catalog/index.json`
3. Manifest written with fitness info, provenance, and metadata

---

## Step 5: Use in Production

Reference published blocks in workflow configs or project sessions:

```json
{
  "id": "my-workflow-node",
  "blockRef": "my-agent",
  "inputs": { "task": "{{previousOutput}}" }
}
```

---

## Provenance Tracking

When publishing, you can attach provenance metadata:

```bash
node index.js block publish my-agent \
  --metadata '{"sourceSessionId":"abc123","modelUsed":"claude-sonnet","finalFitness":0.95}'
```

This creates a provenance record in the manifest linking the published block back to its development session and training metrics.

---

## Contract and Test Artifacts

| Artifact | Location | Created by |
|----------|----------|------------|
| Contract definitions | `content/system/contracts/*.contract.json` | Human (Step 0) |
| Block definitions | `content/system/blocks/{type}/{id}/*.block.json` | Human (Step 1) |
| Generated test suites | `content/system/test-suites/{contractId}.test-suite.json` | test-designer agent (Step 2) |

**Relationship between contract tests and generated test suites:**
- Contract tests (in `*.contract.json`) are the **baseline** — the minimum tests that define the contract.
- Generated test suites (in `test-suites/`) are **comprehensive expansions** — the test-designer reads the contract and generates additional tests covering edge cases, anti-patterns, and multi-turn scenarios.
- Both use the same test format (prompt + check) and the same check types.
- A future test runner will execute both against a block to compute fitness scores.

---

## What's NOT Available Yet

| Feature | Status |
|---------|--------|
| `foundry draft create/edit/show/ready` | Not implemented |
| Auto-evaluation with scoring | Not implemented |
| **Contract test runner** (execute tests, compute fitness) | Not implemented |
| Improvement suggestion system | Not implemented |
| Session comparison (`compare`) | Not implemented |
| Version auto-increment | Not implemented |
| Parallel training iterations | Not implemented |

These are planned for future phases. The current pipeline is simpler but fully functional for creating, testing, and publishing blocks.
