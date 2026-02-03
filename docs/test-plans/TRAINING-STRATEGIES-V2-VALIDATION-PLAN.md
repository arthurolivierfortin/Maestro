# ARCHIVED - Training Strategies V2 Validation Plan

> **This document has been archived and replaced.**

## Reason for Archival

The original test plan referenced APIs and CLI commands that violate Maestro Philosophy V2:
- Tests for `/api/experiments` endpoints (should not exist)
- Tests for `/api/fitness` endpoints (should not exist)
- Tests for `maestro experiment` CLI commands (should use `maestro run`)

## Replacement Documents

Testing is now integrated into the implementation plan phases.

### Implementation Plan with Verification Steps
**File**: `docs/implementation/IMPLEMENTATION-PLAN-RESEARCH-WORKSPACE.md`

Each phase includes verification steps:
- Phase 1: Workspace creation via CLI
- Phase 2: Block resolution with workspace context
- Phase 3: Data store tool testing
- Phase 4: Fitness calculator verification
- Phase 5: Agent action testing
- Phase 6: Workflow loop execution
- Phase 7: UI Block rendering
- Phase 8: Complete integration test

### Correct Testing Commands

```bash
# Test workspace creation
maestro workspace create --name "Test" --path "path" --type research

# Test block execution in workspace context
maestro run data-store --workspace model-research --input action=list --input collection=experiments

# Test fitness calculation
maestro run fitness-calculator --workspace model-research --input modelId=smollm2:1.7b --input executionMetrics='{...}'

# Test experiment manager agent
maestro run experiment-manager --workspace model-research --action list

# Test full research team workflow
maestro run research-team --workspace model-research --input targetAgentId=test-agent --input taskType=code
```

## Archived Original
**File**: `docs/archive/ARCHIVED-TRAINING-STRATEGIES-V2-VALIDATION-PLAN.md`

---

*Archived on: February 3, 2026*
