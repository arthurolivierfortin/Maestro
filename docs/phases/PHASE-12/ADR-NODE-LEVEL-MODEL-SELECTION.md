# ADR: Node-Level Model Selection

**Status**: Accepted
**Date**: 2026-02-09
**Phase**: 12 (Runtime Hardening & CLI Agent Interface)

## Context

Maestro needs to support multiple LLM models within the same workflow. The compliance testing session, for example, must test 6 different local models by running inference blocks with each one.

The initial approach placed model selection at the **phase level** via `_workflowConfig[phase].llm.model`. This meant each phase could use one model, but all inference nodes within that phase shared the same model.

## Problem

A single workflow may contain multiple inference nodes that should each use a different model:

```json
{
  "nodes": [
    { "id": "generate-analysis", "inputs": { "model": "deepseek-r1-1.5b" } },
    { "id": "generate-code", "inputs": { "model": "qwen-coder-3b" } },
    { "id": "generate-review", "inputs": { "model": "smollm2-1.7b" } }
  ]
}
```

Phase-level model selection cannot express this. It forces one model per phase, which is architecturally limiting and violates the block-level composition principle.

## Decision

**Model selection belongs on the node (inference block instance), not on the phase.**

Each node in `config.nodes` can specify a `model` in its `inputs`. The execution engine reads this from the node's own configuration and passes it to the LLM gateway.

### Implementation

The `configNode` (JsonElement) is passed through the execution chain:

```
ExecuteConfigNodesAsync(configNode)
  -> ExecuteRegularNodeAsync(nodeId, nodeConfig)
    -> ExecuteNodeAsync(nodeId, nodeConfig)
      -> ExecuteLLMNodeAsync(nodeId, nodeConfig)
           reads inputs.model from nodeConfig
           calls SwitchModelAsync + sets LLMRequest.ModelId
```

### Workflow Block JSON

```json
{
  "config": {
    "nodes": [
      {
        "id": "generate-output",
        "blockRef": "system:inference",
        "inputs": {
          "model": "deepseek-ai/deepseek-coder-1.3b-instruct",
          "systemPrompt": "...",
          "userPrompt": "..."
        }
      }
    ]
  }
}
```

### Resolution Priority

When determining which model to use for an inference node:

1. **Node inputs** (`config.nodes[].inputs.model`) — highest priority
2. **Phase workflow config** (`_workflowConfig[phase].llm.model`) — fallback
3. **Default model** (`appsettings.json LLMProvider.DefaultModel`) — final fallback

This allows:
- Per-node model selection (most granular)
- Per-phase defaults when all nodes in a phase share a model (convenience)
- System default when no model is specified (backward compatibility)

## Rationale

### Alignment with Maestro Philosophy

- **"Everything is a block"**: The model is a property of the inference block instance, just like its prompt, temperature, and max tokens. Blocks are self-contained units with their own configuration.
- **"Specialization over generality"**: Different inference tasks may require different models. A code generation node benefits from a code-specialized model; a documentation node benefits from an instruction-following model.
- **"Infrastructure is generic, content is specific"**: The execution engine reads the model from JSON data. No C# changes are needed to use a different model — only the workflow block JSON changes.
- **Litmus test**: A new workflow using 3 different models requires ONLY JSON changes. No C# code changes.

### Why Not Phase-Level Only?

Phase-level model selection treats the model as an environment property rather than a block property. This creates an artificial constraint: if you need two models in one phase, you must split into two phases. That forces architectural decisions based on infrastructure limitations rather than logical workflow structure.

### Why Not Block Definition Level Only?

A block definition (e.g., `system:inference`) is a reusable template. The model should be configurable per-instance (in `config.nodes[].inputs`), not hardcoded in the block definition. The same inference block type can be instantiated multiple times with different models.

## Consequences

- **Positive**: Full flexibility in model selection per node, per phase, or system-wide
- **Positive**: Backward compatible — existing templates without `inputs.model` use the default
- **Positive**: Follows block composition principle — each node is self-describing
- **Negative**: Requires passing `nodeConfig` through the execution chain (minor refactor)
- **Negative**: Model switching has latency cost (loading/unloading models on GPU)

## Related

- `docs/system/design-decisions/0001-model-agnostic-design.md` — Model-agnostic gateway pattern
- `docs/phases/PHASE-12/README.md` — Phase 12 overview
- `backend/src/Maestro.Infrastructure/Sessions/EntryPointExecutor.cs` — Execution engine
- `backend/src/Maestro.Application/Interfaces/ILLMGateway.cs` — SwitchModelAsync interface
