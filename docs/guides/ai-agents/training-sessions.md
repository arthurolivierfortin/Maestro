# Guide: Training Sessions

## For Autonomous Agents (Claude Code, GPT, etc.)

---

## 1. What is a Training Session?

A training session executes a workflow **multiple times** to:
- Collect metrics (time, tokens, cost)
- Evaluate output quality
- Identify improvement patterns
- Compare variants

---

## 2. Complete Training Workflow

### Step 1: Check the System

```bash
# REQUIRED before any training
maestro health
maestro llm
```

**If failure:** Services are not started. Use:
```powershell
powershell.exe -File C:\Meastro\scripts\dev-start.ps1
```

### Step 2: Identify the Workflow to Train

```bash
# List all available workflows
maestro workflows

# Get workflow details
maestro info <workflow-id>

# See if it's an agent or tool
maestro agents
maestro tools
```

### Step 3: Create a Training Configuration

```bash
maestro training create \
  --name "My Training" \
  --workflow <workflow-id> \
  --iterations 20 \
  --parallel 2 \
  --goal quality \
  --delay 1000 \
  --description "Optimization of workflow X" \
  --tags "optimization,test"
```

**Parameters:**
| Param | Description | Recommended Value |
|-------|-------------|-------------------|
| `--iterations` | Number of executions | 10-50 for tests, 100+ for production |
| `--parallel` | Simultaneous executions | 1-5 (based on resources) |
| `--goal` | Optimization objective | `quality`, `cost`, or `speed` |
| `--delay` | Delay between iterations (ms) | 1000-5000 |

### Step 4: List Configurations

```bash
# View all configurations
maestro training

# Configuration details
maestro training info <config-id>
```

### Step 5: Start Training

```bash
# Start with specific inputs
maestro training start <config-id> \
  --name "Run $(date +%Y%m%d)" \
  --inputs '{"task": "My task", "projectPath": "C:/sandbox"}'
```

**Important:** Inputs are passed to the workflow at each iteration.

### Step 6: Follow Progress

```bash
# List active runs
maestro training runs --status running

# Run details
maestro training run <run-id>

# Refresh every 10 seconds (Linux/Mac)
watch -n 10 'maestro training run <run-id>'

# On Windows PowerShell
while ($true) { cls; maestro training run <run-id>; Start-Sleep 10 }
```

### Step 7: Control Execution

```bash
# Pause if necessary
maestro training pause <run-id>

# Resume
maestro training resume <run-id>

# Cancel if serious problem
maestro training cancel <run-id>
```

### Step 8: Analyze Results

```bash
# Run metrics
maestro training run <run-id>

# Global metrics
maestro metrics summary --from 2026-01-01

# Metrics by workflow
maestro metrics --workflow <workflow-id>

# Agent/tool leaderboard
maestro foundry leaderboard
```

---

## 3. Complete Example: Train an Agent

```bash
#!/bin/bash
# Automated training script

# 1. Verification
maestro health || { echo "Backend not available"; exit 1; }
maestro llm || { echo "LLM not available"; exit 1; }

# 2. Identify the agent
AGENT_ID="code-developer"
maestro agents info $AGENT_ID

# 3. Metrics before
echo "=== METRICS BEFORE ==="
maestro agents metrics $AGENT_ID

# 4. Create configuration
CONFIG_NAME="train-$AGENT_ID-$(date +%s)"
maestro training create \
  --name "$CONFIG_NAME" \
  --workflow $AGENT_ID \
  --iterations 30 \
  --parallel 3 \
  --goal quality

# Get the config ID (adapt based on output format)
CONFIG_ID=$(maestro training | grep "$CONFIG_NAME" | awk '{print $1}')

# 5. Start training
maestro training start $CONFIG_ID \
  --inputs '{"task": "Add validation", "projectPath": "C:/sandbox"}'

# Get the run ID
RUN_ID=$(maestro training runs --config $CONFIG_ID --status running | head -1 | awk '{print $1}')

# 6. Wait for completion
while true; do
  STATUS=$(maestro training run $RUN_ID | grep "Status" | awk '{print $2}')
  echo "Status: $STATUS"

  if [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ] || [ "$STATUS" = "cancelled" ]; then
    break
  fi

  sleep 30
done

# 7. Metrics after
echo "=== METRICS AFTER ==="
maestro agents metrics $AGENT_ID

# 8. Final summary
echo "=== SUMMARY ==="
maestro training run $RUN_ID
```

---

## 4. Interpreting Metrics

### Run Metrics

| Metric | Description | Good if... |
|--------|-------------|------------|
| `completedIterations` | Completed iterations | = totalIterations |
| `failedIterations` | Failed iterations | < 10% of total |
| `averageScore` | Average quality score | > 0.7 |
| `averageDurationMs` | Average time | Stable or decreasing |
| `totalCost` | Total cost in tokens | Within budget |

### Score Interpretation

| Score | Meaning | Action |
|-------|---------|--------|
| 0.9 - 1.0 | Excellent | Maintain, can serve as baseline |
| 0.7 - 0.9 | Good | Minor optimization possible |
| 0.5 - 0.7 | Acceptable | Improve prompts and config |
| 0.3 - 0.5 | Insufficient | Review workflow architecture |
| 0.0 - 0.3 | Critical | Reconstruction necessary |

---

## 5. Training Patterns

### Pattern 1: Baseline then Improvement

```bash
# 1. Establish a baseline
maestro training create --name "Baseline" --workflow my-agent --iterations 20
maestro training start baseline-config

# 2. Modify the workflow (prompts, config, etc.)
# ... modifications ...

# 3. New training
maestro training create --name "V2" --workflow my-agent --iterations 20
maestro training start v2-config

# 4. Compare
maestro agents metrics my-agent
```

### Pattern 2: A/B Testing

```bash
# Version A
maestro training create --name "Version A" --workflow agent-v1 --iterations 30
maestro training start config-a

# Version B
maestro training create --name "Version B" --workflow agent-v2 --iterations 30
maestro training start config-b

# Wait for both, then compare
maestro foundry leaderboard
```

### Pattern 3: Incremental Training

```bash
# Small batch for quick validation
maestro training create --name "Quick Test" --iterations 5 --parallel 1
maestro training start quick-test-config

# If OK, medium batch
maestro training create --name "Medium Test" --iterations 30 --parallel 3
maestro training start medium-test-config

# If still OK, full batch
maestro training create --name "Full Training" --iterations 100 --parallel 5
maestro training start full-config
```

---

## 6. Error Handling

### Error: "Configuration not found"

```bash
# Verify the config exists
maestro training

# Create if needed
maestro training create --name "..." --workflow <id>
```

### Error: "Workflow not found"

```bash
# Check available workflows
maestro workflows
maestro blocks

# Use the correct ID
maestro info <workflow-id>
```

### Error: Run fails immediately

```bash
# Check the LLM
maestro llm

# Test a simple execution
maestro execute <workflow-id> --input key=value

# Check backend logs
```

### Error: Too many iterations fail

```bash
# Reduce parallelism
maestro training create --parallel 1 --iterations 5

# Increase delay
maestro training create --delay 5000
```

---

## 7. Best Practices

1. **Always start small** - 5-10 iterations first
2. **Save metrics before** - To be able to compare
3. **Use descriptive names** - "Train-AgentX-Quality-2026-01-30"
4. **Document modifications** - Note what changed between runs
5. **Don't parallelize too much** - Start with 1-2, increase if stable

---

## 8. Quick Reference Commands

```bash
# Configuration
maestro training                           # List configs
maestro training create --name X --workflow Y --iterations N
maestro training info <config-id>

# Execution
maestro training start <config-id>         # Start
maestro training runs                      # List runs
maestro training run <run-id>              # Run details
maestro training pause <run-id>            # Pause
maestro training resume <run-id>           # Resume
maestro training cancel <run-id>           # Cancel

# Metrics
maestro metrics summary                    # Global summary
maestro agents metrics <agent-id>          # Agent metrics
maestro tools metrics <tool-id>            # Tool metrics
maestro foundry leaderboard                # Top performers
```

---

## Related Documents

- `GUIDE-AI-MENTALITY.md` - Philosophy and mentality
- `GUIDE-AI-TESTING-EVALUATION.md` - Quality evaluation
- `GUIDE-AI-CLI-REFERENCE.md` - Complete CLI reference
