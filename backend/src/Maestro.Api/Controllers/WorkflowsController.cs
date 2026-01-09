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
    private readonly ILogger<WorkflowsController> _logger;

    public WorkflowsController(
        IWorkflowRepository repository,
        ILogger<WorkflowsController> logger)
    {
        _repository = repository;
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
}
