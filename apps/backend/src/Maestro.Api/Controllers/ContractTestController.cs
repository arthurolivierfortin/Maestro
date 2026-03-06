using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Maestro.Application.Interfaces;
using Maestro.Infrastructure.Configuration;
using Maestro.Infrastructure.Testing;

namespace Maestro.Api.Controllers;

/// <summary>
/// Controller for running contract tests against blocks.
/// POST /api/contracts/{contractId}/test?blockId=X → fitness score with feature breakdown.
/// Note: GET /api/contracts and GET /api/contracts/{id} are handled by ContractsController.
/// </summary>
[ApiController]
[Route("api/contracts")]
public class ContractTestController : ControllerBase
{
    private readonly ContractTestRunner _testRunner;
    private readonly IBlockDiscoveryService _discoveryService;
    private readonly MaestroPathConfiguration _pathConfig;
    private readonly ILogger<ContractTestController> _logger;

    public ContractTestController(
        ContractTestRunner testRunner,
        IBlockDiscoveryService discoveryService,
        MaestroPathConfiguration pathConfig,
        ILogger<ContractTestController> logger)
    {
        _testRunner = testRunner;
        _discoveryService = discoveryService;
        _pathConfig = pathConfig;
        _logger = logger;
    }

    /// <summary>
    /// Run contract tests against a block.
    /// Returns fitness score with per-feature breakdown.
    /// </summary>
    [HttpPost("{contractId}/test")]
    public async Task<ActionResult> RunContractTest(
        string contractId,
        [FromQuery] string blockId,
        CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(blockId))
            return BadRequest(new { error = "blockId query parameter is required" });

        // 1. Load contract
        var contractsDir = Path.Combine(_pathConfig.RepoRootPath, "content", "system", "contracts");
        var contractPath = Path.Combine(contractsDir, $"{contractId}.contract.json");

        if (!System.IO.File.Exists(contractPath))
            return NotFound(new { error = $"Contract '{contractId}' not found" });

        JsonElement contract;
        try
        {
            var json = await System.IO.File.ReadAllTextAsync(contractPath, ct);
            contract = JsonDocument.Parse(json).RootElement;
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = $"Failed to parse contract: {ex.Message}" });
        }

        // 2. Load block
        var block = await _discoveryService.GetByIdAsync(blockId, ct);
        if (block == null)
            return NotFound(new { error = $"Block '{blockId}' not found" });

        _logger.LogInformation(
            "Running contract test: contract={ContractId}, block={BlockId}",
            contractId, blockId);

        // 3. Run tests
        try
        {
            var result = await _testRunner.RunAsync(contract, block, ct);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Contract test failed: {ContractId} vs {BlockId}", contractId, blockId);
            return StatusCode(500, new { error = $"Test execution failed: {ex.Message}" });
        }
    }
}
