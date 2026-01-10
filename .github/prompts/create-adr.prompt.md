---
mode: 'agent'
description: 'Create or update Architecture Decision Records (ADRs) for B-One Maestro project'
---

# Create Architecture Decision Record

Generate an Architecture Decision Record (ADR) following the format and conventions used in B-One Maestro project.

## What are ADRs?

Architecture Decision Records document important architectural decisions made during the project. They capture the context, decision, and consequences to help future developers understand why certain choices were made.

## When to Create an ADR

Create an ADR when making decisions about:
- **Architecture patterns** (Clean Architecture layers, CQRS, Event Sourcing)
- **Technology choices** (LLM providers, databases, frameworks)
- **API design** (REST vs GraphQL, versioning strategy)
- **Integration patterns** (how agents communicate, workflow persistence)
- **Security decisions** (authentication, authorization, sandboxing)
- **Performance trade-offs** (caching strategies, optimization choices)
- **Model agnostic design** (abstraction layers, provider interfaces)

## ADR Naming Convention

ADRs are numbered sequentially with descriptive titles:
```
docs/adr/
├── 0001-model-agnostic-design.md
├── 0002-workflow-persistence-git.md
├── 0003-clean-architecture-dotnet.md
├── 0004-signalr-real-time-updates.md
└── 0005-tool-sandboxing-strategy.md
```

**Format:** `NNNN-kebab-case-title.md` where NNNN is a zero-padded number

## ADR Template

Use this template for all ADRs:

```markdown
# [NUMBER]. [Title]

Date: YYYY-MM-DD

## Status

[Proposed | Accepted | Deprecated | Superseded by ADR-XXXX]

## Context

[Describe the issue or problem that requires a decision. Include:]
- What is the problem we're trying to solve?
- What are the constraints and requirements?
- What are the forces at play (business, technical, user needs)?
- What alternatives have we considered?

## Decision

[Describe the decision that was made. Be clear and concise:]
- What approach did we choose?
- Why this approach over alternatives?
- How does it address the problem?

## Consequences

### Positive

- [Benefit 1: Explain the advantage]
- [Benefit 2: Explain the advantage]
- [Benefit 3: Explain the advantage]

### Negative

- [Drawback 1: Explain the trade-off or cost]
- [Drawback 2: Explain the trade-off or cost]

### Neutral

- [Impact 1: Neither good nor bad, but worth noting]
- [Impact 2: Changes to workflow or process]

## Implementation

[Optional: Describe how the decision will be implemented]
- Key components or patterns to use
- Migration strategy if replacing existing approach
- Timeline and milestones

## Alternatives Considered

### Alternative 1: [Name]

**Description:** [Brief description]

**Pros:**
- [Advantage 1]
- [Advantage 2]

**Cons:**
- [Disadvantage 1]
- [Disadvantage 2]

**Why rejected:** [Reason for not choosing this alternative]

### Alternative 2: [Name]

[Same structure as Alternative 1]

## References

- [Link to relevant documentation]
- [Link to related ADRs]
- [External resources or research]

## Notes

[Any additional context, follow-up items, or open questions]
```

## Example ADR (Model-Agnostic Design)

```markdown
# 1. Model-Agnostic Design with LLM Gateway Abstraction

Date: 2026-01-09

## Status

Accepted

## Context

B-One Maestro is designed to orchestrate multi-agent workflows for software engineering tasks. AI agents (Planner, Coder, Tester, Reviewer) require Large Language Model (LLM) capabilities to perform their tasks.

The AI landscape is rapidly evolving:
- New models emerge frequently (GPT-5, Claude 4, Gemini Ultra, etc.)
- Organizations have diverse requirements (cloud vs. local, cost vs. performance)
- API contracts and capabilities vary between providers
- Privacy concerns require flexibility in model deployment

**The problem:** How do we integrate LLM capabilities without coupling our architecture to a specific provider?

**Requirements:**
- Support multiple LLM providers (OpenAI, Anthropic, Ollama, Azure OpenAI)
- Allow runtime configuration of providers and models
- Enable switching providers without rewriting agent code
- Support local models for privacy-sensitive use cases
- Future-proof against API changes and new providers

## Decision

We will implement a **Gateway Pattern** with a provider-agnostic abstraction layer (`ILLMGateway`) that sits between our Application layer and external LLM services.

**Key principles:**
1. **No direct SDK imports** in Application or Domain layers
2. **Interface-based abstraction** defined in Application layer
3. **Provider-specific adapters** implemented in Infrastructure layer
4. **Configuration-driven** provider selection
5. **Dependency Injection** for runtime provider binding

**Architecture:**
```
Application Layer (Maestro.Application)
├── Interfaces/ILLMGateway.cs (abstraction)
└── DTOs/LLMRequest.cs, LLMResponse.cs

Infrastructure Layer (Maestro.Infrastructure)
├── LLMGateway/
│   ├── LLMGatewayFactory.cs (factory pattern)
│   ├── OpenAIAdapter.cs (implements ILLMGateway)
│   ├── AnthropicAdapter.cs (implements ILLMGateway)
│   └── OllamaAdapter.cs (implements ILLMGateway)
```

**Interface definition:**
```csharp
public interface ILLMGateway
{
    Task<LLMResponse> SendPromptAsync(LLMRequest request);
    Task<bool> IsAvailableAsync();
    string ProviderName { get; }
}
```

**Configuration:**
```json
{
  "LLM": {
    "DefaultProvider": "OpenAI",
    "Providers": {
      "OpenAI": {
        "ApiKey": "...",
        "DefaultModel": "gpt-4",
        "BaseUrl": "https://api.openai.com/v1"
      },
      "Anthropic": {
        "ApiKey": "...",
        "DefaultModel": "claude-3-opus"
      },
      "Ollama": {
        "BaseUrl": "http://localhost:11434",
        "DefaultModel": "llama3"
      }
    }
  }
}
```

## Consequences

### Positive

- **Provider flexibility:** Can switch providers without changing agent code
- **Future-proof:** New providers can be added by implementing the interface
- **Local model support:** Ollama and LM Studio can be used for privacy
- **Cost optimization:** Can use cheaper models for simple tasks, powerful models for complex tasks
- **Clean Architecture compliance:** Respects dependency inversion principle
- **Testing:** Easy to mock `ILLMGateway` in unit tests
- **Vendor independence:** No lock-in to any specific provider

### Negative

- **Abstraction overhead:** Additional layer adds complexity
- **Lowest common denominator:** Interface must support all providers (may limit provider-specific features)
- **Configuration complexity:** Requires proper setup for each provider
- **Initial development time:** More upfront work than direct SDK usage

### Neutral

- **Adapter maintenance:** Each new provider requires an adapter implementation
- **Response format normalization:** Adapters must translate provider responses to common format
- **Error handling:** Need to handle provider-specific errors consistently

## Implementation

**Phase 1: Core abstraction**
1. Define `ILLMGateway` interface in Application layer
2. Create `LLMRequest` and `LLMResponse` DTOs
3. Implement `LLMGatewayFactory` for provider selection

**Phase 2: Initial adapters**
1. Implement `OpenAIAdapter` (primary provider)
2. Implement `OllamaAdapter` (local models)
3. Add configuration support in `appsettings.json`

**Phase 3: Additional providers**
1. Implement `AnthropicAdapter`
2. Implement `AzureOpenAIAdapter`
3. Document adapter development guide

**Migration strategy:** N/A (greenfield project)

## Alternatives Considered

### Alternative 1: Direct SDK Usage

**Description:** Import OpenAI SDK directly in agent code

**Pros:**
- Simpler implementation (no abstraction layer)
- Access to all provider-specific features
- Less code to maintain

**Cons:**
- Tight coupling to OpenAI
- Cannot switch providers without rewriting agents
- Difficult to test (mocking SDK is complex)
- Violates Clean Architecture principles

**Why rejected:** Creates vendor lock-in and violates architectural principles

### Alternative 2: Semantic Kernel Integration

**Description:** Use Microsoft Semantic Kernel as LLM abstraction

**Pros:**
- Battle-tested abstraction layer
- Built-in provider support
- Rich feature set (memory, planning, plugins)

**Cons:**
- Additional dependency and learning curve
- May be overkill for our needs
- Less control over abstraction layer
- Potential coupling to Semantic Kernel's API design

**Why rejected:** We prefer a lightweight, custom abstraction tailored to our needs

### Alternative 3: LangChain Integration

**Description:** Use LangChain framework for LLM orchestration

**Pros:**
- Comprehensive LLM framework
- Supports multiple providers
- Rich ecosystem of integrations

**Cons:**
- Python-based (would require separate service)
- Heavy framework for our use case
- Less control over architecture
- Cross-language communication complexity

**Why rejected:** Architecture mismatch (we're .NET-first)

## References

- [Clean Architecture by Robert C. Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Gateway Pattern](https://martinfowler.com/articles/gateway-pattern.html)
- [Dependency Inversion Principle](https://en.wikipedia.org/wiki/Dependency_inversion_principle)
- [OpenAI API Documentation](https://platform.openai.com/docs/api-reference)
- [Anthropic API Documentation](https://docs.anthropic.com/claude/reference)
- [Ollama API Documentation](https://github.com/ollama/ollama/blob/main/docs/api.md)

## Notes

- Consider adding telemetry to track provider usage and costs
- Future enhancement: Support multiple providers in parallel for redundancy
- Future enhancement: Implement request caching to reduce costs
- Monitor provider API changes and update adapters accordingly
```

## Steps to Create an ADR

1. **Identify the decision to document**
   - Review recent architectural discussions
   - Check if decision impacts multiple components
   - Verify decision has long-term implications

2. **Determine the ADR number**
   ```bash
   # List existing ADRs
   ls docs/adr/
   
   # Next number is highest + 1
   # If 0003 exists, create 0004
   ```

3. **Create the ADR file**
   - Use the template above
   - Name: `NNNN-descriptive-title.md`
   - Location: `docs/adr/`

4. **Fill in the template**
   - **Status**: Start with "Proposed" if decision is pending, "Accepted" if already decided
   - **Context**: Explain the problem thoroughly
   - **Decision**: Be clear about what was chosen
   - **Consequences**: List pros, cons, and neutral impacts
   - **Alternatives**: Document options that were considered and rejected
   - **References**: Link to supporting material

5. **Review and commit**
   - Review for clarity and completeness
   - Have team members review if decision is significant
   - Commit with message: `docs: add ADR-NNNN for [title]`

6. **Update index (if exists)**
   - If `docs/adr/README.md` exists, add link to new ADR

## ADR Lifecycle

### Proposed → Accepted
When team agrees on the decision:
- Change status to "Accepted"
- Add acceptance date
- Begin implementation

### Accepted → Deprecated
When decision is no longer valid:
- Change status to "Deprecated"
- Add deprecation date and reason
- Reference superseding ADR if applicable

### Accepted → Superseded
When decision is replaced by a better one:
- Change status to "Superseded by ADR-XXXX"
- Create new ADR documenting the new decision
- Explain why original decision was replaced

## Quality Checklist

Before finalizing an ADR:
- [ ] Problem is clearly stated in Context section
- [ ] Decision is explicit and unambiguous
- [ ] At least 2 alternatives are documented with rationale for rejection
- [ ] Consequences (positive and negative) are listed
- [ ] References are provided for background information
- [ ] Status is appropriate (Proposed/Accepted/Deprecated/Superseded)
- [ ] Date is included
- [ ] File follows naming convention (NNNN-kebab-case.md)
- [ ] Language is clear and professional
- [ ] ADR is committed to version control

## Usage in Development Workflow

**When making architectural decisions:**
1. Draft ADR with "Proposed" status
2. Share with team for review
3. Discuss and refine
4. Update status to "Accepted" when decided
5. Reference ADR number in PRs implementing the decision

**When reviewing code:**
- Check that code follows decisions in ADRs
- If code violates ADR, either fix code or propose ADR update
- Use ADR numbers in PR comments (e.g., "This follows ADR-0003")

**When onboarding new developers:**
- Point to ADRs as explanation for architectural choices
- ADRs serve as living documentation of project evolution

## Examples from Maestro

Current ADRs in the project:
- **ADR-0001**: Model-Agnostic Design - LLM Gateway abstraction
- **ADR-0002**: Workflow Persistence in Git - Store workflows as JSON in repo
- **ADR-0003**: Clean Architecture with .NET - Layer organization and dependency rules

## Tips for Writing Good ADRs

1. **Be specific**: Avoid vague language like "we might consider"
2. **Be honest**: Document trade-offs, don't hide drawbacks
3. **Be concise**: Focus on the decision, not implementation details
4. **Be comprehensive**: Cover all relevant alternatives
5. **Be forward-looking**: Consider future implications
6. **Use diagrams**: Add architecture diagrams if helpful
7. **Link references**: Provide sources for context
8. **Review regularly**: Update status if decision changes

## Anti-Patterns to Avoid

❌ **Too detailed**: ADRs are not implementation guides
❌ **Too vague**: "We decided to use a good architecture"
❌ **Missing alternatives**: Only documenting the chosen approach
❌ **No consequences**: Failing to list trade-offs
❌ **Outdated status**: Not updating when decision is superseded
❌ **Missing context**: Not explaining why decision was needed

---

## Resources

- [Architecture Decision Records](https://adr.github.io/)
- [Documenting Architecture Decisions by Michael Nygard](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
- [ADR Tools](https://github.com/npryce/adr-tools)
