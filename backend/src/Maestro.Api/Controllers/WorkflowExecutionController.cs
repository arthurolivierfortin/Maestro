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
        // Ensure workflowId is a valid GUID string
        if (!Guid.TryParse(workflowId, out var wfGuid))
        {
            return BadRequest("workflowId must be a valid GUID string");
        }

        // Create an execution record in repository and persist initial checkpoint
        var ctx = Maestro.Domain.Entities.ExecutionContext.Create(workflowId);
        // Attempt to load the workflow definition and snapshot it into the execution context
        try
        {
            var wfRepo = HttpContext.RequestServices.GetService(typeof(Maestro.Domain.Interfaces.IWorkflowRepository)) as Maestro.Domain.Interfaces.IWorkflowRepository;
            if (wfRepo != null)
            {
                var wfId = Maestro.Domain.ValueObjects.WorkflowId.From(wfGuid);
                var wf = await wfRepo.GetByIdAsync(wfId);
                if (wf != null)
                {
                    // serialize minimal workflow definition structure
                    var serializable = new
                    {
                        id = wf.Id.ToString(),
                        nodes = wf.Nodes
                    };
                    ctx.WorkflowDefinitionJson = System.Text.Json.JsonSerializer.Serialize(serializable);
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
        // Try to resolve a coordinator if available. Some builds don't define IExecutionCoordinator; fallback to direct execution
        try
        {
            var coordService = HttpContext.RequestServices.GetService(typeof(object));
            if (coordService != null)
            {
                // Try dynamic enqueue if the service supports it
                dynamic d = coordService;
                try
                {
                    await d.EnqueueAsync(workflowId, inputs ?? new Dictionary<string, object>());
                    return Accepted(new { executionId = ctx.Id.ToString() });
                }
                catch { /* not the coordinator we expect; continue to fallback */ }
            }
        }
        catch { }

        {
            // fallback: start execution without waiting - attempt to resolve workflow definition via repository
            var wfDef = new Maestro.Application.Interfaces.WorkflowDefinition(
                "",
                new List<Maestro.Domain.Entities.BlockDefinition>(),
                new List<Maestro.Domain.Entities.ConnectionDefinition>());
            try
            {
                var wfRepo = HttpContext.RequestServices.GetService(typeof(Maestro.Domain.Interfaces.IWorkflowRepository)) as Maestro.Domain.Interfaces.IWorkflowRepository;
                if (wfRepo != null)
                {
                    var wfId = Maestro.Domain.ValueObjects.WorkflowId.From(wfGuid);
                    var wf = await wfRepo.GetByIdAsync(wfId);
                    if (wf != null)
                    {
                        // Map domain Nodes to BlockDefinition list
                        var blocks = wf.Nodes.Select(n => Maestro.Domain.Entities.BlockDefinition.Create(n.Id.ToString(), n.Name, n.Type.ToString())).ToList();
                        wfDef = new Maestro.Application.Interfaces.WorkflowDefinition(
                            wf.Id.ToString(),
                            blocks,
                            new List<Maestro.Domain.Entities.ConnectionDefinition>());
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
