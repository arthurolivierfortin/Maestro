# Patterns for Phase 29 — Discovered During Multi-Tier Optimization

> Written after Phase 28-C implementation. Input for Phase 29-A (Adaptation) and 29-B (Optimization).

---

## 1. The Tier Optimization Process

### What We Did (Manual Process)

For each tier (1→5), we:

1. **Started from the previous tier** — cloned the block JSON
2. **Identified substitution candidates** — which sub-blocks could use a cheaper model?
3. **Applied model downgrades** — changed model assignments in config.nodes inputs
4. **Adjusted timeouts** — local models are slower, increased wallClockTimeoutSeconds
5. **Preserved the workflow** — config.nodes structure stays identical, only model inputs change
6. **Embedded the manifest** — model requirements, substitutes, quality targets

### Key Insight: Model Substitution is Mechanical

The optimization is NOT about changing prompts, architecture, or flow. It's purely about **swapping model assignments** in the config.nodes inputs. The workflow structure is invariant across tiers.

This means the optimization process is **highly automatable**:
```
for each sub-block in workflow.config.nodes:
  for each candidate_model in cheaper_models:
    test sub-block with candidate_model
    measure fitness
    if fitness >= tier_threshold:
      accept substitution
      break
```

### What Changes Between Tiers

| Aspect | Changes? | How? |
|--------|----------|------|
| Block IDs | No | Same sub-blocks |
| Config.nodes structure | No | Same workflow |
| Config.nodes.inputs.model | **Yes** | Model assignment per node |
| wallClockTimeoutSeconds | Yes | Increased for slower models |
| metadata.tier | Yes | Tier number |
| metadata.qualityTarget | Yes | Threshold |
| metadata.manifest | Yes | Model requirements and substitutes |

### What Does NOT Change

- System prompts
- Block types
- Input/output schemas
- State manager configuration
- Interaction agent configuration
- Conditional logic

---

## 2. Model Hierarchy (Validated)

### Capability Tiers

```
Tier S: claude-opus          — Best quality, highest cost
Tier A: claude-sonnet        — Very good, expensive
Tier B: claude-haiku         — Good, moderate cost
Tier C: Qwen2.5-Coder-1.5B  — Local, free, follows tool protocol
Tier D: SmolLM2-1.7B        — Local, free, simple inference only (NO agents)
Tier F: distilgpt2           — Cannot follow instructions
```

### Critical Constraint

**SmolLM2-1.7B-Instruct CANNOT be used for agent blocks.** It does not follow the tool-call protocol. Only use for simple inference (single LLM call, no tools).

**Qwen2.5-Coder-1.5B-Instruct IS the only viable local model for agents.** It follows the step-by-step tool-call protocol when prompted correctly (few-shot, explicit JSON format).

### Substitution Rules

| Task Type | Minimum Model | Rationale |
|-----------|--------------|-----------|
| Code generation (multi-file) | claude-haiku | Needs understanding of code structure |
| Code review | claude-haiku | Needs judgment about correctness |
| Task planning | claude-haiku | Needs understanding of requirements |
| Context analysis | Qwen2.5-Coder-1.5B | File reading + summarization |
| Test execution | Qwen2.5-Coder-1.5B | Shell commands + result parsing |
| Git operations | Qwen2.5-Coder-1.5B | Formulaic commands |
| Commit messages | Qwen2.5-Coder-1.5B | Text formatting |

---

## 3. Evaluation Criteria Discovered

### Per-Block Evaluation

| Sub-Block | Evaluation Criteria | Heuristic? | LLM-Required? |
|-----------|-------------------|------------|----------------|
| project-preparer | JSON structure valid, has required fields | Yes | No |
| context-analyzer | JSON valid, has fileList and patterns | Yes | No |
| task-planner | JSON valid, has steps array, each step has id/action/target | Yes | No |
| code-implementer | Files written, no syntax errors (tsc --noEmit) | Yes | No |
| test-executor | Tests run, results parsed, pass/fail counts | Yes | No |
| code-reviewer | Score is number 0-1, has issues array | Yes | No |
| git-committer | Commit created, has hash | Yes | No |

### Key Finding: Most Evaluation is Heuristic

**7 out of 7 sub-blocks can be evaluated with heuristic criteria** (JSON validation, field checking, command success). No LLM-based evaluation is needed for the basic quality gate.

This means Phase 29-A can start with a **heuristic-only evaluator** and still be useful.

### When LLM Evaluation IS Needed

- **Semantic quality**: "Is this commit message meaningful?" (not just "is it a string?")
- **Code correctness**: "Does this implementation actually solve the task?" (beyond syntax check)
- **Review accuracy**: "Are the identified issues real?" (not just "is the score a number?")

These are **level 2** evaluations — nice to have, but not blocking for the optimization workflow.

---

## 4. The Manifest Structure (Canonical)

Every published block SHOULD have a `metadata.manifest` with this structure:

```json
{
  "manifest": {
    "version": "1.0",
    "publishedAt": "ISO-8601",
    "requirements": {
      "models": [
        {
          "id": "model-name",
          "usedBy": ["block-id-1", "block-id-2"],
          "substitutable": true|false,
          "reason": "why not substitutable (if false)",
          "testedSubstitutes": [
            { "model": "other-model", "viable": true|false, "notes": "..." }
          ]
        }
      ]
    },
    "fitness": {
      "overall": 0.95,
      "qualityTarget": 0.90,
      "perBlock": {
        "block-id": { "model": "model-name", "fitness": 0.92 }
      }
    },
    "evaluationCriteria": {
      "block-id": ["hasJsonStructure", "hasRequiredFields"]
    },
    "limitations": ["text description of known limitations"]
  }
}
```

### Manifest Usage

| Consumer | Uses | For |
|----------|------|-----|
| `maestro check` | requirements.models | Show model availability |
| `maestro tiers` | full manifest | Compare tiers |
| `maestro adapt` (29-A) | requirements.models + testedSubstitutes | Skip already-tested substitutions |
| `maestro optimize` (29-B) | evaluationCriteria + fitness.perBlock | Know what to optimize and how to measure |

---

## 5. Automation Opportunities for Phase 29

### Phase 29-A: `maestro adapt`

The adaptation workflow should:

1. Read the manifest from the source block
2. Detect available models
3. For each sub-block with a missing model:
   a. Check `testedSubstitutes` first — skip if already tested
   b. Try the next cheaper available model
   c. Run heuristic evaluation
   d. If passes → accept, if fails → try next
4. Produce a new tier variant with updated model assignments

**Input**: block ID + available models
**Output**: adapted block JSON with new model assignments

### Phase 29-B: `maestro optimize`

The optimization workflow should:

1. Read the block and its manifest
2. Identify optimization strategies:
   - **model-downgrade**: Same prompt, cheaper model
   - **prompt-refinement**: Better prompt for the same model (few-shot, clearer instructions)
   - **temperature-tuning**: Adjust temperature for better fitness
3. For each strategy, for each sub-block:
   a. Apply the strategy
   b. Run evaluation (heuristic first, LLM if needed)
   c. Compare fitness
   d. Accept if improved
4. Produce an optimized variant

**Recursive mode** (`--recursive`): Optimize each sub-block, then re-test the whole workflow.

### Evaluator Architecture

Three levels, implemented as blocks:

| Level | Block Type | Cost | Accuracy | Use Case |
|-------|-----------|------|----------|----------|
| 1 — Heuristic | tool | Free | Medium | JSON validation, field checking, command success |
| 2 — Local LLM | inference | Free | Good | Semantic quality with Qwen2.5-Coder |
| 3 — Cloud LLM | inference | $ | Best | Full quality assessment with Claude |

Phase 29-A should implement levels 1 and 2. Level 3 is a stub for Phase 30 (cloud service).

---

## 6. Repeatable Process Template

This is the exact process that Phase 29-B should automate:

```
INPUT: source_block, target_quality, available_models

1. BASELINE
   - Execute source_block with test input
   - Measure quality per sub-block
   - Record as baseline

2. FOR EACH sub-block (ordered by criticality, least critical first):
   a. Identify current model
   b. FOR EACH cheaper model (from cheapest up):
      - Clone the block, swap model for this sub-block
      - Execute with same test input
      - Measure quality
      - IF quality >= target_quality:
        - Accept substitution
        - Update manifest with tested substitute
        - BREAK
      - ELSE:
        - Record as failed substitute in manifest
        - CONTINUE

3. INTEGRATION TEST
   - Execute the full workflow with all accepted substitutions
   - Measure overall quality
   - IF overall quality >= target_quality:
     - Publish as new tier
   - ELSE:
     - Revert the last substitution
     - Retry integration test

4. MANIFEST
   - Generate manifest with all tested substitutes
   - Embed in published block metadata

OUTPUT: optimized_block, manifest, comparative_report
```

---

## 7. Summary of Artifacts Created in Phase 28-C

| Artifact | Path | Purpose |
|----------|------|---------|
| Tier 1 (base) | `agents/autonomous-dev-v3/` | Reference quality — all Claude Sonnet |
| Tier 2 | `agents/autonomous-dev-v3-tier2/` | Haiku for simple tasks, Sonnet for critical |
| Tier 3 | `agents/autonomous-dev-v3-tier3/` | Sonnet for code only, Haiku + local for rest |
| Tier 4 | `agents/autonomous-dev-v3-tier4/` | Haiku for code, local for everything else |
| Tier 5 | `agents/autonomous-dev-v3-tier5/` | 100% local (Qwen2.5-Coder) |
| Manifest generator | `tools/manifest-generator/` | Generates publication manifests |
| generate-manifest.js | `blocks/scripts/generate-manifest.js` | Script for manifest generation |
| Tier selector | `shared/utils/tier-selector.ts` | Detect models → recommend tier |
| `maestro tiers` | CLI command in `cli.ts` | Show tier comparison report |
| `maestro check` (updated) | CLI command in `cli.ts` | Manifest-aware model checking |
| PATTERNS-FOR-PHASE-29.md | This document | Input for Phase 29 automation |
