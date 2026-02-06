# LLM Gateway Architecture

**Date**: February 6, 2026
**Reference**: [ADR 0001: Model-Agnostic Design](../design-decisions/0001-model-agnostic-design.md)

---

## Core Principle: Model-Agnostic Design

Maestro never depends directly on any LLM provider. All LLM interactions go through the **ILLMGateway interface**, which abstracts model providers and allows configuration-driven model selection.

---

## Architecture

```
┌─────────────┐
│   Agent     │  (No knowledge of models)
└──────┬──────┘
       │ depends on
       ▼
┌─────────────┐
│ ILLMGateway │  (Interface/Abstraction)
└──────┬──────┘
       │ implemented by
       ▼
┌──────────────────────────────────┐
│      LLMGateway (Concrete)       │
│  - Model selection logic         │
│  - Request/response mapping      │
│  - Error handling                │
└──────┬───────────────────────────┘
       │ delegates to
       ▼
┌─────────────────────────────────┐
│     Adapters (ILLMAdapter)      │
│  - OpenAIAdapter                │
│  - AnthropicAdapter             │
│  - OllamaAdapter                │
│  - AzureOpenAIAdapter           │
└─────────────────────────────────┘
```

---

## Key Components

### ILLMGateway (Application Layer)

```csharp
public interface ILLMGateway
{
    Task<LLMResponse> SendAsync(
        LLMRequest request,
        CancellationToken cancellationToken = default);
}
```

### LLMRequest/LLMResponse (Model-Agnostic)

```csharp
public class LLMRequest
{
    public string Prompt { get; init; }
    public List<Message> Messages { get; init; }
    public List<Tool> Tools { get; init; }
    public ModelPreferences Preferences { get; init; }
}

public class LLMResponse
{
    public string Content { get; init; }
    public List<ToolCall> ToolCalls { get; init; }
    public TokenUsage Usage { get; init; }
}
```

### ILLMAdapter (Infrastructure Layer)

Each adapter translates between model-agnostic format and provider-specific APIs.

---

## Configuration-Driven Model Selection

Model selection happens via configuration, not code:

```json
{
  "LLMGateway": {
    "DefaultProvider": "OpenAI",
    "ModelSelection": {
      "PlannerAgent": { "Provider": "OpenAI", "Model": "gpt-4" },
      "CoderAgent": { "Provider": "Anthropic", "Model": "claude-3" }
    }
  }
}
```

**Result**: Agents never know which model they're using. Configuration determines the provider and model.

---

## Benefits

| Benefit | Description |
|---------|-------------|
| **Flexibility** | Swap models without code changes |
| **Cost Optimization** | Use cheap models for simple tasks, expensive for complex |
| **Privacy** | Keep sensitive operations on local models |
| **Vendor Independence** | No lock-in to any provider |
| **Future-Proof** | Add new providers by implementing ILLMAdapter |

---

*"Agents don't choose models. Configuration does."*
