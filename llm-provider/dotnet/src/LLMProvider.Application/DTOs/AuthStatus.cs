namespace LLMProvider.Application.DTOs;

/// <summary>
/// Describes the authentication state of an LLM provider.
/// </summary>
/// <param name="IsConfigured">Whether the provider has credentials configured.</param>
/// <param name="Method">Type of authentication: "api-key", "token", "managed-identity", "cli", "none".</param>
/// <param name="MaskedCredential">Credential masked for display (e.g. "****ab12"), or null if not applicable.</param>
public record AuthStatus(
    bool IsConfigured,
    string Method,
    string? MaskedCredential
);
