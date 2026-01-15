using Microsoft.AspNetCore.Mvc;
using Maestro.Application.DTOs;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using System.Reflection;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Maestro.Api.Controllers
{
    /// <summary>
    /// Discovery API endpoints for block discovery and system capabilities.
    /// Provides metadata about available blocks, block types, and system configuration.
    /// </summary>
    [ApiController]
    [Route("api/discovery")]
    public class DiscoveryController : ControllerBase
    {
        private readonly IBlockDiscoveryService _discoveryService;
        private readonly IBlockRepository _blockRepository;
        private readonly IConfiguration _configuration;
        private static readonly DateTime StartTime = DateTime.UtcNow;

        /// <summary>
        /// Initializes a new instance of the DiscoveryController.
        /// </summary>
        public DiscoveryController(
            IBlockDiscoveryService discoveryService,
            IBlockRepository blockRepository,
            IConfiguration configuration)
        {
            _discoveryService = discoveryService ?? throw new ArgumentNullException(nameof(discoveryService));
            _blockRepository = blockRepository ?? throw new ArgumentNullException(nameof(blockRepository));
            _configuration = configuration ?? throw new ArgumentNullException(nameof(configuration));
        }

        /// <summary>
        /// Get health status of the backend service.
        /// Returns system uptime, block count, and service status.
        /// </summary>
        /// <returns>Health status response.</returns>
        [HttpGet("health")]
        public async Task<ActionResult<HealthResponse>> GetHealth()
        {
            try
            {
                var blocks = await _discoveryService.DiscoverAllAsync();
                var blockCount = blocks?.Count() ?? 0;

                return Ok(new HealthResponse
                {
                    Status = "healthy",
                    Version = Assembly.GetExecutingAssembly().GetName().Version?.ToString() ?? "1.0.0",
                    Uptime = DateTime.UtcNow - StartTime,
                    BlockCount = blockCount,
                    Services = new Dictionary<string, string>
                    {
                        ["BlockDiscovery"] = "active",
                        ["SignalR"] = "enabled"
                    }
                });
            }
            catch
            {
                return StatusCode(503, new HealthResponse
                {
                    Status = "unhealthy",
                    Version = Assembly.GetExecutingAssembly().GetName().Version?.ToString() ?? "1.0.0",
                    Uptime = DateTime.UtcNow - StartTime,
                    BlockCount = 0,
                    Services = new Dictionary<string, string>
                    {
                        ["BlockDiscovery"] = "unavailable",
                        ["SignalR"] = "unavailable"
                    }
                });
            }
        }

        /// <summary>
        /// Get system capabilities including block types and features.
        /// Lists available executors, LLM providers, and supported features.
        /// </summary>
        /// <returns>Capabilities response with available block types and features.</returns>
        [HttpGet("capabilities")]
        public ActionResult<CapabilitiesResponse> GetCapabilities()
        {
            var blockTypes = new List<BlockTypeInfo>
            {
                new BlockTypeInfo
                {
                    Type = "Agent",
                    DisplayName = "Agent",
                    Description = "AI agent that can perform tasks",
                    Icon = "🤖",
                    Color = "#4A90E2",
                    Category = "Core",
                    CanContain = new List<string> { "Prompt", "Tool", "Decision" },
                    RequiredFields = new List<string> { "name", "type" },
                    DefaultConfig = new { role = "assistant" }
                },
                new BlockTypeInfo
                {
                    Type = "Workflow",
                    DisplayName = "Workflow",
                    Description = "Orchestration of multiple blocks",
                    Icon = "🔄",
                    Color = "#50C878",
                    Category = "Core",
                    CanContain = new List<string> { "Agent", "Decision", "Tool" },
                    RequiredFields = new List<string> { "name" },
                    DefaultConfig = new { timeout = 300 }
                },
                new BlockTypeInfo
                {
                    Type = "Tool",
                    DisplayName = "Tool",
                    Description = "Executable tool or utility",
                    Icon = "🔧",
                    Color = "#F39C12",
                    Category = "Utility",
                    CanContain = new List<string>(),
                    RequiredFields = new List<string> { "name", "command" },
                    DefaultConfig = new { timeout = 60 }
                },
                new BlockTypeInfo
                {
                    Type = "Prompt",
                    DisplayName = "Prompt",
                    Description = "LLM prompt template",
                    Icon = "💬",
                    Color = "#9B59B6",
                    Category = "LLM",
                    CanContain = new List<string>(),
                    RequiredFields = new List<string> { "name", "template" },
                    DefaultConfig = new { model = "gpt-4", temperature = 0.7 }
                },
                new BlockTypeInfo
                {
                    Type = "Decision",
                    DisplayName = "Decision",
                    Description = "Branching logic",
                    Icon = "🔀",
                    Color = "#E74C3C",
                    Category = "Logic",
                    CanContain = new List<string> { "Agent", "Tool" },
                    RequiredFields = new List<string> { "name", "condition" },
                    DefaultConfig = new { mode = "if-then-else" }
                }
            };

            var response = new CapabilitiesResponse
            {
                BlockTypes = blockTypes,
                Executors = new List<string> { "PromptExecutor", "InferenceExecutor", "ToolExecutor", "WorkflowExecutor" },
                LLMProviders = new List<string> { "OpenAI", "Anthropic", "Ollama" },
                Features = new List<string> 
                { 
                    "hot-reload",
                    "signalr-events",
                    "workflow-execution",
                    "block-discovery",
                    "concurrent-execution"
                }
            };

            return Ok(response);
        }

        /// <summary>
        /// Get current system configuration.
        /// Returns block search paths, timeouts, and other configuration.
        /// </summary>
        /// <returns>Configuration response.</returns>
        [HttpGet("config")]
        public ActionResult<ConfigResponse> GetConfig()
        {
            var searchPaths = new List<string>
            {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".maestro", "blocks"),
                Path.Combine(AppContext.BaseDirectory, "blocks"),
                Path.Combine(Directory.GetCurrentDirectory(), ".maestro", "blocks")
            };

            var response = new ConfigResponse
            {
                BlockSearchPaths = searchPaths,
                DefaultLLMProvider = _configuration["LLM:DefaultProvider"] ?? "OpenAI",
                ExecutionTimeout = TimeSpan.FromSeconds(int.Parse(_configuration["Execution:Timeout"] ?? "300")),
                MaxConcurrentExecutions = int.Parse(_configuration["Execution:MaxConcurrent"] ?? "10"),
                SignalREnabled = true
            };

            return Ok(response);
        }

        /// <summary>
        /// Get metadata about all available block types.
        /// Returns type information, capabilities, and default configurations.
        /// </summary>
        /// <returns>List of block type information.</returns>
        [HttpGet("blocks/types")]
        public ActionResult<List<BlockTypeInfo>> GetBlockTypes()
        {
            var blockTypes = new List<BlockTypeInfo>
            {
                new BlockTypeInfo
                {
                    Type = "Agent",
                    DisplayName = "Agent",
                    Description = "AI agent that can perform tasks",
                    Icon = "🤖",
                    Color = "#4A90E2",
                    Category = "Core",
                    CanContain = new List<string> { "Prompt", "Tool", "Decision" },
                    RequiredFields = new List<string> { "name", "type" },
                    DefaultConfig = new { role = "assistant" }
                },
                new BlockTypeInfo
                {
                    Type = "Workflow",
                    DisplayName = "Workflow",
                    Description = "Orchestration of multiple blocks",
                    Icon = "🔄",
                    Color = "#50C878",
                    Category = "Core",
                    CanContain = new List<string> { "Agent", "Decision", "Tool" },
                    RequiredFields = new List<string> { "name" },
                    DefaultConfig = new { timeout = 300 }
                },
                new BlockTypeInfo
                {
                    Type = "Tool",
                    DisplayName = "Tool",
                    Description = "Executable tool or utility",
                    Icon = "🔧",
                    Color = "#F39C12",
                    Category = "Utility",
                    CanContain = new List<string>(),
                    RequiredFields = new List<string> { "name", "command" },
                    DefaultConfig = new { timeout = 60 }
                },
                new BlockTypeInfo
                {
                    Type = "Prompt",
                    DisplayName = "Prompt",
                    Description = "LLM prompt template",
                    Icon = "💬",
                    Color = "#9B59B6",
                    Category = "LLM",
                    CanContain = new List<string>(),
                    RequiredFields = new List<string> { "name", "template" },
                    DefaultConfig = new { model = "gpt-4", temperature = 0.7 }
                },
                new BlockTypeInfo
                {
                    Type = "Decision",
                    DisplayName = "Decision",
                    Description = "Branching logic",
                    Icon = "🔀",
                    Color = "#E74C3C",
                    Category = "Logic",
                    CanContain = new List<string> { "Agent", "Tool" },
                    RequiredFields = new List<string> { "name", "condition" },
                    DefaultConfig = new { mode = "if-then-else" }
                }
            };

            return Ok(blockTypes);
        }

        /// <summary>
        /// Get all discovered blocks from the filesystem.
        /// Supports optional filtering by type or capability.
        /// </summary>
        /// <param name="type">Optional: Filter by block type</param>
        /// <param name="capability">Optional: Filter by capability</param>
        /// <returns>List of discovered blocks.</returns>
        [HttpGet("blocks")]
        public async Task<ActionResult<List<BlockDto>>> GetBlocks(
            [FromQuery] string? type = null,
            [FromQuery] string? capability = null)
        {
            try
            {
                var allBlocks = await _discoveryService.DiscoverAllAsync();
                var blockList = allBlocks?.ToList() ?? new List<BlockDefinition>();

                // Filter by type if specified
                if (!string.IsNullOrEmpty(type))
                {
                    blockList = blockList.Where(b => b.BlockType == type).ToList();
                }

                // Filter by capability if specified
                if (!string.IsNullOrEmpty(capability))
                {
                    blockList = blockList.Where(b => b.Capabilities.Contains(capability, StringComparer.OrdinalIgnoreCase)).ToList();
                }

                var blockDtos = blockList
                    .OrderBy(b => b.Name)
                    .Select(b => BlockDto.FromDomain(b))
                    .ToList();

                return Ok(blockDtos);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = "Failed to discover blocks", details = ex.Message });
            }
        }

        /// <summary>
        /// Get blocks filtered by type.
        /// </summary>
        /// <param name="type">Block type to filter by.</param>
        /// <returns>List of blocks matching the type.</returns>
        [HttpGet("blocks/by-type/{type}")]
        public async Task<ActionResult<List<BlockDto>>> GetBlocksByType(string type)
        {
            try
            {
                var blocks = await _discoveryService.DiscoverByTypeAsync(type);
                var blockList = blocks?.ToList() ?? new List<BlockDefinition>();
                var blockDtos = blockList
                    .OrderBy(b => b.Name)
                    .Select(b => BlockDto.FromDomain(b))
                    .ToList();

                return Ok(blockDtos);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = $"Failed to discover blocks of type '{type}'", details = ex.Message });
            }
        }

        /// <summary>
        /// Get blocks filtered by capability.
        /// </summary>
        /// <param name="capability">Capability to filter by.</param>
        /// <returns>List of blocks with the specified capability.</returns>
        [HttpGet("blocks/by-capability/{capability}")]
        public async Task<ActionResult<List<BlockDto>>> GetBlocksByCapability(string capability)
        {
            try
            {
                var allBlocks = await _discoveryService.DiscoverAllAsync();
                var filtered = (allBlocks?.Where(b => b.Capabilities.Contains(capability, StringComparer.OrdinalIgnoreCase)) ?? Enumerable.Empty<BlockDefinition>())
                    .OrderBy(b => b.Name)
                    .Select(b => BlockDto.FromDomain(b))
                    .ToList();

                return Ok(filtered);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = $"Failed to filter blocks by capability '{capability}'", details = ex.Message });
            }
        }

        /// <summary>
        /// Search blocks by name or description.
        /// Supports fuzzy matching on block names and descriptions.
        /// </summary>
        /// <param name="q">Search query.</param>
        /// <returns>List of matching blocks.</returns>
        [HttpGet("blocks/search")]
        public async Task<ActionResult<List<BlockDto>>> SearchBlocks([FromQuery] string? q = null)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(q))
                {
                    return BadRequest(new { error = "Search query 'q' is required" });
                }

                var allBlocks = await _discoveryService.DiscoverAllAsync();
                var query = q.ToLowerInvariant();

                var results = (allBlocks ?? Enumerable.Empty<BlockDefinition>())
                    .Where(b => 
                        b.Name.Contains(query, StringComparison.OrdinalIgnoreCase) ||
                        b.Description.Contains(query, StringComparison.OrdinalIgnoreCase) ||
                        b.BlockType.Contains(query, StringComparison.OrdinalIgnoreCase) ||
                        (b.Capabilities?.Any(c => c.Contains(query, StringComparison.OrdinalIgnoreCase)) ?? false))
                    .OrderBy(b => b.Name)
                    .Select(b => BlockDto.FromDomain(b))
                    .ToList();

                return Ok(results);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = "Failed to search blocks", details = ex.Message });
            }
        }
    }
}
