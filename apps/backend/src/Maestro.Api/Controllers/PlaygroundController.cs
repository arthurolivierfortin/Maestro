using System.Diagnostics;
using Maestro.Application.DTOs;
using Maestro.Application.Interfaces;
using Maestro.Infrastructure.LLMGateway;
using Maestro.Infrastructure.Playground;
using Microsoft.AspNetCore.Mvc;

namespace Maestro.Api.Controllers;

[ApiController]
[Route("api/playground")]
public class PlaygroundController : ControllerBase
{
    private readonly ILLMGateway _llmGateway;
    private readonly IModelPricingService _pricingService;
    private readonly ICostTrackingService _costTrackingService;
    private readonly ILogger<PlaygroundController> _logger;

    public PlaygroundController(
        ILLMGateway llmGateway,
        IModelPricingService pricingService,
        ICostTrackingService costTrackingService,
        ILogger<PlaygroundController> logger)
    {
        _llmGateway = llmGateway;
        _pricingService = pricingService;
        _costTrackingService = costTrackingService;
        _logger = logger;
    }

    /// <summary>
    /// Send a prompt to a model and return the response with metrics.
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<PlaygroundResponseDto>> SendPrompt(
        [FromBody] PlaygroundRequestDto request,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.ModelId))
            return BadRequest(new { error = "modelId is required" });
        if (string.IsNullOrWhiteSpace(request.Prompt))
            return BadRequest(new { error = "prompt is required" });

        try
        {
            var sw = Stopwatch.StartNew();

            var llmRequest = new LLMRequest
            {
                Messages = new List<ChatMessage>
                {
                    ChatMessage.User(request.Prompt)
                },
                SystemPrompt = request.SystemPrompt,
                ModelId = request.ModelId,
                MaxNewTokens = request.MaxTokens,
                Temperature = request.Temperature
            };

            var llmResponse = await _llmGateway.SendAsync(llmRequest, ct);
            sw.Stop();

            var cost = await _pricingService.EstimateCostAsync(
                request.ModelId, llmResponse.PromptTokens, llmResponse.CompletionTokens, ct);

            // Record cost
            await _costTrackingService.RecordCostAsync(new CostEntryDto
            {
                SessionId = "playground",
                BlockId = "playground",
                ModelId = request.ModelId,
                ProviderId = llmResponse.Provider ?? "unknown",
                PromptTokens = llmResponse.PromptTokens,
                CompletionTokens = llmResponse.CompletionTokens,
                CostUsd = cost,
                Timestamp = DateTime.UtcNow
            });

            return Ok(new PlaygroundResponseDto
            {
                Content = llmResponse.Content,
                ModelId = llmResponse.Model ?? request.ModelId,
                Provider = llmResponse.Provider ?? "unknown",
                PromptTokens = llmResponse.PromptTokens,
                CompletionTokens = llmResponse.CompletionTokens,
                TotalTokens = llmResponse.TotalTokens,
                CostUsd = cost,
                LatencyMs = sw.ElapsedMilliseconds
            });
        }
        catch (LLMProviderUnavailableException ex)
        {
            return StatusCode(503, new { error = "LLM Provider is not running", details = ex.Message });
        }
        catch (HttpRequestException ex)
        {
            return StatusCode(503, new { error = "LLM Provider error", details = ex.Message });
        }
    }

    /// <summary>
    /// Get the list of available capability tests.
    /// </summary>
    [HttpGet("tests")]
    public ActionResult<List<CapabilityTestDto>> GetTests()
    {
        var tests = CapabilityTestDefinitions.All
            .Select(t => new CapabilityTestDto
            {
                Id = t.Id,
                Name = t.Name,
                Description = t.Description,
                Category = t.Category
            })
            .ToList();

        return Ok(tests);
    }

    /// <summary>
    /// Run a capability test against a model and return the result.
    /// </summary>
    [HttpPost("test")]
    public async Task<ActionResult<CapabilityTestResultDto>> RunTest(
        [FromBody] CapabilityTestRequestDto request,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.ModelId))
            return BadRequest(new { error = "modelId is required" });
        if (string.IsNullOrWhiteSpace(request.TestId))
            return BadRequest(new { error = "testId is required" });

        var test = CapabilityTestDefinitions.All
            .FirstOrDefault(t => t.Id == request.TestId);

        if (test == null)
            return NotFound(new { error = $"Test '{request.TestId}' not found" });

        try
        {
            var sw = Stopwatch.StartNew();

            var llmRequest = new LLMRequest
            {
                Messages = new List<ChatMessage>
                {
                    ChatMessage.User(test.UserPrompt)
                },
                SystemPrompt = test.SystemPrompt,
                ModelId = request.ModelId,
                Temperature = 0.3f // Lower temperature for more deterministic test results
            };

            var llmResponse = await _llmGateway.SendAsync(llmRequest, ct);
            sw.Stop();

            var (passed, details) = CapabilityTestValidator.Validate(test, llmResponse.Content);

            var cost = await _pricingService.EstimateCostAsync(
                request.ModelId, llmResponse.PromptTokens, llmResponse.CompletionTokens, ct);

            // Record cost
            await _costTrackingService.RecordCostAsync(new CostEntryDto
            {
                SessionId = "playground",
                BlockId = $"capability-test:{test.Id}",
                ModelId = request.ModelId,
                ProviderId = llmResponse.Provider ?? "unknown",
                PromptTokens = llmResponse.PromptTokens,
                CompletionTokens = llmResponse.CompletionTokens,
                CostUsd = cost,
                Timestamp = DateTime.UtcNow
            });

            return Ok(new CapabilityTestResultDto
            {
                TestId = test.Id,
                TestName = test.Name,
                Passed = passed,
                Content = llmResponse.Content,
                ValidationDetails = details,
                PromptTokens = llmResponse.PromptTokens,
                CompletionTokens = llmResponse.CompletionTokens,
                CostUsd = cost,
                LatencyMs = sw.ElapsedMilliseconds
            });
        }
        catch (LLMProviderUnavailableException ex)
        {
            return StatusCode(503, new { error = "LLM Provider is not running", details = ex.Message });
        }
        catch (HttpRequestException ex)
        {
            return StatusCode(503, new { error = "LLM Provider error", details = ex.Message });
        }
    }
}
