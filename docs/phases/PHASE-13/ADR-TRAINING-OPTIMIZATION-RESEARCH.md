# ADR: Training Session Optimization Research Results

**Date**: 2026-02-10
**Status**: Accepted
**Context**: Research workspace `training-research` with 9 experiments

## Decision

Based on systematic research across 9 experiments testing prompt design, model selection, temperature, and evaluation criteria, the following architectural decisions apply to all Maestro training sessions.

## Context

Previous gen-commit foundry sessions showed that SmolLM2-1.7B could generate valid JSON but could not optimize it. The optimization phase ran 6 iterations with zero changes. We investigated whether this was a model limitation or a prompt/evaluation design issue.

## Findings

### 1. Quality Guard is Mandatory for Optimization Phases

**Problem**: Without structural integrity checks in evaluation, models take destructive shortcuts (removing fields/arrays instead of shortening values).

**Decision**: All optimization phase evaluations MUST include `qualityCriteria` with:
- `hasJsonStructure`
- `validJsonParse`
- `hasRequiredFields`

**Impact**: `hasRequiredFields` needs enhancement to verify presence of arrays, not just top-level fields.

### 2. Prompt Design: Specific Over Abstract

**Problem**: "Make this more compact" produces zero changes. The model copies input verbatim.

**Decision**: Optimization prompts must include:
- **Concrete transformation examples** with actual input data
- **Explicit constraints** ("description values must be 2-4 words only")
- **Field-level instructions** ("shorten this field, keep that field")

Abstract instructions ("improve", "optimize", "make better") are not viable for models under 7B parameters.

### 3. Few-Shot Examples in Creation Prompts

**Decision**: Creation prompts should include a complete example of the desired output format. This shifts compression from the optimization phase into creation, reducing total iterations needed.

### 4. Recommended Temperature per Phase

| Phase | Temperature | Rationale |
|-------|------------|-----------|
| Creation | 0.3 | Reliable, structured output |
| Optimization | 0.5 | Enough variation to explore, low enough to maintain structure |
| Validation | 0.2 | Conservative, deterministic |
| Publish | 0.1 | Maximum consistency |

Temperatures above 0.7 cause field loss even with quality guards, because `hasRequiredFields` only checks top-level fields.

### 5. Model Selection

SmolLM2-1.7B-Instruct remains the recommended model for JSON generation and optimization tasks. Qwen2.5-Coder-1.5B adds unwanted code patterns (`"type": "object"`) and offers no improvement.

## Consequences

- The default `foundry-default.session.json` template should be updated with these recommendations
- `hasRequiredFields` evaluator should be enhanced to check array presence
- Future session templates must always include `qualityCriteria` in optimization phases
- Documentation should warn against abstract optimization prompts

## Research Data

Full experiment data and reports are in the training research workspace:
- **Repo**: `test-repos/training-research`
- **Workspace ID**: `3914f3ce-f9cb-4457-82e6-d00abaf28586`
- **Analysis**: `test-repos/training-research/analysis/FINDINGS.md`
