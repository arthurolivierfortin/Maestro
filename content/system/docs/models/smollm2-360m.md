---
modelId: "HuggingFaceTB/SmolLM2-360M-Instruct"
displayName: "SmolLM2 360M Instruct"
category: "small-language-model"
parameters: "360M"
requirements:
  vram: "~1GB"
  ram: "~2GB"
bestFor:
  - lightweight-tasks
  - basic-instruction-following
avoidFor:
  - json-generation
  - structured-output
  - code-generation
fitnessRange: [0.50, 0.70]
lastTested: "2026-02-10"
status: "active"
---

## Overview

SmolLM2-360M-Instruct is a lightweight variant of the SmolLM2 family. It functions and can follow basic instructions, but its output quality is significantly lower than the 1.7B variant. With fitness scores ranging from 0.50 to 0.70, it is not recommended for production Maestro workflows that require structured output or JSON generation.

Its primary value is in resource-constrained environments where VRAM is extremely limited, or as a baseline for comparison in model evaluation experiments.

## Capabilities

- **Basic Instruction Following**: Can follow simple, single-step instructions with moderate reliability.
- **Low Resource Usage**: Requires only ~1GB VRAM, making it suitable for machines without dedicated GPU or with minimal GPU memory.

### Limitations

- **Structured Output**: Frequently produces malformed JSON or omits required fields. Not reliable for structured data generation.
- **Complex Instructions**: Cannot reliably handle multi-step instructions or nuanced prompt engineering techniques that work with the 1.7B variant.
- **Fitness Ceiling**: Even with optimized prompts and few-shot examples, fitness rarely exceeds 0.70.

## Recommended Configuration

### Temperature Settings

| Task Type    | Temperature | Rationale                                   |
|--------------|-------------|---------------------------------------------|
| Creation     | 0.2         | Very low to maximize output validity        |
| Optimization | 0.3         | Minimal exploration given limited capability |

### Prompt Engineering

1. **Keep instructions extremely simple**: Single-action, single-output instructions only.
2. **Provide complete examples**: The model benefits heavily from seeing the exact expected output format.
3. **Limit output length**: Request short outputs (under 200 tokens) for best results.

## Known Issues

1. **Inconsistent JSON output**: The model frequently produces JSON with missing closing brackets, extra commas, or incorrect types. Post-processing validation is essential.
2. **Lower capability ceiling**: No amount of prompt engineering can reliably bring fitness above 0.70 for structured output tasks. Use the 1.7B variant when quality matters.
3. **Instruction drift**: On longer prompts, the model tends to lose track of earlier instructions and produce output that only addresses the last portion of the prompt.
