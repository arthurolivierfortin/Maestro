---
modelId: "HuggingFaceTB/SmolLM2-1.7B-Instruct"
displayName: "SmolLM2 1.7B Instruct"
category: "small-language-model"
parameters: "1.7B"
requirements:
  vram: "~4GB"
  ram: "~8GB"
bestFor:
  - json-generation
  - structured-output
  - instruction-following
avoidFor:
  - code-generation
  - long-form-text
fitnessRange: [0.85, 0.95]
lastTested: "2026-02-10"
status: "active"
---

## Overview

SmolLM2-1.7B-Instruct is the best-performing small model for JSON generation and structured output tasks within the Maestro ecosystem. It consistently achieves fitness scores between 0.85 and 0.95 on training and compliance sessions, making it the recommended default for most Maestro workflows that require structured data generation.

This model was extensively evaluated during Phase 13 research and has proven reliable across foundry-default (gen-commit) and compliance-tester session types.

## Capabilities

- **JSON Generation**: Produces well-formed JSON output reliably when given specific, concrete instructions. Handles nested objects, arrays, and typed fields.
- **Structured Output**: Follows schema constraints when the expected structure is described in the prompt. Works best when few-shot examples are provided.
- **Instruction Following**: Responds well to precise, measurable instructions (e.g., "shorten to 5 words") but struggles with abstract directives (e.g., "make compact").

### Limitations

- **Code Generation**: Not recommended for generating code. Use Qwen2.5-Coder-1.5B-Instruct instead.
- **Long-Form Text**: Output quality degrades for responses longer than approximately 500 tokens. Best used for focused, bounded outputs.
- **Abstract Instructions**: Performs poorly with vague prompts. Always use specific, quantifiable instructions.

## Recommended Configuration

### Temperature Settings

| Task Type    | Temperature | Rationale                                      |
|--------------|-------------|-------------------------------------------------|
| Creation     | 0.3         | Low temperature for deterministic, valid output |
| Optimization | 0.5         | Slightly higher to explore variations           |

### Prompt Engineering

1. **Use specific prompts over abstract ones**: "Shorten the description to 5 words" achieves 39% success vs 0% for "make compact". Always quantify the desired change.
2. **Include few-shot examples**: Providing 1-2 examples of the expected output format in the system prompt is the single most powerful lever for improving output quality.
3. **Include `hasRequiredFields` in quality criteria**: Evaluation criteria must check for required top-level fields. Without this, fitness scores become unreliable.
4. **Keep prompts focused**: One clear objective per prompt. Avoid multi-step instructions in a single inference call.

### Example Maestro Configuration

```json
{
  "model": "HuggingFaceTB/SmolLM2-1.7B-Instruct",
  "temperature": 0.3,
  "maxTokens": 512,
  "systemPrompt": "You are a JSON generator. Output ONLY valid JSON, no prose or markdown.\n\nExample output:\n{\"title\": \"Fix login bug\", \"type\": \"fix\", \"scope\": \"auth\"}"
}
```

## Known Issues

1. **Abstract prompt failure**: When given abstract instructions like "make it better" or "optimize this", the model frequently produces no meaningful change or introduces structural errors. Always use concrete, measurable directives.
2. **`hasRequiredFields` gap**: The current quality criteria implementation only checks top-level fields, not nested arrays or objects. This means the model can pass fitness checks while missing required nested data. Enhancement tracked for future phases.
3. **Token length sensitivity**: Outputs beyond ~512 tokens may truncate or degrade in quality. Keep expected output length bounded.
