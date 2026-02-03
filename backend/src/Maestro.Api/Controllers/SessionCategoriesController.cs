using Maestro.Application.DTOs;
using Maestro.Application.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace Maestro.Api.Controllers;

/// <summary>
/// API controller for managing session categories.
/// Categories allow users to organize sessions by purpose.
/// </summary>
[ApiController]
[Route("api/session-categories")]
public class SessionCategoriesController : ControllerBase
{
    private readonly ISessionCategoryRepository _repository;
    private readonly ILogger<SessionCategoriesController> _logger;

    public SessionCategoriesController(
        ISessionCategoryRepository repository,
        ILogger<SessionCategoriesController> logger)
    {
        _repository = repository;
        _logger = logger;
    }

    /// <summary>
    /// Gets all session categories (built-in and user-defined).
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<SessionCategoryDto>>> GetAll()
    {
        var categories = await _repository.GetAllAsync();
        return Ok(categories.Select(SessionCategoryDto.FromDomain));
    }

    /// <summary>
    /// Gets only built-in session categories.
    /// </summary>
    [HttpGet("builtin")]
    public async Task<ActionResult<IEnumerable<SessionCategoryDto>>> GetBuiltIn()
    {
        var categories = await _repository.GetBuiltInAsync();
        return Ok(categories.Select(SessionCategoryDto.FromDomain));
    }

    /// <summary>
    /// Gets only user-defined session categories.
    /// </summary>
    [HttpGet("user-defined")]
    public async Task<ActionResult<IEnumerable<SessionCategoryDto>>> GetUserDefined()
    {
        var categories = await _repository.GetUserDefinedAsync();
        return Ok(categories.Select(SessionCategoryDto.FromDomain));
    }

    /// <summary>
    /// Gets a session category by ID.
    /// </summary>
    [HttpGet("{id}")]
    public async Task<ActionResult<SessionCategoryDto>> GetById(string id)
    {
        var category = await _repository.GetByIdAsync(id);
        if (category == null)
        {
            return NotFound(new { error = $"Session category '{id}' not found." });
        }
        return Ok(SessionCategoryDto.FromDomain(category));
    }

    /// <summary>
    /// Creates a new user-defined session category.
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<SessionCategoryDto>> Create([FromBody] CreateSessionCategoryRequest request)
    {
        try
        {
            var category = request.ToDomain();
            var created = await _repository.CreateAsync(category);
            return CreatedAtAction(
                nameof(GetById),
                new { id = created.Id },
                SessionCategoryDto.FromDomain(created));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Updates an existing user-defined session category.
    /// Built-in categories cannot be updated.
    /// </summary>
    [HttpPut("{id}")]
    public async Task<ActionResult<SessionCategoryDto>> Update(
        string id,
        [FromBody] UpdateSessionCategoryRequest request)
    {
        try
        {
            var existing = await _repository.GetByIdAsync(id);
            if (existing == null)
            {
                return NotFound(new { error = $"Session category '{id}' not found." });
            }

            request.ApplyTo(existing);
            var updated = await _repository.UpdateAsync(existing);
            return Ok(SessionCategoryDto.FromDomain(updated));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Deletes a user-defined session category.
    /// Built-in categories cannot be deleted.
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<ActionResult> Delete(string id)
    {
        try
        {
            await _repository.DeleteAsync(id);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}
