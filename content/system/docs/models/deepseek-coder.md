---
modelId: "deepseek-ai/deepseek-coder-1.3b-instruct"
displayName: "DeepSeek Coder 1.3B Instruct"
category: "code-generation-model"
parameters: "1.3B"
requirements:
  vram: "~3GB"
  ram: "~6GB"
bestFor: []
avoidFor:
  - all-tasks
fitnessRange: [0.00, 0.00]
lastTested: "2026-02-10"
status: "non-functional"
---

## Overview

DeepSeek Coder 1.3B Instruct is a code-focused small language model. It is **non-functional** in the Maestro ecosystem due to a persistent CUDA device error that prevents inference. Do not use this model.

## Capabilities

This model cannot be evaluated because it fails to load on the LLM Provider.

## Recommended Configuration

**Do not configure this model.** It will cause runtime errors in any workflow that attempts to use it.

## Known Issues

1. **CUDA device error**: The model triggers a CUDA device error during loading or inference on the Maestro LLM Provider. This error is reproducible and has not been resolved. The root cause is likely a compatibility issue between the model's tensor format and the inference runtime.
2. **No workaround**: There is no known workaround. Use Qwen2.5-Coder-1.5B-Instruct for code generation tasks instead.
3. **Status**: Non-functional. Do not include in session configurations or compliance test matrices. If this model appears in a session template, it will cause the workflow to fail with an `error` status on the inference node.

> **WARNING**: Including this model in a session configuration will cause workflow failures. The LLM Provider will return an error, and the execution tree will show the inference node in `error` status. There is no fallback -- per Maestro philosophy, errors are errors.
