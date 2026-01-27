using System.Text.Json;
using Maestro.Domain.Entities;
using Maestro.Domain.Interfaces;
using Maestro.Application.DTOs;
using Maestro.Application.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace Maestro.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class WorkflowsController : ControllerBase
{
    private readonly IWorkflowRepository _repository;
    private readonly IBlockDiscoveryService _blockDiscovery;
    private readonly IWorkflowExecutor _workflowExecutor;
    private readonly ILogger<WorkflowsController> _logger;

    public WorkflowsController(
        IWorkflowRepository repository,
        IBlockDiscoveryService blockDiscovery,
        IWorkflowExecutor workflowExecutor,
        ILogger<WorkflowsController> logger)
    {
        _repository = repository;
        _blockDiscovery = blockDiscovery;
        _workflowExecutor = workflowExecutor;
        _logger = logger;
    }

    /// <summary>
    /// Hello World endpoint to validate wiring.
    /// </summary>
    [HttpGet("hello")]
    public IActionResult Hello()
    {
        _logger.LogInformation("Hello World endpoint called");
        return Ok(new
        {
            message = "Hello from B-One Maestro API",
            architecture = "Clean Architecture",
            layers = new[] { "Domain", "Application", "Infrastructure", "Presentation" }
        });
    }

    /// <summary>
    /// Get all workflows.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<WorkflowDto>>> GetAll()
    {
        var workflows = await _repository.GetAllAsync();
        var dtos = workflows.Select(w => new WorkflowDto
        {
            Id = w.Id.Value,
            Name = w.Name,
            Description = w.Description
        });

        return Ok(dtos);
    }

    /// <summary>
    /// Get all workflow blocks (from block discovery).
    /// </summary>
    [HttpGet("blocks")]
    public async Task<ActionResult<IEnumerable<BlockDto>>> GetWorkflowBlocks()
    {
        var blocks = await _blockDiscovery.DiscoverByTypeAsync("workflow");
        var dtos = blocks.Select(b => BlockDto.FromDomain(b, null));
        return Ok(dtos);
    }

    /// <summary>
    /// Execute a workflow block by ID.
    /// </summary>
    [HttpPost("{id}/execute")]
    public async Task<ActionResult<WorkflowExecutionResponse>> Execute(string id, [FromBody] WorkflowExecutionRequest request)
    {
        _logger.LogInformation("Executing workflow {WorkflowId} with inputs: {Inputs}", id, request.Inputs?.Keys);

        // Find the workflow block
        var workflowBlock = await _blockDiscovery.GetByIdAsync(id);
        if (workflowBlock == null)
        {
            // Try with -workflow suffix
            workflowBlock = await _blockDiscovery.GetByIdAsync($"{id}-workflow");
        }

        if (workflowBlock == null || !workflowBlock.BlockType.Equals("workflow", StringComparison.OrdinalIgnoreCase))
        {
            return NotFound(new { error = $"Workflow '{id}' not found" });
        }

        try
        {
            // Parse nodes and connections from the workflow config
            var config = workflowBlock.Config;
            if (config == null || !config.ContainsKey("nodes") || !config.ContainsKey("connections"))
            {
                return BadRequest(new { error = "Workflow does not have nodes or connections defined" });
            }

            // Parse nodes - resolve block references
            var nodesJson = config["nodes"];
            var connectionsJson = config["connections"];

            var nodesList = ParseNodes(nodesJson);
            var connectionsList = ParseConnections(connectionsJson);

            // Resolve block references to actual block definitions
            var resolvedBlocks = new List<BlockDefinition>();
            foreach (var node in nodesList)
            {
                var blockRef = node.BlockRef;
                if (string.IsNullOrEmpty(blockRef))
                {
                    return BadRequest(new { error = $"Node '{node.Id}' does not have a blockRef" });
                }

                // Try to find the referenced block
                var referencedBlock = await ResolveBlockRefAsync(blockRef);
                if (referencedBlock == null)
                {
                    return BadRequest(new { error = $"Block reference '{blockRef}' not found for node '{node.Id}'" });
                }

                // Create a copy of the block with the node's ID
                var nodeBlock = BlockDefinition.Create(node.Id, referencedBlock.Name, referencedBlock.BlockType);

                // Merge config: start with referenced block's config, then overlay node-specific config
                var mergedConfig = new Dictionary<string, object?>(referencedBlock.Config ?? new Dictionary<string, object?>());
                if (node.Config != null)
                {
                    foreach (var kv in node.Config)
                    {
                        mergedConfig[kv.Key] = kv.Value;
                    }
                }
                nodeBlock.UpdateConfig(mergedConfig);
                nodeBlock.UpdateMetadata(referencedBlock.Metadata ?? new Dictionary<string, object>());

                resolvedBlocks.Add(nodeBlock);
            }

            // Create ConnectionDefinition objects
            var resolvedConnections = connectionsList.Select(c => new ConnectionDefinition
            {
                FromBlockId = c.From,
                ToBlockId = c.To,
                FromPort = c.FromPort ?? "default",
                ToPort = c.ToPort ?? "default"
            }).ToList();

            // Create workflow definition
            var workflowDef = new WorkflowDefinition(
                id,
                resolvedBlocks,
                resolvedConnections
            );

            // Execute the workflow
            var inputs = request.Inputs ?? new Dictionary<string, object>();

            // Add workingDir from request if provided
            if (!string.IsNullOrEmpty(request.WorkingDirectory) && !inputs.ContainsKey("workingDir"))
            {
                inputs["workingDir"] = request.WorkingDirectory;
            }

            var result = await _workflowExecutor.ExecuteAsync(workflowDef, inputs);

            return Ok(new WorkflowExecutionResponse
            {
                Success = result.Success,
                Outputs = result.Outputs,
                Error = result.Error
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Workflow execution failed for {WorkflowId}", id);
            return StatusCode(500, new { error = $"Workflow execution failed: {ex.Message}" });
        }
    }

    private async Task<BlockDefinition?> ResolveBlockRefAsync(string blockRef)
    {
        // blockRef can be like "tools/git-diff" or just "git-diff"
        // Try the exact ref first
        var block = await _blockDiscovery.GetByIdAsync(blockRef);
        if (block != null) return block;

        // Try the last part (e.g., "git-diff" from "tools/git-diff")
        var parts = blockRef.Split('/');
        if (parts.Length > 1)
        {
            block = await _blockDiscovery.GetByIdAsync(parts[^1]);
            if (block != null) return block;
        }

        // Try removing any suffix like ".tool" or ".inference"
        var baseName = blockRef.Replace("tools/", "").Replace("inference/", "");
        block = await _blockDiscovery.GetByIdAsync(baseName);

        return block;
    }

    private List<WorkflowNode> ParseNodes(object nodesObj)
    {
        var nodes = new List<WorkflowNode>();

        if (nodesObj is JsonElement jsonElement)
        {
            foreach (var node in jsonElement.EnumerateArray())
            {
                var workflowNode = new WorkflowNode
                {
                    Id = node.GetProperty("id").GetString() ?? string.Empty,
                    BlockRef = node.TryGetProperty("blockRef", out var blockRefEl) ? blockRefEl.GetString() : null
                };

                if (node.TryGetProperty("config", out var configEl))
                {
                    workflowNode.Config = JsonSerializer.Deserialize<Dictionary<string, object>>(configEl.GetRawText());
                }

                nodes.Add(workflowNode);
            }
        }

        return nodes;
    }

    private List<WorkflowConnection> ParseConnections(object connectionsObj)
    {
        var connections = new List<WorkflowConnection>();

        if (connectionsObj is JsonElement jsonElement)
        {
            foreach (var conn in jsonElement.EnumerateArray())
            {
                connections.Add(new WorkflowConnection
                {
                    From = conn.GetProperty("from").GetString() ?? string.Empty,
                    To = conn.GetProperty("to").GetString() ?? string.Empty,
                    FromPort = conn.TryGetProperty("fromPort", out var fpEl) ? fpEl.GetString() : null,
                    ToPort = conn.TryGetProperty("toPort", out var tpEl) ? tpEl.GetString() : null
                });
            }
        }

        return connections;
    }

    private class WorkflowNode
    {
        public string Id { get; set; } = string.Empty;
        public string? BlockRef { get; set; }
        public Dictionary<string, object>? Config { get; set; }
    }

    private class WorkflowConnection
    {
        public string From { get; set; } = string.Empty;
        public string To { get; set; } = string.Empty;
        public string? FromPort { get; set; }
        public string? ToPort { get; set; }
    }
}

/// <summary>
/// Request model for workflow execution.
/// </summary>
public class WorkflowExecutionRequest
{
    public Dictionary<string, object>? Inputs { get; set; }
    public string? WorkingDirectory { get; set; }
}

/// <summary>
/// Response model for workflow execution.
/// </summary>
public class WorkflowExecutionResponse
{
    public bool Success { get; set; }
    public Dictionary<string, object>? Outputs { get; set; }
    public string? Error { get; set; }
}
