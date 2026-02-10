---
modelId: "Qwen/Qwen2.5-Coder-1.5B-Instruct"
displayName: "Qwen2.5 Coder 1.5B Instruct"
category: "code-generation-model"
parameters: "1.5B"
requirements:
  vram: "~3GB"
  ram: "~6GB"
bestFor:
  - code-generation
avoidFor:
  - json-generation
  - structured-output
fitnessRange: [0.60, 0.80]
lastTested: "2026-02-10"
status: "active"
---

## Overview

Qwen2.5-Coder-1.5B-Instruct is a code-focused small language model from the Qwen family. It is designed for code generation and understanding tasks. While it can produce functional code, it has a significant issue when used for JSON generation within Maestro: it tends to inject unwanted schema patterns (notably `"type":"object"`) into JSON output, making it unsuitable for structured data workflows.

For code generation tasks, it is the recommended model in the Maestro ecosystem. For JSON and structured output, use SmolLM2-1.7B-Instruct instead.

## Capabilities

- **Code Generation**: Produces syntactically correct code in common languages (Python, JavaScript, TypeScript, C#). Understands function signatures, class structures, and common patterns.
- **Code Understanding**: Can analyze and explain code snippets when prompted.

### Limitations

- **JSON Generation**: Adds unwanted `"type":"object"` wrapper patterns to JSON output. This is a consistent behavior likely inherited from training data that included JSON Schema definitions. The extra fields cause fitness score penalties and downstream parsing issues.
- **Structured Output**: Beyond the `"type":"object"` issue, the model occasionally restructures JSON in ways that break expected schemas.
- **Fitness Range**: Achieves 0.60-0.80 fitness on code-related tasks but drops significantly on structured data tasks.

## Recommended Configuration

### Temperature Settings

| Task Type       | Temperature | Rationale                                |
|-----------------|-------------|------------------------------------------|
| Code Generation | 0.3         | Low temperature for correct syntax       |
| Code Review     | 0.5         | Slightly higher for varied explanations  |

### Prompt Engineering

1. **Specify the language explicitly**: Always state the target programming language in the prompt.
2. **Avoid JSON output requests**: Do not use this model for tasks that require pure JSON output. The `"type":"object"` injection is persistent and difficult to prompt-engineer away.
3. **Provide function signatures**: When requesting code generation, providing the expected function signature improves output quality.

### Example Maestro Configuration

```json
{
  "model": "Qwen/Qwen2.5-Coder-1.5B-Instruct",
  "temperature": 0.3,
  "maxTokens": 1024,
  "systemPrompt": "You are a code generator. Write clean, functional code in the specified language. No explanations, only code."
}
```

## Known Issues

1. **`"type":"object"` injection**: When asked to produce JSON, the model frequently wraps output in JSON Schema-style structures with `"type":"object"` and `"properties"` fields. This is a training data artifact and cannot be reliably eliminated through prompting.
2. **Mixed output**: Occasionally produces a mix of code and prose even when instructed to output only code. Adding "no explanations" to the system prompt reduces but does not eliminate this behavior.
3. **Not a drop-in replacement for SmolLM2**: Despite similar parameter counts, the two models have very different strengths. Do not swap them without adjusting the workflow configuration.
