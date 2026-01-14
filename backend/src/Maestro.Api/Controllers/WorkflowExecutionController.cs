using Microsoft.AspNetCore.Mvc;
using Maestro.Application.Interfaces;
using Maestro.Domain.ValueObjects;

namespace Maestro.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class WorkflowExecutionController : ControllerBase
{
    private readonly IWorkflowExecutor _executor;
    private readonly IExecutionRepository _repository;

    public WorkflowExecutionController(IWorkflowExecutor executor, IExecutionRepository repository)
    {
        _executor = executor;
        _repository = repository;
    }

    [HttpPost("{workflowId}/execute")]
    public async Task<IActionResult> Execute(string workflowId, [FromBody] Dictionary<string, object>? inputs)
    {
        // For now: load workflow definition from IWorkflowRepository or Blocks repository placeholder
        // Use a minimal WorkflowDefinition with a trigger block if available
        // This is a scaffold: in full implementation, WorkflowRepository should be used
        return Accepted();
    }

    [HttpGet("executions/{id}")]
    public async Task<IActionResult> GetExecution(string id)
    {
        if (!Guid.TryParse(id, out var gid)) return NotFound();
        var eid = Maestro.Domain.ValueObjects.ExecutionId.From(gid);
        var ctx = await _repository.GetByIdAsync(eid);
        if (ctx == null) return NotFound();
        return Ok(ctx);
    }

    [HttpPost("executions/{id}/cancel")]
    public async Task<IActionResult> Cancel(string id)
    {
        if (!Guid.TryParse(id, out var gid)) return NotFound();
        var eid = Maestro.Domain.ValueObjects.ExecutionId.From(gid);
        var ctx = await _repository.GetByIdAsync(eid);
        if (ctx == null) return NotFound();
        ctx.Cancel();
        await _repository.SaveAsync(ctx);
        return Ok();
    }

    [HttpPost("executions/{id}/resume")]
    public async Task<IActionResult> Resume(string id)
    {
        if (!Guid.TryParse(id, out var gid)) return NotFound();
        var eid = Maestro.Domain.ValueObjects.ExecutionId.From(gid);
        var ctx = await _repository.GetByIdAsync(eid);
        if (ctx == null) return NotFound();
        // mark as resumed and persist
        ctx.Resume();
        await _repository.SaveAsync(ctx);

        // Note: actual resume execution requires the workflow definition to be available.
        // For now we persist the resumed state; a background job may pick this up to continue execution.
        return Accepted();
    }
}
