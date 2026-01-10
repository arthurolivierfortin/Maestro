using Maestro.Application.Interfaces;

namespace Maestro.Infrastructure.LLMGateway;

/// <summary>
/// Placeholder LLM Gateway implementation.
/// In production, this would route to various model adapters.
/// </summary>
public class LLMGateway : ILLMGateway
{
    public Task<LLMResponse> SendAsync(LLMRequest request, CancellationToken cancellationToken = default)
    {
        // Placeholder: returns a hello world response
        var response = new LLMResponse
        {
            Content = "Hello from LLM Gateway (placeholder)"
        };

        return Task.FromResult(response);
    }
}
