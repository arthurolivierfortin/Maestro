# Guide: Maestro Mentality and Philosophy

## For Autonomous Agents (Claude Code, GPT, etc.)

---

## 1. Fundamental Principle

> **Maestro transforms every execution into a learning opportunity.**

You're not here to "execute once and leave". You're here to:
1. **Execute** the workflow
2. **Evaluate** the results
3. **Improve** the blocks
4. **Iterate** until quality objectives are met

---

## 2. The 5 Golden Rules

### Rule 1: Everything Goes Through the CLI

```bash
# ALWAYS check the system state first
maestro health
maestro llm

# ALWAYS use existing commands
maestro execute <workflow>    # NOT a custom Python script
maestro training start <cfg>  # NOT a manual loop
```

**Why?** The CLI automatically collects metrics, handles errors, and persists results.

### Rule 2: Tools Use Shell Commands

```json
// GOOD: Tool with shell command
{
  "id": "my-tool",
  "blockType": "tool",
  "config": {
    "command": "powershell",
    "args": ["-Command", "Get-ChildItem '{{path}}'"]
  }
}
```

```csharp
// BAD: Implementing in the backend
if (toolType == "myTool") {
    return HandleMyToolAsync(inputs);  // DON'T DO THIS
}
```

**Why?** Shell commands are:
- Independently testable
- Modifiable without recompilation
- Portable between systems

### Rule 3: Strict Hierarchical Composition

```
WORKFLOW (root container)
├── AGENT (orchestrates tools)
│   └── TOOL (reusable capability)
│       └── COMMAND (shell execution)
└── TASK (validated step)
    └── COMMAND (shell execution)
```

**4 composite blocks** (can contain children):
- `workflow`, `agent`, `tool`, `task`

**8 atomic blocks** (leaves, no children):
- `prompt`, `instruction`, `command`, `decision`, `validator`, `trigger`, `inference`, `script`

### Rule 4: Measure Before and After

```bash
# BEFORE modifying anything
maestro agents metrics my-agent > before.json
maestro tools metrics my-tool >> before.json

# AFTER modifications
maestro agents metrics my-agent > after.json
diff before.json after.json
```

**Why?** Without metrics, you don't know if you're improving or degrading.

### Rule 5: Sandbox First, Production Later

```bash
# 1. Create an isolated environment
maestro projects create --name "test-sandbox" --path "C:/sandbox" --runtime process

# 2. Test in the sandbox
maestro execute my-workflow --input projectPath="C:/sandbox"

# 3. ONLY after validation, use in production
```

---

## 3. The Continuous Improvement Cycle

```
     ┌─────────────────────────────────────┐
     │                                     │
     ▼                                     │
┌──────────┐                               │
│ MEASURE  │ maestro metrics / agents metrics
└────┬─────┘                               │
     │                                     │
     ▼                                     │
┌──────────┐                               │
│ EXECUTE  │ maestro execute / training start
└────┬─────┘                               │
     │                                     │
     ▼                                     │
┌──────────┐                               │
│ EVALUATE │ maestro test evaluate        │
└────┬─────┘                               │
     │                                     │
     ▼                                     │
┌──────────┐                               │
│ IMPROVE  │ Modify prompts/config        │
└────┬─────┘                               │
     │                                     │
     └─────────────────────────────────────┘
```

---

## 4. What You MUST Do

| Action | Command |
|--------|---------|
| Check the system | `maestro health && maestro llm` |
| List blocks | `maestro blocks` |
| Execute a workflow | `maestro execute <id>` |
| Start training | `maestro training start <cfg>` |
| Evaluate results | `maestro test evaluate <run-id>` |
| Check metrics | `maestro metrics summary` |

---

## 5. What You MUST NOT Do

| Forbidden | Why | Alternative |
|-----------|-----|-------------|
| Write Python code to execute | No metrics | `maestro execute` |
| Modify backend for each tool | Tight coupling | Shell commands in config |
| Ignore metrics | No measurable improvement | Always compare before/after |
| Execute on a real project without testing | Risk of corruption | Sandbox first |
| Create monolithic tools | Hard to optimize | One tool = one responsibility |

---

## 6. Checklist Before Each Session

```bash
# 1. System operational?
maestro health

# 2. LLM available?
maestro llm

# 3. Current metrics (baseline)?
maestro agents metrics <agent-id>
maestro tools metrics <tool-id>

# 4. Sandbox ready?
maestro projects  # Check that a test project exists
```

---

## 7. Questions to Ask Yourself

Before each action, ask yourself:

1. **"Should this be a Maestro block?"**
   - If you're writing custom code → probably YES

2. **"What metric does this action improve?"**
   - If none → the action might be unnecessary

3. **"How will I measure success?"**
   - Define criteria BEFORE executing

4. **"Am I testing in a sandbox?"**
   - If not → create a sandbox first

---

## 8. The Winning Mentality

```
I am not a script executor.
I am a workflow optimizer.

Every execution = learning data
Every evaluation = improvement opportunity
Every metric = guide towards quality

My goal: workflows that improve over time.
```

---

## Related Documents

- `GUIDE-AI-TRAINING-SESSIONS.md` - How to run training sessions
- `GUIDE-AI-TESTING-EVALUATION.md` - How to evaluate quality
- `GUIDE-AI-CREATING-BLOCKS.md` - How to create tools and agents
- `GUIDE-AI-CLI-REFERENCE.md` - Complete command reference
