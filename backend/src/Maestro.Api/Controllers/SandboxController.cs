using Microsoft.AspNetCore.Mvc;
using Maestro.Domain.Entities;
using System.Collections.Concurrent;

namespace Maestro.Api.Controllers
{
    /// <summary>
    /// Controller for managing sandbox testing environments
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class SandboxController : ControllerBase
    {
        private static readonly ConcurrentDictionary<string, Sandbox> _sandboxes = new();
        private readonly ILogger<SandboxController> _logger;

        public SandboxController(ILogger<SandboxController> logger)
        {
            _logger = logger;
        }

        /// <summary>
        /// Create a new sandbox environment
        /// </summary>
        [HttpPost("create")]
        public ActionResult<SandboxResponse> CreateSandbox([FromBody] CreateSandboxRequest request)
        {
            try
            {
                var sandbox = Sandbox.Create(
                    request.Type,
                    request.TargetId,
                    request.TargetName);

                if (request.MockedBlocks != null)
                {
                    foreach (var blockId in request.MockedBlocks)
                    {
                        sandbox.AddMockedBlock(blockId);
                    }
                }

                if (request.Configuration != null)
                {
                    sandbox.SetConfiguration(request.Configuration);
                }

                // Simulate container creation
                sandbox.SetContainerId($"container-{Guid.NewGuid():N}");
                sandbox.SetReady();
                sandbox.AddLog("info", "Sandbox created successfully");

                _sandboxes[sandbox.Id] = sandbox;

                _logger.LogInformation("Created sandbox {SandboxId} for {Type} {TargetId}",
                    sandbox.Id, sandbox.Type, sandbox.TargetId);

                return Ok(MapToResponse(sandbox));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to create sandbox");
                return BadRequest(new { error = ex.Message });
            }
        }

        /// <summary>
        /// Run a target (block/agent/tool) in a sandbox
        /// </summary>
        [HttpPost("{id}/run")]
        public ActionResult<SandboxResponse> RunSandbox(string id, [FromBody] RunSandboxRequest? request)
        {
            if (!_sandboxes.TryGetValue(id, out var sandbox))
            {
                return NotFound(new { error = "Sandbox not found" });
            }

            if (sandbox.Status != SandboxStatus.Ready && sandbox.Status != SandboxStatus.Completed)
            {
                return BadRequest(new { error = $"Sandbox cannot be run in status: {sandbox.Status}" });
            }

            try
            {
                sandbox.SetRunning();
                sandbox.AddLog("info", "Execution started");

                // Simulate execution (in a real implementation, this would run in Docker)
                Task.Run(async () =>
                {
                    await Task.Delay(2000); // Simulate execution time

                    sandbox.AddLog("info", "Processing inputs...");
                    await Task.Delay(1000);

                    sandbox.AddLog("info", "Executing target...");
                    await Task.Delay(2000);

                    // Simulate completion
                    sandbox.SetCompleted(0, new Dictionary<string, object>
                    {
                        { "output", "Execution completed successfully" },
                        { "metrics", new Dictionary<string, object>
                            {
                                { "duration_ms", 5000 },
                                { "memory_mb", 128 },
                                { "cpu_percent", 25 }
                            }
                        }
                    });
                    sandbox.AddLog("info", "Execution completed");
                });

                return Ok(MapToResponse(sandbox));
            }
            catch (Exception ex)
            {
                sandbox.SetFailed(ex.Message);
                sandbox.AddLog("error", ex.Message);
                return BadRequest(new { error = ex.Message });
            }
        }

        /// <summary>
        /// Get sandbox status
        /// </summary>
        [HttpGet("{id}/status")]
        public ActionResult<SandboxResponse> GetStatus(string id)
        {
            if (!_sandboxes.TryGetValue(id, out var sandbox))
            {
                return NotFound(new { error = "Sandbox not found" });
            }

            return Ok(MapToResponse(sandbox));
        }

        /// <summary>
        /// Get sandbox logs
        /// </summary>
        [HttpGet("{id}/logs")]
        public ActionResult<object> GetLogs(string id, [FromQuery] int? limit = null, [FromQuery] string? level = null)
        {
            if (!_sandboxes.TryGetValue(id, out var sandbox))
            {
                return NotFound(new { error = "Sandbox not found" });
            }

            var logs = sandbox.Logs.AsEnumerable();

            if (!string.IsNullOrEmpty(level))
            {
                logs = logs.Where(l => l.Level.Equals(level, StringComparison.OrdinalIgnoreCase));
            }

            if (limit.HasValue)
            {
                logs = logs.TakeLast(limit.Value);
            }

            return Ok(new { sandboxId = id, logs = logs.ToList() });
        }

        /// <summary>
        /// Destroy a sandbox
        /// </summary>
        [HttpDelete("{id}")]
        public ActionResult DestroySandbox(string id)
        {
            if (!_sandboxes.TryGetValue(id, out var sandbox))
            {
                return NotFound(new { error = "Sandbox not found" });
            }

            sandbox.SetDestroyed();
            sandbox.AddLog("info", "Sandbox destroyed");

            // Optionally remove from memory after some time
            _ = Task.Delay(TimeSpan.FromMinutes(5)).ContinueWith(__ => _sandboxes.TryRemove(id, out var removed));

            _logger.LogInformation("Destroyed sandbox {SandboxId}", id);

            return Ok(new { message = "Sandbox destroyed successfully" });
        }

        /// <summary>
        /// List all sandboxes
        /// </summary>
        [HttpGet]
        public ActionResult<IEnumerable<SandboxResponse>> ListSandboxes(
            [FromQuery] string? type = null,
            [FromQuery] string? status = null)
        {
            var sandboxes = _sandboxes.Values.AsEnumerable();

            if (!string.IsNullOrEmpty(type))
            {
                sandboxes = sandboxes.Where(s => s.Type.Equals(type, StringComparison.OrdinalIgnoreCase));
            }

            if (!string.IsNullOrEmpty(status) && Enum.TryParse<SandboxStatus>(status, true, out var statusEnum))
            {
                sandboxes = sandboxes.Where(s => s.Status == statusEnum);
            }

            return Ok(sandboxes.Select(MapToResponse).ToList());
        }

        private static SandboxResponse MapToResponse(Sandbox sandbox)
        {
            return new SandboxResponse
            {
                Id = sandbox.Id,
                ContainerId = sandbox.ContainerId,
                Type = sandbox.Type,
                TargetId = sandbox.TargetId,
                TargetName = sandbox.TargetName,
                Status = sandbox.Status.ToString().ToLower(),
                MockedBlocks = sandbox.MockedBlocks,
                Configuration = sandbox.Configuration,
                ErrorMessage = sandbox.ErrorMessage,
                CreatedAt = sandbox.CreatedAt,
                StartedAt = sandbox.StartedAt,
                CompletedAt = sandbox.CompletedAt,
                ExitCode = sandbox.ExitCode,
                Result = sandbox.Result,
                LogCount = sandbox.Logs.Count
            };
        }
    }

    // Request/Response DTOs
    public class CreateSandboxRequest
    {
        public string Type { get; set; } = "block"; // "block", "agent", "tool"
        public string TargetId { get; set; } = "";
        public string? TargetName { get; set; }
        public List<string>? MockedBlocks { get; set; }
        public Dictionary<string, object>? Configuration { get; set; }
    }

    public class RunSandboxRequest
    {
        public Dictionary<string, object>? Inputs { get; set; }
        public bool? Verbose { get; set; }
    }

    public class SandboxResponse
    {
        public string Id { get; set; } = "";
        public string? ContainerId { get; set; }
        public string Type { get; set; } = "";
        public string TargetId { get; set; } = "";
        public string? TargetName { get; set; }
        public string Status { get; set; } = "";
        public List<string> MockedBlocks { get; set; } = new();
        public Dictionary<string, object> Configuration { get; set; } = new();
        public string? ErrorMessage { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? StartedAt { get; set; }
        public DateTime? CompletedAt { get; set; }
        public int? ExitCode { get; set; }
        public Dictionary<string, object>? Result { get; set; }
        public int LogCount { get; set; }
    }
}
