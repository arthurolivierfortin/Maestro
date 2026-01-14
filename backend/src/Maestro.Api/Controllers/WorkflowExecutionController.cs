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
        // Create an execution record in repository and persist initial checkpoint
        var ctx = Maestro.Domain.Entities.ExecutionContext.Create(workflowId);
        // Attempt to load the workflow definition and snapshot it into the execution context
        try
        {
            var wfRepo = HttpContext.RequestServices.GetService(typeof(Maestro.Domain.Interfaces.IWorkflowRepository)) as Maestro.Domain.Interfaces.IWorkflowRepository;
            if (wfRepo != null)
            {
                var wfId = Maestro.Domain.ValueObjects.WorkflowId.From(workflowId);
                var wf = await wfRepo.GetByIdAsync(wfId);
                if (wf != null)
                {
                    // serialize minimal workflow definition structure
                    ctx.WorkflowDefinitionJson = System.Text.Json.JsonSerializer.Serialize(new { wf.Id, wf.Nodes, wf.Connections });
                }
            }
        }
        catch
        {
            // ignore repo failures for now; execution can still proceed if coordinator can load definition
        }
        // snapshot inputs into variables
        if (inputs != null)
        {
            foreach (var kv in inputs) ctx.Variables[kv.Key] = kv.Value;
        }

        await _repository.SaveAsync(ctx);

        // Enqueue background execution via ExecutionCoordinator if available (fallback: use executor directly)
        // Try to resolve coordinator from services
        // Use a coordinator abstraction if available
        var coordinator = HttpContext.RequestServices.GetService(typeof(Maestro.Application.Interfaces.IExecutionCoordinator)) as Maestro.Application.Interfaces.IExecutionCoordinator;
        if (coordinator != null)
        {
            await coordinator.EnqueueAsync(workflowId, inputs ?? new Dictionary<string, object>());
        }
        else
        {
            // fallback: start execution without waiting - attempt to resolve workflow definition via repository
            Maestro.Domain.Workflow.WorkflowDefinition wfDef = new();
            try
            {
                var wfRepo = HttpContext.RequestServices.GetService(typeof(Maestro.Domain.Interfaces.IWorkflowRepository)) as Maestro.Domain.Interfaces.IWorkflowRepository;
                if (wfRepo != null)
                {
                    var wfId = Maestro.Domain.ValueObjects.WorkflowId.From(workflowId);
                    var wf = await wfRepo.GetByIdAsync(wfId);
                    if (wf != null)
                    {
                        wfDef.Id = wf.Id;
                        wfDef.Nodes = wf.Nodes;
                        wfDef.Connections = wf.Connections;
                    }
                }
            }
            catch { }

            _ = _executor.ExecuteAsync(wfDef, inputs ?? new Dictionary<string, object>());
        }

        return Accepted(new { executionId = ctx.Id.ToString() });
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

        var coordinator = HttpContext.RequestServices.GetService(typeof(Maestro.Application.Execution.ExecutionCoordinator)) as Maestro.Application.Execution.ExecutionCoordinator;
        if (coordinator != null)
        {
            // Attempt to re-enqueue with empty inputs; ResumeService should load checkpoint
            await coordinator.EnqueueAsync(ctx.WorkflowId, ctx.Variables);
            return Accepted();
        }

        return Accepted();
    }
}
