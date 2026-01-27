using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Maestro.Application.Interfaces;
using Maestro.Application.DTOs;
using Maestro.Infrastructure.BlockExecutors;

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

        public BlocksController(
            IBlockDiscoveryService discovery,
            IBlockRepository repository,
            Maestro.Application.Interfaces.IBlockValidator validator,
            BlockExecutorRegistry executorRegistry)
        {
            _discovery = discovery;
            _repository = repository;
            _validator = validator;
            _executorRegistry = executorRegistry;
        }

        /// <summary>
        /// List all blocks with optional filtering.
        /// </summary>
        /// <param name="type">Filter by block type (e.g., "prompt", "tool")</param>
        /// <param name="capability">Filter by capability</param>
        /// <param name="search">Search in name and description</param>
        [HttpGet]
        public async Task<ActionResult<List<BlockDto>>> GetBlocks(
            [FromQuery] string? type = null,
            [FromQuery] string? capability = null,
            [FromQuery] string? search = null)
        {
            var blocks = await _discovery.DiscoverAllAsync();
            
            // Apply filters
            if (!string.IsNullOrEmpty(type))
            {
                blocks = blocks.Where(b => b.BlockType.Equals(type, System.StringComparison.OrdinalIgnoreCase));
            }
            
            if (!string.IsNullOrEmpty(capability))
            {
                blocks = blocks.Where(b => b.Capabilities.Contains(capability));
            }
            
            if (!string.IsNullOrEmpty(search))
            {
                blocks = blocks.Where(b => 
                    b.Name.Contains(search, System.StringComparison.OrdinalIgnoreCase) ||
                    b.Description.Contains(search, System.StringComparison.OrdinalIgnoreCase));
            }
            
            var dtos = blocks.Select(b =>
            {
                var path = _repository.GetBlockPathAsync(b.Id).Result;
                return BlockDto.FromDomain(b, path);
            }).ToList();
            
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

            // Update properties
            if (!string.IsNullOrEmpty(request.Name))
            {
                existing = Domain.Entities.BlockDefinition.Create(
                    existing.Id, 
                    request.Name, 
                    existing.BlockType);
            }
            
            // Update metadata
            var metadata = existing.Metadata ?? new Dictionary<string, object>();
            if (!string.IsNullOrEmpty(request.Description))
                metadata["description"] = request.Description;
            if (request.Tags != null)
                metadata["tags"] = request.Tags;
            
            existing.UpdateMetadata(metadata);
            
            // Update config
            if (request.Config != null)
            {
                var configDict = JsonSerializer.Deserialize<Dictionary<string, object>>(
                    request.Config.RootElement.GetRawText());
                if (configDict != null)
                    existing.UpdateConfig(configDict);
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
        /// Advanced search for blocks.
        /// </summary>
        [HttpGet("search")]
        public async Task<ActionResult<List<BlockDto>>> SearchBlocks(
            [FromQuery] string q,
            [FromQuery] string? type = null,
            [FromQuery] string? capability = null,
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
            {
                blocks = blocks.Where(b => b.BlockType.Equals(type, System.StringComparison.OrdinalIgnoreCase));
            }
            
            if (!string.IsNullOrEmpty(capability))
            {
                blocks = blocks.Where(b => b.Capabilities.Contains(capability));
            }
            
            // Apply limit
            blocks = blocks.Take(limit);
            
            var dtos = blocks.Select(b =>
            {
                var path = _repository.GetBlockPathAsync(b.Id).Result;
                return BlockDto.FromDomain(b, path);
            }).ToList();
            
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
            var full = System.IO.Path.Combine(blockPath, filePath);
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
            var full = System.IO.Path.Combine(blockPath, filePath);
            var dir = System.IO.Path.GetDirectoryName(full);
            if (!System.IO.Directory.Exists(dir)) System.IO.Directory.CreateDirectory(dir!);
            await System.IO.File.WriteAllTextAsync(full, content);
            return NoContent();
        }

        /// <summary>
        /// Execute a block with the given inputs.
        /// </summary>
        [HttpPost("{id}/execute")]
        public async Task<ActionResult<Application.DTOs.BlockExecutionResult>> Execute(string id, [FromBody] BlockExecutionRequest request)
        {
            var block = await _discovery.GetByIdAsync(id);
            if (block == null)
                return NotFound(new { error = $"Block '{id}' not found" });

            // Get the appropriate executor for this block type
            var executor = _executorRegistry.Get(block.BlockType);
            if (executor == null)
                return BadRequest(new { error = $"No executor found for block type '{block.BlockType}'" });

            try
            {
                // Create execution context
                var context = Domain.Entities.ExecutionContext.Create($"block-{id}");

                // Prepare inputs, including workingDir if provided
                var inputs = request.Inputs ?? new Dictionary<string, object>();
                if (!string.IsNullOrEmpty(request.WorkingDirectory))
                {
                    inputs["workingDir"] = request.WorkingDirectory;
                }

                var result = await executor.ExecuteAsync(block, context, inputs);

                return Ok(result);
            }
            catch (System.Exception ex)
            {
                return StatusCode(500, new { error = $"Execution failed: {ex.Message}" });
            }
        }
    }

    /// <summary>
    /// Request model for block execution.
    /// </summary>
    public class BlockExecutionRequest
    {
        public Dictionary<string, object>? Inputs { get; set; }
        public string? WorkingDirectory { get; set; }
    }
}
