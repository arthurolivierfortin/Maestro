# Current Pipeline: What Works Today

This document describes the **actual working pipeline** for creating and using blocks in Maestro. For the full vision with auto-evaluation and improvement suggestions, see [full-pipeline.md](full-pipeline.md).

---

## The Pipeline

```
1. CREATE BLOCK    →  Write block JSON + system prompt / script
2. TEST            →  Run in a session, iterate prompts and models
3. PUBLISH         →  Submit for approval
4. APPROVE         →  Review and approve → published to catalog
5. USE             →  Reference in project sessions / workflows
```

---

## Step 1: Create a Block

Create a `.block.json` file and optionally a `system-prompt.md`:

```bash
# Example: create a tool block
mkdir content/system/blocks/tools/my-tool
```

**my-tool.tool.block.json**:
```json
{
  "id": "my-tool",
  "name": "My Tool",
  "blockType": "tool",
  "version": "1.0.0",
  "isAtomic": true,
  "description": "Does something useful",
  "inputs": [
    { "id": "data", "type": "string", "required": true }
  ],
  "outputs": [
    { "id": "content", "type": "string" }
  ],
  "config": {
    "toolType": "script",
    "runtime": "node",
    "scriptFile": "run.js"
  }
}
```

For agent/inference blocks, add a `system-prompt.md` file or set `config.systemPrompt`.

---

## Step 2: Test the Block

### Direct execution (quick test, no session context)

```bash
cd maestro-cli
node index.js run my-tool --input data="test input"
```

### In a session (with monitoring)

```bash
# 1. Create a session
node index.js session create --type project --name "Testing my-tool" --repo C:\my-project --start

# 2. Open monitor
powershell.exe -Command "Start-Process powershell -ArgumentList '-NoExit','-Command','cd C:\Meastro\maestro-cli; node index.js monitor <session-id>'"

# 3. Invoke
node index.js session invoke <session-id> <entry-point>
```

### Iterate

If the output isn't good enough:
- **Change the prompt** in `system-prompt.md` or `config.systemPrompt`
- **Switch models** — try at least 2-3 models before concluding a block doesn't work
- **Adjust inputs** — add more context, be more specific
- **Add validation** — use `json-validator` to catch malformed outputs

---

## Step 3: Publish (Submit for Approval)

When you're satisfied with the block's quality:

```bash
# Submit the block for approval
# The block must pass quality gates: has a name, version, and content
node index.js block publish my-tool
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
  "blockRef": "my-tool",
  "inputs": { "data": "{{previousOutput}}" }
}
```

---

## Provenance Tracking

When publishing, you can attach provenance metadata:

```bash
node index.js block publish my-tool \
  --metadata '{"sourceSessionId":"abc123","workspaceId":"def456","modelUsed":"claude-sonnet","trainingIterations":7,"finalFitness":0.95}'
```

This creates a provenance record in the manifest linking the published block back to its development session, workspace, and training metrics.

---

## What's NOT Available Yet

The following features from the [full pipeline vision](full-pipeline.md) are not implemented:

| Feature | Status |
|---------|--------|
| `foundry draft create/edit/show/ready` | Not implemented |
| Auto-evaluation with scoring | Not implemented |
| Improvement suggestion system | Not implemented |
| Session comparison (`compare`) | Not implemented |
| Version auto-increment | Not implemented |
| Parallel training iterations | Not implemented |

These are planned for future phases. The current pipeline is simpler but fully functional for creating, testing, and publishing blocks.
