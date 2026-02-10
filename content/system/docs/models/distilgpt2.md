---
modelId: "distilgpt2"
displayName: "DistilGPT-2"
category: "text-generation-model"
parameters: "82M"
requirements:
  vram: "<1GB"
  ram: "~2GB"
bestFor:
  - text-generation-only
  - baseline-testing
avoidFor:
  - json-generation
  - structured-output
  - instruction-following
  - code-generation
fitnessRange: [0.20, 0.30]
lastTested: "2026-02-10"
status: "warning"
---

## Overview

DistilGPT-2 is a distilled version of GPT-2 with only 82M parameters. It is the smallest model tested in the Maestro ecosystem. It **cannot follow instructions** and produces only unstructured text completions. With a fitness score of approximately 0.25, it is not viable for any Maestro workflow that requires structured output, JSON generation, or instruction following.

Its only legitimate use is as a baseline reference point in model evaluation experiments, to establish the minimum performance floor.

## Capabilities

- **Text Completion**: Can produce coherent text continuations of a given prompt, in a pure autoregressive fashion.
- **Minimal Resources**: Requires less than 1GB VRAM, runs on virtually any hardware.

### Limitations

- **Cannot Follow Instructions**: This is a base text generation model, not an instruction-tuned model. It ignores system prompts, formatting directives, and output structure requirements entirely.
- **No Structured Output**: Produces free-form text regardless of prompt. JSON, code, or any structured format is not achievable.
- **0.25 Fitness**: Achieves approximately 0.25 fitness on standard Maestro evaluation criteria. This is well below the minimum viable threshold for any production workflow.

## Recommended Configuration

**Do not use this model in production workflows.** It is suitable only for baseline testing and model comparison experiments.

If used for baseline testing:

```json
{
  "model": "distilgpt2",
  "temperature": 0.7,
  "maxTokens": 256,
  "systemPrompt": ""
}
```

Note: The system prompt is empty because the model does not process instruction-style prompts.

## Known Issues

1. **Instruction blindness**: The model does not understand or follow instructions. Any system prompt or user instruction is treated as text to continue, not as a directive to follow. This is by design -- DistilGPT-2 is not instruction-tuned.
2. **Misleading output**: The model may occasionally produce text that looks like structured output (e.g., something resembling JSON) purely by chance from its training data. This should not be interpreted as capability -- it is not reliable or reproducible.
3. **Not viable for Maestro**: With 0.25 fitness, this model fails every quality gate in standard Maestro workflows. It should never appear in production session templates.

> **WARNING**: This model cannot follow instructions and achieves only 0.25 fitness. It is not viable for any Maestro workflow requiring structured output. Use only as a baseline reference in model evaluation experiments.
