namespace Maestro.Application.Interfaces;

/// <summary>
/// Critical abstraction for model-agnostic LLM interactions.
/// All agents communicate through this gateway.
/// </summary>
public interface ILLMGateway
{
    Task<LLMResponse> SendAsync(LLMRequest request, CancellationToken cancellationToken = default);
}

/// <summary>
/// Model-agnostic LLM request.
/// </summary>
public class LLMRequest
{
    public required string Prompt { get; init; }
}

/// <summary>
/// Model-agnostic LLM response.
/// </summary>
public class LLMResponse
{
    public required string Content { get; init; }
}
