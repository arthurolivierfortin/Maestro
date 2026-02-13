using Maestro.Application.DTOs;
using Maestro.Application.Interfaces;
using Maestro.Api.Security;
using Maestro.Domain.Enums;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace Maestro.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IApiKeyService _apiKeyService;
    private readonly IOptions<ApiKeyAuthOptions> _authOptions;
    private readonly ILogger<AuthController> _logger;

    public AuthController(
        IApiKeyService apiKeyService,
        IOptions<ApiKeyAuthOptions> authOptions,
        ILogger<AuthController> logger)
    {
        _apiKeyService = apiKeyService;
        _authOptions = authOptions;
        _logger = logger;
    }

    /// <summary>
    /// Get auth status — is security enabled, are there any keys?
    /// </summary>
    [HttpGet("status")]
    public async Task<IActionResult> GetStatus()
    {
        var hasKeys = await _apiKeyService.HasAnyKeysAsync();
        return Ok(new AuthStatusResponse
        {
            Enabled = _authOptions.Value.Enabled,
            HasKeys = hasKeys,
            NeedsSetup = _authOptions.Value.Enabled && !hasKeys
        });
    }

    /// <summary>
    /// First-time setup — creates the initial admin key.
    /// Only works when no keys exist.
    /// </summary>
    [HttpPost("setup")]
    public async Task<IActionResult> Setup([FromBody] SetupRequest? request)
    {
        var hasKeys = await _apiKeyService.HasAnyKeysAsync();
        if (hasKeys)
        {
            return Conflict(new { error = "Setup already completed. Use existing admin key to create more keys." });
        }

        var result = await _apiKeyService.GenerateKeyAsync(new CreateKeyRequest
        {
            Name = request?.Name ?? "admin",
            Scope = ApiKeyScope.Admin
        });

        _logger.LogInformation("Initial admin API key created via setup");

        return Ok(new SetupResponse
        {
            Key = result.Key,
            Message = "Admin key created. Store it securely — it cannot be retrieved later."
        });
    }

    /// <summary>
    /// Create a new API key. Requires an existing valid key (enforced by middleware).
    /// </summary>
    [HttpPost("keys")]
    public async Task<IActionResult> CreateKey([FromBody] CreateKeyRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new { error = "Key name is required" });
        }

        var result = await _apiKeyService.GenerateKeyAsync(request);
        return Ok(result);
    }

    /// <summary>
    /// List all active API keys (hashes are excluded).
    /// </summary>
    [HttpGet("keys")]
    public async Task<IActionResult> ListKeys()
    {
        var keys = await _apiKeyService.ListKeysAsync();
        return Ok(keys);
    }

    /// <summary>
    /// Revoke an API key by ID.
    /// </summary>
    [HttpDelete("keys/{id}")]
    public async Task<IActionResult> RevokeKey(string id)
    {
        var result = await _apiKeyService.RevokeKeyAsync(id);
        if (!result)
            return NotFound(new { error = "Key not found" });

        return Ok(new { message = "Key revoked", id });
    }

    /// <summary>
    /// Validate the current Bearer token.
    /// </summary>
    [HttpPost("validate")]
    public async Task<IActionResult> Validate()
    {
        var authHeader = Request.Headers.Authorization.FirstOrDefault();
        if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            return Ok(new ValidateKeyResponse { Valid = false });
        }

        var key = authHeader["Bearer ".Length..].Trim();
        var result = await _apiKeyService.ValidateKeyAsync(key);
        return Ok(result);
    }
}
