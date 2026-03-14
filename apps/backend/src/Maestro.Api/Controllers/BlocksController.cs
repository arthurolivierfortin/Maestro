using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Maestro.Application.Interfaces;
using Maestro.Application.DTOs;
using Maestro.Infrastructure.BlockExecutors;
using Maestro.Infrastructure.Runs;

namespace Maestro.Api.Controllers
{
    /// <summary>
    /// API controller for block CRUD operations.
    /// Provides single source of truth for all block operations.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class BlocksController : ControllerBase
    {
        private readonly IBlockDiscoveryService _discovery;
        private readonly IBlockRepository _repository;
        private readonly Maestro.Application.Interfaces.IBlockValidator _validator;
        private readonly BlockExecutorRegistry _executorRegistry;
        private readonly RunTracker _runTracker;
        private readonly IBlockDependencyService _dependencyService;

        public BlocksController(
            IBlockDiscoveryService discovery,
            IBlockRepository repository,
            Maestro.Application.Interfaces.IBlockValidator validator,
            BlockExecutorRegistry executorRegistry,
            RunTracker runTracker,
            IBlockDependencyService dependencyService)
        {
            _discovery = discovery;
            _repository = repository;
            _validator = validator;
            _executorRegistry = executorRegistry;
            _runTracker = runTracker;
            _dependencyService = dependencyService;
        }

        /// <summary>
        /// List all blocks with optional filtering.
        /// </summary>
        /// <param name="type">Filter by block type (e.g., "prompt", "tool", "agent", "workflow")</param>
        /// <param name="designation">Filter by functional designation ("agent", "tool")</param>
        /// <param name="category">Filter by category (e.g., "git", "code")</param>
        /// <param name="capability">Filter by capability</param>
        /// <param name="search">Search in name and description</param>
        [HttpGet]
        public async Task<ActionResult<List<BlockDto>>> GetBlocks(
            [FromQuery] string? type = null,
            [FromQuery] string? designation = null,
            [FromQuery] string? category = null,
            [FromQuery] string? capability = null,
            [FromQuery] string? contract = null,
            [FromQuery] string? search = null)
        {
            var blocks = await _discovery.DiscoverAllAsync();

            // Apply filters
            if (!string.IsNullOrEmpty(type))
            {
                blocks = blocks.Where(b => b.BlockType.Equals(type, System.StringComparison.OrdinalIgnoreCase));
            }

            if (!string.IsNullOrEmpty(designation))
            {
                blocks = blocks.Where(b => string.Equals(b.Designation, designation, System.StringComparison.OrdinalIgnoreCase));
            }

            if (!string.IsNullOrEmpty(category))
            {
                blocks = blocks.Where(b => string.Equals(b.Category, category, System.StringComparison.OrdinalIgnoreCase));
            }

            if (!string.IsNullOrEmpty(capability))
            {
                blocks = blocks.Where(b => b.Capabilities.Contains(capability));
            }

            if (!string.IsNullOrEmpty(contract))
            {
                blocks = blocks.Where(b => string.Equals(b.Contract, contract, System.StringComparison.OrdinalIgnoreCase));
            }

            if (!string.IsNullOrEmpty(search))
            {
                blocks = blocks.Where(b =>
                    (b.Name ?? "").Contains(search, System.StringComparison.OrdinalIgnoreCase) ||
                    (b.Description ?? "").Contains(search, System.StringComparison.OrdinalIgnoreCase));
            }

            var dtos = new List<BlockDto>();
            foreach (var b in blocks)
            {
                var path = await _repository.GetBlockPathAsync(b.Id);
                dtos.Add(BlockDto.FromDomain(b, path));
            }

            return Ok(dtos);
        }

        /// <summary>
        /// Get a single block by ID.
        /// </summary>
        [HttpGet("{id}")]
        public async Task<ActionResult<BlockDto>> GetById(string id)
        {
            var block = await _discovery.GetByIdAsync(id);
            if (block == null) return NotFound(new { error = $"Block '{id}' not found" });
            
            var path = await _repository.GetBlockPathAsync(id);
            var dto = BlockDto.FromDomain(block, path);
            return Ok(dto);
        }

        /// <summary>
        /// Create a new block.
        /// </summary>
        [HttpPost]
        public async Task<ActionResult<BlockDto>> Create([FromBody] CreateBlockRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Name))
                return BadRequest(new { error = "Name is required" });
            
            if (string.IsNullOrWhiteSpace(request.BlockType))
                return BadRequest(new { error = "BlockType is required" });

            // Generate ID from name if not provided
            var id = request.Name.ToLowerInvariant().Replace(" ", "-");
            
            // Check if block already exists
            var existing = await _repository.GetByIdAsync(id);
            if (existing != null)
                return Conflict(new { error = $"Block '{id}' already exists" });

            // Create block entity
            var block = Domain.Entities.BlockDefinition.Create(id, request.Name, request.BlockType);
            block.UpdateMetadata(new Dictionary<string, object>
            {
                ["description"] = request.Description ?? string.Empty,
                ["tags"] = request.Tags ?? new List<string>()
            });
            
            if (request.Config != null)
            {
                var configDict = JsonSerializer.Deserialize<Dictionary<string, object>>(
                    request.Config.RootElement.GetRawText());
                if (configDict != null)
                    block.UpdateConfig(configDict);
            }

            // Save block
            await _repository.SaveAsync(block);
            
            var path = await _repository.GetBlockPathAsync(id);
            var dto = BlockDto.FromDomain(block, path);
            
            return CreatedAtAction(nameof(GetById), new { id = block.Id }, dto);
        }

        /// <summary>
        /// Update an existing block.
        /// </summary>
        [HttpPut("{id}")]
        public async Task<ActionResult<BlockDto>> Update(string id, [FromBody] UpdateBlockRequest request)
        {
            var existing = await _repository.GetByIdAsync(id);
            if (existing == null) 
                return NotFound(new { error = $"Block '{id}' not found" });

            // Update name in-place (preserves all existing state)
            if (!string.IsNullOrEmpty(request.Name))
            {
                existing.SetName(request.Name);
            }

            // Update metadata (merge, not replace)
            var metadata = existing.Metadata ?? new Dictionary<string, object>();
            if (!string.IsNullOrEmpty(request.Description))
                metadata["description"] = request.Description;
            if (request.Tags != null)
                metadata["tags"] = request.Tags;

            existing.UpdateMetadata(metadata);

            // Merge config (only overwrite keys present in request, preserve existing keys)
            if (request.Config != null)
            {
                var newConfigDict = JsonSerializer.Deserialize<Dictionary<string, object>>(
                    request.Config.RootElement.GetRawText());
                if (newConfigDict != null)
                {
                    var existingConfig = existing.Config ?? new Dictionary<string, object>();
                    foreach (var kvp in newConfigDict)
                    {
                        existingConfig[kvp.Key] = kvp.Value;
                    }
                    existing.UpdateConfig(existingConfig);
                }
            }

            await _repository.SaveAsync(existing);
            
            var path = await _repository.GetBlockPathAsync(id);
            var dto = BlockDto.FromDomain(existing, path);
            return Ok(dto);
        }

        /// <summary>
        /// Delete a block.
        /// </summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(string id)
        {
            var existing = await _repository.GetByIdAsync(id);
            if (existing == null)
                return NotFound(new { error = $"Block '{id}' not found" });

            await _repository.DeleteAsync(id);
            return NoContent();
        }

        /// <summary>
        /// Get children of a composite (non-atomic) block.
        /// Returns the hierarchy of child blocks down to the most atomic level.
        /// </summary>
        [HttpGet("{id}/children")]
        public async Task<ActionResult<BlockChildrenResponse>> GetChildren(string id, [FromQuery] bool recursive = true)
        {
            var block = await _discovery.GetByIdAsync(id);
            if (block == null)
                return NotFound(new { error = $"Block '{id}' not found" });

            if (block.IsAtomic)
                return Ok(new BlockChildrenResponse
                {
                    BlockId = id,
                    BlockName = block.Name,
                    BlockType = block.BlockType,
                    IsAtomic = true,
                    Children = new List<BlockChildInfo>()
                });

            var children = await GetBlockChildrenAsync(block, recursive);
            var (total, atomic, composite) = CountChildren(children);
            return Ok(new BlockChildrenResponse
            {
                BlockId = id,
                BlockName = block.Name,
                BlockType = block.BlockType,
                IsAtomic = false,
                TotalChildren = total,
                AtomicCount = atomic,
                CompositeCount = composite,
                Children = children
            });
        }

        private async Task<List<BlockChildInfo>> GetBlockChildrenAsync(Domain.Entities.BlockDefinition block, bool recursive)
        {
            var children = new List<BlockChildInfo>();

            // Extract node references from config
            if (block.Config != null && block.Config.TryGetValue("nodes", out var nodesObj))
            {
                IEnumerable<System.Text.Json.JsonElement>? nodes = null;

                if (nodesObj is System.Text.Json.JsonElement jsonElement && jsonElement.ValueKind == System.Text.Json.JsonValueKind.Array)
                {
                    nodes = jsonElement.EnumerateArray();
                }

                if (nodes != null)
                {
                    foreach (var node in nodes)
                    {
                        var nodeId = node.TryGetProperty("id", out var idProp) ? idProp.GetString() : null;
                        var nodeName = node.TryGetProperty("name", out var nameProp) ? nameProp.GetString() : nodeId;
                        var blockRef = node.TryGetProperty("blockRef", out var refProp) ? refProp.GetString() : null;
                        var nodeType = node.TryGetProperty("type", out var typeProp) ? typeProp.GetString() : null;

                        // Extract model overrides from node.config
                        string? nodeModel = null;
                        string? nodePlanningModel = null;
                        if (node.TryGetProperty("config", out var nodeConfig) && nodeConfig.ValueKind == System.Text.Json.JsonValueKind.Object)
                        {
                            if (nodeConfig.TryGetProperty("model", out var modelProp) && modelProp.ValueKind == System.Text.Json.JsonValueKind.String)
                                nodeModel = modelProp.GetString();
                            if (nodeConfig.TryGetProperty("planningModel", out var planModelProp) && planModelProp.ValueKind == System.Text.Json.JsonValueKind.String)
                                nodePlanningModel = planModelProp.GetString();
                        }

                        var childInfo = new BlockChildInfo
                        {
                            NodeId = nodeId ?? "unknown",
                            NodeName = nodeName ?? "unknown",
                            BlockRef = blockRef,
                            NodeType = nodeType ?? (blockRef != null ? "block-reference" : "inline"),
                            Model = nodeModel,
                            PlanningModel = nodePlanningModel
                        };

                        // If it's a block reference, try to resolve it
                        if (!string.IsNullOrEmpty(blockRef))
                        {
                            // Parse blockRef (format: "category/block-id" or just "block-id")
                            var refId = blockRef.Contains('/') ? blockRef.Split('/').Last() : blockRef;
                            var referencedBlock = await _discovery.GetByIdAsync(refId);

                            if (referencedBlock != null)
                            {
                                childInfo.ResolvedBlockId = referencedBlock.Id;
                                childInfo.ResolvedBlockName = referencedBlock.Name;
                                childInfo.ResolvedBlockType = referencedBlock.BlockType;
                                childInfo.IsAtomic = referencedBlock.IsAtomic;

                                // Recursively get children if not atomic and recursive is true
                                if (recursive && !referencedBlock.IsAtomic)
                                {
                                    childInfo.Children = await GetBlockChildrenAsync(referencedBlock, recursive);
                                }
                            }
                        }

                        children.Add(childInfo);
                    }
                }
            }

            return children;
        }

        private (int total, int atomic, int composite) CountChildren(List<BlockChildInfo> children)
        {
            int total = 0, atomic = 0, composite = 0;

            foreach (var child in children)
            {
                total++;
                if (child.IsAtomic)
                    atomic++;
                else
                    composite++;

                if (child.Children != null && child.Children.Count > 0)
                {
                    var (subTotal, subAtomic, subComposite) = CountChildren(child.Children);
                    total += subTotal;
                    atomic += subAtomic;
                    composite += subComposite;
                }
            }

            return (total, atomic, composite);
        }

        /// <summary>
        /// Advanced search for blocks.
        /// </summary>
        [HttpGet("search")]
        public async Task<ActionResult<List<BlockDto>>> SearchBlocks(
            [FromQuery] string q,
            [FromQuery] string? type = null,
            [FromQuery] string? designation = null,
            [FromQuery] string? category = null,
            [FromQuery] string? capability = null,
            [FromQuery] string? contract = null,
            [FromQuery] int limit = 50)
        {
            var blocks = await _discovery.DiscoverAllAsync();

            // Apply search query
            if (!string.IsNullOrEmpty(q))
            {
                blocks = blocks.Where(b =>
                    b.Name.Contains(q, System.StringComparison.OrdinalIgnoreCase) ||
                    b.Description.Contains(q, System.StringComparison.OrdinalIgnoreCase) ||
                    b.Id.Contains(q, System.StringComparison.OrdinalIgnoreCase));
            }

            // Apply filters
            if (!string.IsNullOrEmpty(type))
                blocks = blocks.Where(b => b.BlockType.Equals(type, System.StringComparison.OrdinalIgnoreCase));

            if (!string.IsNullOrEmpty(designation))
                blocks = blocks.Where(b => string.Equals(b.Designation, designation, System.StringComparison.OrdinalIgnoreCase));

            if (!string.IsNullOrEmpty(category))
                blocks = blocks.Where(b => string.Equals(b.Category, category, System.StringComparison.OrdinalIgnoreCase));

            if (!string.IsNullOrEmpty(capability))
                blocks = blocks.Where(b => b.Capabilities.Contains(capability));

            if (!string.IsNullOrEmpty(contract))
                blocks = blocks.Where(b => string.Equals(b.Contract, contract, System.StringComparison.OrdinalIgnoreCase));

            // Apply limit
            blocks = blocks.Take(limit);

            var dtos = new List<BlockDto>();
            foreach (var b in blocks)
            {
                var path = await _repository.GetBlockPathAsync(b.Id);
                dtos.Add(BlockDto.FromDomain(b, path));
            }

            return Ok(dtos);
        }

        /// <summary>
        /// List available block types.
        /// </summary>
        [HttpGet("types")]
        public ActionResult<List<string>> GetBlockTypes()
        {
            var types = System.Enum.GetNames(typeof(BlockType)).ToList();
            return Ok(types);
        }

        /// <summary>
        /// Get content of a specific file within a block.
        /// </summary>
        [HttpGet("{id}/content/{*filePath}")]
        public async Task<IActionResult> GetContent(string id, string filePath)
        {
            var blockPath = await _repository.GetBlockPathAsync(id);
            if (blockPath == null) return NotFound();
            var full = System.IO.Path.GetFullPath(System.IO.Path.Combine(blockPath, filePath));
            var basePath = System.IO.Path.GetFullPath(blockPath);
            if (!full.StartsWith(basePath + System.IO.Path.DirectorySeparatorChar) && full != basePath)
                return BadRequest(new { error = "Path traversal not allowed" });
            if (!System.IO.File.Exists(full)) return NotFound();
            var txt = await System.IO.File.ReadAllTextAsync(full);
            return Ok(txt);
        }

        /// <summary>
        /// Update content of a specific file within a block.
        /// </summary>
        [HttpPut("{id}/content/{*filePath}")]
        public async Task<IActionResult> PutContent(string id, string filePath, [FromBody] string content)
        {
            var blockPath = await _repository.GetBlockPathAsync(id);
            if (blockPath == null) return NotFound();
            var full = System.IO.Path.GetFullPath(System.IO.Path.Combine(blockPath, filePath));
            var basePath = System.IO.Path.GetFullPath(blockPath);
            if (!full.StartsWith(basePath + System.IO.Path.DirectorySeparatorChar) && full != basePath)
                return BadRequest(new { error = "Path traversal not allowed" });
            var dir = System.IO.Path.GetDirectoryName(full);
            if (!System.IO.Directory.Exists(dir)) System.IO.Directory.CreateDirectory(dir!);
            await System.IO.File.WriteAllTextAsync(full, content);
            return NoContent();
        }

        // ── Phase 18: Universal metrics endpoints ──

        /// <summary>
        /// Get aggregated metrics for a block.
        /// Works for any block type (inference, tool, agent, workflow).
        /// </summary>
        [HttpGet("{id}/metrics")]
        public async Task<IActionResult> GetMetrics(string id)
        {
            var block = await _discovery.GetByIdAsync(id);
            if (block == null)
                return NotFound(new { error = $"Block '{id}' not found" });

            var metrics = block.GetAggregatedMetrics();
            if (metrics == null)
                return Ok(new { message = "No metrics recorded yet", blockId = id });

            return Ok(metrics);
        }

        /// <summary>
        /// Record a run result for a block (updates aggregated metrics).
        /// Works for any block type.
        /// </summary>
        [HttpPost("{id}/runs")]
        public async Task<IActionResult> RecordRun(string id, [FromBody] RecordBlockRunRequest request)
        {
            var block = await _discovery.GetByIdAsync(id);
            if (block == null)
                return NotFound(new { error = $"Block '{id}' not found" });

            // Record the run
            block.RecordRun(request.Success, request.ExecutionTimeMs, request.TokenCost, request.Score);

            // Persist the updated block
            await _repository.SaveAsync(block);

            return Ok(new { message = "Run recorded", blockId = id, metrics = block.GetAggregatedMetrics() });
        }

        /// <summary>
        /// Get top blocks by overall score, optionally filtered by designation.
        /// </summary>
        [HttpGet("top")]
        public async Task<ActionResult<List<BlockDto>>> GetTopBlocks(
            [FromQuery] string? designation = null,
            [FromQuery] string? type = null,
            [FromQuery] int limit = 10)
        {
            var blocks = await _discovery.DiscoverAllAsync();

            if (!string.IsNullOrEmpty(designation))
                blocks = blocks.Where(b => string.Equals(b.Designation, designation, System.StringComparison.OrdinalIgnoreCase));

            if (!string.IsNullOrEmpty(type))
                blocks = blocks.Where(b => b.BlockType.Equals(type, System.StringComparison.OrdinalIgnoreCase));

            // Filter to blocks that have metrics, sort by overall score
            var ranked = blocks
                .Select(b => new { Block = b, Metrics = b.GetAggregatedMetrics() })
                .Where(x => x.Metrics != null && x.Metrics.TotalRuns > 0)
                .OrderByDescending(x => x.Metrics!.OverallScore)
                .Take(limit)
                .Select(x => x.Block);

            var dtos = new List<BlockDto>();
            foreach (var b in ranked)
            {
                var path = await _repository.GetBlockPathAsync(b.Id);
                dtos.Add(BlockDto.FromDomain(b, path));
            }

            return Ok(dtos);
        }

        /// <summary>
        /// Set or change the functional designation of a block.
        /// Promotes a regular block to "agent" or "tool" designation.
        /// </summary>
        [HttpPost("{id}/designate")]
        public async Task<IActionResult> Designate(string id, [FromBody] DesignateBlockRequest request)
        {
            var block = await _repository.GetByIdAsync(id);
            if (block == null)
                return NotFound(new { error = $"Block '{id}' not found" });

            block.SetDesignation(request.Designation);

            if (!string.IsNullOrEmpty(request.Category))
                block.SetCategory(request.Category);

            await _repository.SaveAsync(block);

            var path = await _repository.GetBlockPathAsync(id);
            return Ok(BlockDto.FromDomain(block, path));
        }

        /// <summary>
        /// Execute a block with the given inputs.
        /// All executions are automatically tracked for traceability.
        /// </summary>
        [HttpPost("{id}/execute")]
        public async Task<ActionResult<BlockExecutionResponse>> Execute(string id, [FromBody] BlockExecutionRequest request)
        {
            var block = await _discovery.GetByIdAsync(id);
            if (block == null)
                return NotFound(new { error = $"Block '{id}' not found" });

            // Get the appropriate executor for this block type
            var executor = _executorRegistry.Get(block.BlockType);
            if (executor == null)
                return BadRequest(new { error = $"No executor found for block type '{block.BlockType}'" });

            // Prepare inputs, including workingDir if provided
            var inputs = request.Inputs ?? new Dictionary<string, object>();
            if (!string.IsNullOrEmpty(request.WorkingDirectory))
            {
                inputs["workingDir"] = request.WorkingDirectory;
            }

            // Determine project info
            var projectId = request.ProjectId ?? "global";
            var projectPath = request.ProjectPath;

            // Create a run record for traceability
            var run = await _runTracker.CreateRunAsync(
                projectId,
                id,
                block.BlockType,
                inputs,
                projectPath);

            try
            {
                // Create execution context
                var context = Domain.Entities.ExecutionContext.Create($"run-{run.Id}");

                // Execute the block
                var result = await executor.ExecuteAsync(block, context, inputs);

                // Record artifacts (files created/modified) if available
                if (result.Outputs.TryGetValue("path", out var pathObj) && pathObj is string filePath)
                {
                    var fileInfo = new System.IO.FileInfo(filePath);
                    if (fileInfo.Exists)
                    {
                        await _runTracker.RecordArtifactAsync(run, filePath, "created", fileInfo.Length, projectPath);
                    }
                }

                // Calculate a basic score based on success
                var scores = new RunScores
                {
                    Overall = result.Success ? 100 : 0,
                    TaskCompletion = result.Success ? 100 : 0,
                    Efficiency = result.DurationMs < 1000 ? 100 : (result.DurationMs < 5000 ? 80 : 60)
                };

                // Complete the run
                var outputsDict = result.Outputs.ToDictionary(kv => kv.Key, kv => kv.Value);
                await _runTracker.CompleteRunAsync(
                    run,
                    result.Success ? RunStatus.Completed : RunStatus.Failed,
                    outputsDict,
                    scores,
                    projectPath);

                // Return result with run ID for traceability
                return Ok(new BlockExecutionResponse
                {
                    RunId = run.Id,
                    Outputs = result.Outputs,
                    Logs = result.Logs,
                    Success = result.Success,
                    DurationMs = result.DurationMs,
                    PromptTokens = result.PromptTokens,
                    CompletionTokens = result.CompletionTokens,
                    TotalTokens = result.TotalTokens,
                    EstimatedCostUsd = result.EstimatedCostUsd,
                    Scores = scores
                });
            }
            catch (System.Exception ex)
            {
                // Record the error
                await _runTracker.RecordErrorAsync(run, "ExecutionException", ex.Message, false, projectPath);
                await _runTracker.CompleteRunAsync(run, RunStatus.Failed, null, null, projectPath);

                return StatusCode(500, new { error = $"Execution failed: {ex.Message}", runId = run.Id });
            }
        }

        /// <summary>
        /// Gets a documentation companion file for a block.
        /// </summary>
        [HttpGet("{id}/docs/{docName}")]
        public async Task<IActionResult> GetBlockDoc(string id, string docName)
        {
            var block = await _discovery.GetByIdAsync(id);
            if (block == null)
                return NotFound(new { error = $"Block '{id}' not found" });

            var docs = block.Docs;
            if (docs == null || !docs.TryGetValue(docName.ToLowerInvariant(), out var relativePath))
                return NotFound(new { error = $"Doc '{docName}' not found for block '{id}'", availableDocs = docs?.Keys });

            // Resolve the full path relative to the block's source directory
            var sourcePath = block.Metadata.TryGetValue("_sourcePath", out var sp) ? sp?.ToString() : null;
            if (string.IsNullOrEmpty(sourcePath))
                return NotFound(new { error = "Block source path unknown" });

            var blockDir = Path.GetDirectoryName(sourcePath);
            if (blockDir == null)
                return NotFound(new { error = "Block directory unknown" });

            var fullPath = Path.Combine(blockDir, relativePath.Replace('/', Path.DirectorySeparatorChar));
            if (!System.IO.File.Exists(fullPath))
                return NotFound(new { error = $"Doc file not found: {relativePath}" });

            var content = await System.IO.File.ReadAllTextAsync(fullPath);
            return Ok(new { docName, path = relativePath, content });
        }

        /// <summary>
        /// Lists all available documentation for a block.
        /// </summary>
        [HttpGet("{id}/docs")]
        public async Task<IActionResult> ListBlockDocs(string id)
        {
            var block = await _discovery.GetByIdAsync(id);
            if (block == null)
                return NotFound(new { error = $"Block '{id}' not found" });

            var docs = block.Docs ?? new Dictionary<string, string>();
            return Ok(new { blockId = id, docs });
        }

        // ── Phase 55: Manifest / dependency endpoints ──

        /// <summary>
        /// Get the full recursive dependency manifest for a block.
        /// Walks config.nodes to resolve blockRefs and inline model overrides.
        /// </summary>
        [HttpGet("{id}/manifest")]
        public async Task<ActionResult<BlockDependencyManifest>> GetManifest(string id)
        {
            var block = await _discovery.GetByIdAsync(id);
            if (block == null)
                return NotFound(new { error = $"Block '{id}' not found" });

            var manifest = await _dependencyService.GetManifestAsync(id);
            return Ok(manifest);
        }

        /// <summary>
        /// Get a flat map of model → blockIds for all models required by a block tree.
        /// </summary>
        [HttpGet("{id}/manifest/models")]
        public async Task<ActionResult<Dictionary<string, List<string>>>> GetManifestModels(string id)
        {
            var block = await _discovery.GetByIdAsync(id);
            if (block == null)
                return NotFound(new { error = $"Block '{id}' not found" });

            var models = await _dependencyService.GetRequiredModelsAsync(id);
            return Ok(models);
        }

        /// <summary>
        /// Validate a block's dependency tree: check for missing blocks and circular references.
        /// </summary>
        [HttpGet("{id}/manifest/validate")]
        public async Task<ActionResult<DependencyValidationResult>> ValidateManifest(string id)
        {
            var block = await _discovery.GetByIdAsync(id);
            if (block == null)
                return NotFound(new { error = $"Block '{id}' not found" });

            var result = await _dependencyService.ValidateAsync(id);
            return Ok(result);
        }

        /// <summary>
        /// Get all blocks that reference this block in their config.nodes (reverse dependencies).
        /// </summary>
        [HttpGet("{id}/dependents")]
        public async Task<ActionResult<List<string>>> GetDependents(string id)
        {
            var block = await _discovery.GetByIdAsync(id);
            if (block == null)
                return NotFound(new { error = $"Block '{id}' not found" });

            var dependents = await _dependencyService.GetDependentsAsync(id);
            return Ok(dependents);
        }
    }

    /// <summary>
    /// Request model for block execution.
    /// </summary>
    public class BlockExecutionRequest
    {
        public Dictionary<string, object>? Inputs { get; set; }
        public string? WorkingDirectory { get; set; }
        public string? ProjectId { get; set; }
        public string? ProjectPath { get; set; }
    }

    /// <summary>
    /// Response model for block execution with traceability info.
    /// </summary>
    public class BlockExecutionResponse
    {
        public string RunId { get; set; } = string.Empty;
        public Dictionary<string, object?> Outputs { get; set; } = new();
        public List<string> Logs { get; set; } = new();
        public bool Success { get; set; }
        public long DurationMs { get; set; }
        public int PromptTokens { get; set; }
        public int CompletionTokens { get; set; }
        public int TotalTokens { get; set; }
        public decimal EstimatedCostUsd { get; set; }
        public RunScores? Scores { get; set; }
    }

    /// <summary>
    /// Response model for block children hierarchy.
    /// </summary>
    public class BlockChildrenResponse
    {
        public string BlockId { get; set; } = string.Empty;
        public string BlockName { get; set; } = string.Empty;
        public string BlockType { get; set; } = string.Empty;
        public bool IsAtomic { get; set; }
        public int TotalChildren { get; set; }
        public int AtomicCount { get; set; }
        public int CompositeCount { get; set; }
        public List<BlockChildInfo> Children { get; set; } = new();
    }

    /// <summary>
    /// Information about a child node within a composite block.
    /// </summary>
    public class BlockChildInfo
    {
        public string NodeId { get; set; } = string.Empty;
        public string NodeName { get; set; } = string.Empty;
        public string? BlockRef { get; set; }
        public string NodeType { get; set; } = string.Empty;
        public string? ResolvedBlockId { get; set; }
        public string? ResolvedBlockName { get; set; }
        public string? ResolvedBlockType { get; set; }
        public bool IsAtomic { get; set; } = true;
        public string? Model { get; set; }
        public string? PlanningModel { get; set; }
        public List<BlockChildInfo>? Children { get; set; }
    }

    // ── Phase 18: New request models ──

    /// <summary>
    /// Request to record a block run result.
    /// </summary>
    public class RecordBlockRunRequest
    {
        public bool Success { get; set; }
        public long ExecutionTimeMs { get; set; }
        public int TokenCost { get; set; }
        public double Score { get; set; }
    }

    /// <summary>
    /// Request to set a block's functional designation.
    /// </summary>
    public class DesignateBlockRequest
    {
        /// <summary>
        /// Designation to apply: "agent", "tool", or null to remove.
        /// </summary>
        public string? Designation { get; set; }

        /// <summary>
        /// Optional category to set (e.g., "git", "code", "analysis").
        /// </summary>
        public string? Category { get; set; }
    }
}
