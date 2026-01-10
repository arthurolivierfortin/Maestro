# ADR 0001: Model-Agnostic Design

**Status**: Accepted  
**Date**: 2024-01-09  
**Decision Makers**: Architecture Team

---

## Context

B-One Maestro is designed to orchestrate autonomous multi-agent workflows for software engineering tasks. A critical early decision is how the system will interact with AI models (LLMs).

### The Problem

- AI landscape is rapidly evolving (new models, providers, APIs)
- Organizations have diverse needs (local vs. cloud, cost, privacy)
- Direct dependencies on specific models create vendor lock-in
- Hard-coding model interactions makes the system brittle and difficult to extend

### Requirements

1. Support multiple LLM providers (OpenAI, Anthropic, Azure, local models)
2. Allow switching models without changing agent code
3. Enable cost optimization (use different models for different tasks)
4. Support privacy requirements (keep sensitive code local)
5. Future-proof against API changes

---

## Decision

**We will implement a model-agnostic architecture using the Gateway/Adapter pattern.**

### Architecture

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
┌─────────────────────────────────────────┐
│         Adapters (ILLMAdapter)          │
│  - OpenAIAdapter                        │
│  - AnthropicAdapter                     │
│  - OllamaAdapter                        │
│  - AzureOpenAIAdapter                   │
└─────────────────────────────────────────┘
```

### Key Components

#### 1. **ILLMGateway Interface** (Application Layer)

```csharp
public interface ILLMGateway
{
    Task<LLMResponse> SendAsync(
        LLMRequest request, 
        CancellationToken cancellationToken = default);
        
    Task<Stream> StreamAsync(
        LLMRequest request, 
        CancellationToken cancellationToken = default);
}
```

#### 2. **LLMRequest/LLMResponse** (Application Layer)

Model-agnostic request/response objects:

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

#### 3. **ILLMAdapter Interface** (Infrastructure Layer)

```csharp
public interface ILLMAdapter
{
    string ProviderName { get; }
    Task<LLMResponse> SendAsync(LLMRequest request, CancellationToken ct);
}
```

#### 4. **Concrete Adapters** (Infrastructure Layer)

Each adapter translates between our model-agnostic format and provider-specific APIs:

- `OpenAIAdapter`: Calls OpenAI API
- `AnthropicAdapter`: Calls Anthropic API
- `OllamaAdapter`: Calls local Ollama
- `AzureOpenAIAdapter`: Calls Azure OpenAI

### Configuration

Model selection is configuration-driven:

```json
{
  "LLMGateway": {
    "DefaultProvider": "OpenAI",
    "ModelSelection": {
      "PlannerAgent": { "Provider": "OpenAI", "Model": "gpt-4" },
      "CoderAgent": { "Provider": "Anthropic", "Model": "claude-3" },
      "TesterAgent": { "Provider": "Ollama", "Model": "codellama" }
    },
    "Providers": {
      "OpenAI": {
        "ApiKey": "env:OPENAI_API_KEY",
        "BaseUrl": "https://api.openai.com/v1"
      },
      "Ollama": {
        "BaseUrl": "http://localhost:11434"
      }
    }
  }
}
```

---

## Consequences

### Positive

1. **Flexibility**: Swap models without code changes
2. **Cost optimization**: Use cheaper models for simple tasks, expensive models for complex ones
3. **Privacy**: Keep sensitive operations on local models
4. **Testability**: Easy to mock ILLMGateway for testing
5. **Future-proof**: Add new providers by implementing ILLMAdapter
6. **Vendor independence**: No lock-in to any provider

### Negative

1. **Abstraction cost**: Extra layer adds slight complexity
2. **Lowest common denominator**: Gateway API must support all providers' features
3. **Translation overhead**: Mapping between formats adds processing
4. **Initial setup**: More configuration required upfront

### Mitigations

- Keep Gateway API simple and focused
- Use adapter-specific features through optional parameters
- Cache configurations to minimize overhead
- Provide sensible defaults to reduce setup burden

---

## Alternatives Considered

### Alternative 1: Direct Model Integration

Agents directly import and use model SDKs.

**Rejected because**:
- Creates tight coupling
- Vendor lock-in
- Difficult to swap models
- Hard to test

### Alternative 2: Plugin System

Models as plugins loaded at runtime.

**Rejected because**:
- Over-engineered for current needs
- Adds complexity without clear benefit
- Configuration-based approach is simpler

### Alternative 3: Separate Services per Model

Run separate microservices for each model provider.

**Rejected because**:
- Unnecessary complexity for desktop app
- Increases deployment burden
- Adapter pattern achieves same goals more simply

---

## Implementation Notes

1. **Start with OpenAI and Ollama** adapters (common use cases)
2. **Add streaming support** for long-running operations
3. **Implement retry logic** in Gateway for transient failures
4. **Add telemetry** to track model usage and costs
5. **Support fallback models** if primary model fails

---

## References

- [Gateway Pattern](https://en.wikipedia.org/wiki/Gateway_(telecommunications))
- [Adapter Pattern](https://refactoring.guru/design-patterns/adapter)
- [Dependency Inversion Principle](https://en.wikipedia.org/wiki/Dependency_inversion_principle)

---

## Status History

- 2024-01-09: Accepted
