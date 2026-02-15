using Maestro.Application.DTOs;
using Maestro.Application.Interfaces;
using Maestro.Infrastructure.LLMGateway;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace Maestro.Api.Controllers;

[ApiController]
[Route("api/provider")]
public class ProviderController : ControllerBase
{
    private readonly ILLMProviderService _llmService;
    private readonly ILLMGateway _llmGateway;
    private readonly IConfiguration _configuration;
    private readonly ILogger<ProviderController> _logger;

    public ProviderController(
        ILLMProviderService llmService,
        ILLMGateway llmGateway,
        IConfiguration configuration,
        ILogger<ProviderController> logger)
    {
        _llmService = llmService;
        _llmGateway = llmGateway;
        _configuration = configuration;
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

    /// <summary>Get current Azure OpenAI configuration (without API key).</summary>
    [HttpGet("azure")]
    public ActionResult GetAzureConfig()
    {
        var section = _configuration.GetSection(AzureOpenAISettings.SectionName);
        return Ok(new
        {
            endpoint = section["Endpoint"] ?? "",
            deploymentName = section["DeploymentName"] ?? "",
            apiVersion = section["ApiVersion"] ?? "2024-06-01",
            configured = !string.IsNullOrEmpty(section["Endpoint"]) && !string.IsNullOrEmpty(section["ApiKey"]) && !string.IsNullOrEmpty(section["DeploymentName"])
        });
    }

    /// <summary>Save Azure OpenAI configuration to appsettings.json.</summary>
    [HttpPut("azure")]
    public ActionResult SaveAzureConfig([FromBody] AzureConfigRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Endpoint))
            return BadRequest(new { error = "endpoint is required" });
        if (string.IsNullOrWhiteSpace(request.ApiKey))
            return BadRequest(new { error = "apiKey is required" });
        if (string.IsNullOrWhiteSpace(request.DeploymentName))
            return BadRequest(new { error = "deploymentName is required" });

        try
        {
            // Update the appsettings.json file
            var appSettingsPath = Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "appsettings.json");
            // Try the development path first, then bin-relative
            if (!System.IO.File.Exists(appSettingsPath))
            {
                appSettingsPath = Path.Combine(Directory.GetCurrentDirectory(), "appsettings.json");
            }

            if (System.IO.File.Exists(appSettingsPath))
            {
                var json = System.IO.File.ReadAllText(appSettingsPath);
                using var doc = System.Text.Json.JsonDocument.Parse(json);
                var root = doc.RootElement;

                // Build updated JSON manually to preserve formatting
                var options = new System.Text.Json.JsonSerializerOptions { WriteIndented = true };
                using var ms = new MemoryStream();
                using (var writer = new System.Text.Json.Utf8JsonWriter(ms, new System.Text.Json.JsonWriterOptions { Indented = true }))
                {
                    writer.WriteStartObject();
                    foreach (var prop in root.EnumerateObject())
                    {
                        if (prop.Name == "AzureOpenAI")
                        {
                            writer.WritePropertyName("AzureOpenAI");
                            writer.WriteStartObject();
                            writer.WriteString("Endpoint", request.Endpoint);
                            writer.WriteString("ApiKey", request.ApiKey);
                            writer.WriteString("DeploymentName", request.DeploymentName);
                            writer.WriteString("ApiVersion", request.ApiVersion ?? "2024-06-01");
                            writer.WriteNumber("MaxTokens", 1024);
                            writer.WriteNumber("Temperature", 0.7);
                            writer.WriteNumber("TimeoutSeconds", 120);
                            writer.WriteEndObject();
                        }
                        else
                        {
                            prop.WriteTo(writer);
                        }
                    }
                    writer.WriteEndObject();
                }
                System.IO.File.WriteAllText(appSettingsPath, System.Text.Encoding.UTF8.GetString(ms.ToArray()));
            }

            _logger.LogInformation("Azure OpenAI configuration saved: endpoint={Endpoint}, deployment={Deployment}",
                request.Endpoint, request.DeploymentName);

            return Ok(new { status = "saved", message = "Azure OpenAI configuration saved. Restart backend to apply." });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to save Azure OpenAI configuration");
            return StatusCode(500, new { error = "Failed to save configuration", details = ex.Message });
        }
    }

    /// <summary>Test Azure OpenAI connection with a simple prompt.</summary>
    [HttpPost("azure/test")]
    public async Task<ActionResult> TestAzureConnection(
        [FromBody] AzureTestRequest? request = null,
        CancellationToken ct = default)
    {
        // Check if Azure is configured
        var section = _configuration.GetSection(AzureOpenAISettings.SectionName);
        var endpoint = request?.Endpoint ?? section["Endpoint"];
        var apiKey = request?.ApiKey ?? section["ApiKey"];
        var deployment = request?.DeploymentName ?? section["DeploymentName"];

        if (string.IsNullOrEmpty(endpoint) || string.IsNullOrEmpty(apiKey) || string.IsNullOrEmpty(deployment))
        {
            return BadRequest(new { error = "Azure OpenAI is not configured. Set endpoint, apiKey, and deploymentName." });
        }

        try
        {
            // Create a temporary client for testing
            using var httpClient = new HttpClient();
            httpClient.BaseAddress = new Uri(endpoint.TrimEnd('/'));
            httpClient.Timeout = TimeSpan.FromSeconds(30);
            httpClient.DefaultRequestHeaders.Add("api-key", apiKey);

            var apiVersion = request?.ApiVersion ?? section["ApiVersion"] ?? "2024-06-01";
            var url = $"/openai/deployments/{deployment}/chat/completions?api-version={apiVersion}";

            var testBody = new
            {
                messages = new[] { new { role = "user", content = "Say hello in one word." } },
                max_tokens = 10,
                temperature = 0.1
            };

            var response = await httpClient.PostAsJsonAsync(url, testBody, ct);
            if (response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync(ct);
                return Ok(new { status = "connected", message = "Azure OpenAI connection successful", response = body });
            }
            else
            {
                var error = await response.Content.ReadAsStringAsync(ct);
                return StatusCode((int)response.StatusCode, new { status = "error", error = $"Azure returned {response.StatusCode}", details = error });
            }
        }
        catch (Exception ex)
        {
            return StatusCode(503, new { status = "error", error = "Connection failed", details = ex.Message });
        }
    }

    /// <summary>Get current active provider type.</summary>
    [HttpGet("active")]
    public ActionResult GetActiveProvider()
    {
        var isAzure = _llmGateway is AzureOpenAIGateway;
        return Ok(new
        {
            provider = isAzure ? "azure" : "local",
            gatewayType = _llmGateway.GetType().Name
        });
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

public record AzureConfigRequest
{
    public string Endpoint { get; init; } = string.Empty;
    public string ApiKey { get; init; } = string.Empty;
    public string DeploymentName { get; init; } = string.Empty;
    public string? ApiVersion { get; init; }
}

public record AzureTestRequest
{
    public string? Endpoint { get; init; }
    public string? ApiKey { get; init; }
    public string? DeploymentName { get; init; }
    public string? ApiVersion { get; init; }
}
