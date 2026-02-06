# Guide: Testing and Evaluation

## For Autonomous Agents (Claude Code, GPT, etc.)

---

## 1. What is Testing in Maestro?

The testing system allows evaluating the quality of **blocks** (tools, agents, workflows, tasks) according to defined criteria:
- Correctness (is the result correct?)
- Quality (is the output well-formed?)
- Efficiency (was execution efficient?)
- Reliability (does it work consistently?)

---

## 2. Testing Workflow

### Step 1: Create a Test Run

```bash
# Test any block
maestro test start <block-id> \
  --iterations 5 \
  --variant "v1" \
  --variant-desc "Initial version" \
  --evaluator manual \
  --tags "quality,baseline"
```

**Parameters:**
| Param | Description | Values |
|-------|-------------|--------|
| `--iterations` | Number of executions to evaluate | 1-20 recommended |
| `--variant` | Version identifier | "v1", "v2-optimized", etc. |
| `--evaluator` | Evaluation method | `manual`, `llm`, `heuristic` |
| `--evaluator-model` | LLM model for evaluation | Model ID if `--evaluator llm` |

### Step 2: Follow the Test Run

```bash
# List all test runs
maestro test runs

# Filter by block or status
maestro test runs --block <block-id>
maestro test runs --status awaiting_evaluation
maestro test runs --type agent

# Run details
maestro test runs <run-id>
```

### Step 3: View Pending Iterations

```bash
# Which iterations are awaiting evaluation?
maestro test pending <run-id>
```

**Example output:**
```
Pending Evaluations for run abc123:
- Iteration 1: Inputs: {"task": "..."}, Output: "..."
- Iteration 2: Inputs: {"task": "..."}, Output: "..."
- Iteration 3: Inputs: {"task": "..."}, Output: "..."
```

### Step 4: Evaluate Iterations

```bash
# Interactive evaluation (CLI asks questions)
maestro test evaluate <run-id>
```

The CLI will ask for each iteration:
- Overall score (0.0 - 1.0)
- Scores per criterion (correctness, quality, etc.)
- Score explanation
- Evaluation confidence

**Evaluation via API (for automation):**

```bash
# Via curl directly
curl -X POST http://localhost:5000/api/blocktest/runs/<run-id>/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "iterationId": "iter-123",
    "overallScore": 0.85,
    "evaluatorType": "claude-code",
    "explanation": "Generated code is correct and well-structured.",
    "confidence": 0.9,
    "criteriaScores": [
      {"name": "correctness", "score": 0.9, "comment": "Works as expected"},
      {"name": "quality", "score": 0.8, "comment": "Clean code"}
    ]
  }'
```

### Step 5: Compare Runs

```bash
# Compare multiple variants
maestro test compare <run-id-1>,<run-id-2>,<run-id-3>
```

**Example output:**
```
Comparison Results:
┌─────────┬──────────┬─────────┐
│ Run     │ Variant  │ Score   │
├─────────┼──────────┼─────────┤
│ abc123  │ v1       │ 0.72    │
│ def456  │ v2       │ 0.85    │ ← BEST
│ ghi789  │ v3       │ 0.78    │
└─────────┴──────────┴─────────┘
```

### Step 6: Submit Improvements

```bash
# Suggest improvements based on evaluation
maestro test improve <run-id> \
  --suggestions "Improve system prompt,Add input validation,Reduce temperature"
```

---

## 3. Evaluator Types

### Manual Evaluator (Human/Claude-Code)

```bash
maestro test start <block-id> --evaluator manual
```

- **Who evaluates:** You (the autonomous agent) or a human
- **Advantage:** Nuanced judgment, full context
- **Disadvantage:** Slower, requires intervention

### LLM Evaluator

```bash
maestro test start <block-id> --evaluator llm --evaluator-model deepseek
```

- **Who evaluates:** An LLM model
- **Advantage:** Automated, fast
- **Disadvantage:** May lack context

### Heuristic Evaluator

```bash
maestro test start <block-id> --evaluator heuristic
```

- **Who evaluates:** Automatic rules
- **Advantage:** Very fast, consistent
- **Disadvantage:** Limited to measurable metrics

---

## 4. Evaluation Criteria by Block Type

### For Agents

| Criterion | Description | Weight |
|-----------|-------------|--------|
| Correctness | Is the objective achieved? | 40% |
| Quality | Is the output well-formed? | 30% |
| Autonomy | Did it work without intervention? | 15% |
| Tool Usage | Did it use tools effectively? | 15% |

### For Workflows

| Criterion | Description | Weight |
|-----------|-------------|--------|
| Correctness | Are the steps correct? | 40% |
| Quality | Is the final output good? | 30% |
| Flow | Is the execution order correct? | 15% |
| Error Handling | Are errors handled? | 15% |

### For Tools

| Criterion | Description | Weight |
|-----------|-------------|--------|
| Correctness | Is the result correct? | 40% |
| Quality | Is the output well-formed? | 30% |
| Efficiency | Was execution fast? | 20% |
| Reliability | Does it work consistently? | 10% |

---

## 5. Example: Agent Evaluation by Claude Code

```bash
#!/bin/bash
# Automated evaluation script

AGENT_ID="code-developer"
RUN_ID=""

# 1. Create the test run
echo "Creating test run..."
maestro test start $AGENT_ID \
  --iterations 5 \
  --variant "baseline" \
  --evaluator manual \
  --tags "evaluation,claude-code"

# Get the run ID
RUN_ID=$(maestro test runs --block $AGENT_ID --status awaiting_evaluation | head -1 | awk '{print $1}')

echo "Run ID: $RUN_ID"

# 2. Wait for iterations to execute
sleep 30

# 3. Get pending iterations
PENDING=$(maestro test pending $RUN_ID)
echo "Pending iterations: $PENDING"

# 4. For each iteration, evaluate
# (In real life, you'll analyze outputs and give scores)
for iter_id in $(echo "$PENDING" | grep "Iteration" | awk '{print $2}'); do
  # Analyze iteration output
  # ... your analysis here ...

  # Submit evaluation
  curl -X POST "http://localhost:5000/api/blocktest/runs/$RUN_ID/evaluate" \
    -H "Content-Type: application/json" \
    -d "{
      \"iterationId\": \"$iter_id\",
      \"overallScore\": 0.8,
      \"evaluatorType\": \"claude-code\",
      \"explanation\": \"Automatic evaluation by Claude Code\",
      \"confidence\": 0.85
    }"
done

# 5. View results
maestro test runs $RUN_ID
```

---

## 6. Complete Evaluation Workflow

### Recommended Process

```
1. CREATE THE TEST
   maestro test start <block> --iterations N

2. AUTOMATIC EXECUTION
   (System executes N iterations)

3. CHECK PENDING
   maestro test pending <run-id>

4. EVALUATE EACH ITERATION
   For each output:
   - Read the input and output
   - Analyze according to criteria
   - Give a score 0.0-1.0
   - Explain the score

5. CHECK RESULTS
   maestro test runs <run-id>

6. COMPARE WITH BASELINE
   maestro test compare <run-1>,<run-2>

7. SUGGEST IMPROVEMENTS
   maestro test improve <run-id> --suggestions "..."
```

---

## 7. How to Evaluate as an Autonomous Agent

### Evaluation Checklist

For each output, check:

```
□ Correctness (40%)
  - Is the main objective achieved?
  - Are there logical errors?
  - Does the result match expectations?

□ Quality (30%)
  - Is the format correct?
  - Is the syntax valid?
  - Is the content complete?

□ Efficiency (15%)
  - Is execution time reasonable?
  - Are resources used appropriate?

□ Other Criteria (15%)
  - For agents: Autonomy, Tool Usage
  - For workflows: Flow, Error Handling
  - For tools: Reliability
```

### Scoring Scale

| Score | Meaning |
|-------|---------|
| 1.0 | Perfect, no defects |
| 0.9 | Excellent, minor defects |
| 0.8 | Very good, some improvements possible |
| 0.7 | Good, works but improvable |
| 0.6 | Acceptable, some problems |
| 0.5 | Average, significant problems |
| 0.4 | Insufficient, doesn't fulfill objective |
| 0.3 | Bad, fails on multiple criteria |
| 0.2 | Very bad, almost unusable |
| 0.1 | Total failure, doesn't work |
| 0.0 | Not evaluable, fatal error |

---

## 8. Error Handling

### Test run not found

```bash
# Check existing runs
maestro test runs

# Create a new one if needed
maestro test start <block-id>
```

### No pending iterations

```bash
# Test might not have finished executing
# Wait or check status
maestro test runs <run-id>
```

### Evaluation rejected

```bash
# Check request format
# Score must be between 0.0 and 1.0
# iterationId must match an existing iteration
```

---

## 9. Best Practices

1. **Evaluate objectively** - Don't overrate your own creations
2. **Document reasons** - The explanation is as important as the score
3. **Be consistent** - Use the same scale across evaluations
4. **Compare with baseline** - Always have a reference point
5. **Suggest improvements** - Evaluation should lead to action

---

## 10. Quick Reference Commands

```bash
# Creation and management
maestro test start <block> [options]     # Create a test run
maestro test runs                         # List all runs
maestro test runs <id>                    # Run details
maestro test pending <id>                 # Iterations to evaluate

# Evaluation
maestro test evaluate <id>                # Evaluate (interactive)

# Analysis
maestro test compare <id1>,<id2>          # Compare runs
maestro test improve <id> --suggestions   # Suggest improvements
```

---

## Related Documents

- `GUIDE-AI-MENTALITY.md` - Philosophy and mentality
- `GUIDE-AI-TRAINING-SESSIONS.md` - Training sessions
- `GUIDE-AI-CLI-REFERENCE.md` - Complete CLI reference
