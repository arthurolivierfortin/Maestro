using Maestro.Application.DTOs;
using Maestro.Application.Interfaces;
using Maestro.Infrastructure.LLMGateway;
using Microsoft.AspNetCore.Mvc;

namespace Maestro.Api.Controllers;

[ApiController]
[Route("api/provider")]
public class ProviderController : ControllerBase
{
    private readonly ILLMProviderService _llmService;
    private readonly ILogger<ProviderController> _logger;

    public ProviderController(
        ILLMProviderService llmService,
        ILogger<ProviderController> logger)
    {
        _llmService = llmService;
        _logger = logger;
    }

    [HttpGet("health")]
    public async Task<ActionResult<LLMProviderHealth>> GetHealth(CancellationToken ct)
    {
        try
        {
            var health = await _llmService.GetHealthAsync(ct);
            return Ok(health);
        }
        catch (LLMProviderUnavailableException ex)
        {
            return StatusCode(503, new { error = "LLM Provider is not running. Start it with: python -m llm_provider", details = ex.Message });
        }
    }

    /// <summary>Alias for GetHealth — matches API client's getLLMStatus().</summary>
    [HttpGet("status")]
    public async Task<ActionResult<LLMProviderHealth>> GetStatus(CancellationToken ct)
    {
        return await GetHealth(ct);
    }

    [HttpGet("capabilities")]
    public async Task<ActionResult<SystemCapabilities>> GetCapabilities(CancellationToken ct)
    {
        try
        {
            var capabilities = await _llmService.GetSystemCapabilitiesAsync(ct);
            return Ok(capabilities);
        }
        catch (LLMProviderUnavailableException ex)
        {
            return StatusCode(503, new { error = "LLM Provider is not running", details = ex.Message });
        }
    }

    [HttpGet("models")]
    public async Task<ActionResult<CompatibleModelsResponse>> GetCompatibleModels(
        [FromQuery] string? category = null,
        CancellationToken ct = default)
    {
        try
        {
            var models = await _llmService.GetCompatibleModelsAsync(category, ct);
            return Ok(models);
        }
        catch (LLMProviderUnavailableException ex)
        {
            return StatusCode(503, new { error = "LLM Provider is not running", details = ex.Message });
        }
    }

    [HttpGet("models/local")]
    public async Task<ActionResult<LocalModelsResponse>> GetLocalModels(CancellationToken ct)
    {
        try
        {
            var models = await _llmService.GetLocalModelsAsync(ct);
            return Ok(models);
        }
        catch (LLMProviderUnavailableException ex)
        {
            return StatusCode(503, new { error = "LLM Provider is not running", details = ex.Message });
        }
    }

    [HttpGet("models/registry")]
    public async Task<ActionResult<RegistryModelsResponse>> GetRegistryModels(
        [FromQuery] string? category = null,
        CancellationToken ct = default)
    {
        try
        {
            var models = await _llmService.GetRegistryModelsAsync(category, ct);
            return Ok(models);
        }
        catch (LLMProviderUnavailableException ex)
        {
            return StatusCode(503, new { error = "LLM Provider is not running", details = ex.Message });
        }
    }

    [HttpPost("models/switch")]
    public async Task<ActionResult<SwitchModelResult>> SwitchModel(
        [FromBody] SwitchModelRequest request,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.ModelId))
            return BadRequest(new { error = "modelId is required" });

        try
        {
            var result = await _llmService.SwitchModelAsync(request.ModelId, request.Use8bit, ct);
            return Ok(result);
        }
        catch (LLMProviderUnavailableException ex)
        {
            return StatusCode(503, new { error = "LLM Provider is not running", details = ex.Message });
        }
    }

    [HttpPost("models/load")]
    public async Task<ActionResult<LoadModelResult>> LoadModel(
        [FromBody] LoadModelRequest request,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.ModelId))
            return BadRequest(new { error = "modelId is required" });

        try
        {
            var result = await _llmService.LoadModelAsync(request.ModelId, request.Use8bit, ct);
            return Ok(result);
        }
        catch (LLMProviderUnavailableException ex)
        {
            return StatusCode(503, new { error = "LLM Provider is not running", details = ex.Message });
        }
    }
}

public record SwitchModelRequest
{
    public string ModelId { get; init; } = string.Empty;
    public bool Use8bit { get; init; }
}

public record LoadModelRequest
{
    public string ModelId { get; init; } = string.Empty;
    public bool Use8bit { get; init; }
}
