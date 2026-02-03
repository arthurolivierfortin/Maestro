using System.Collections.Concurrent;
using System.Text.Json;
using System.Text.Json.Serialization;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using Maestro.Domain.Enums;
using Maestro.Infrastructure.Data;
using Microsoft.Extensions.Logging;

namespace Maestro.Infrastructure.SessionTemplates;

/// <summary>
/// Filesystem-based implementation of ISessionTemplateRepository.
/// Combines built-in templates with user-defined templates stored in the data folder.
/// </summary>
public class FileSystemSessionTemplateRepository : ISessionTemplateRepository
{
    private readonly ConcurrentDictionary<string, SessionTemplate> _userTemplateCache = new();
    private readonly string _dataPath;
    private readonly ILogger<FileSystemSessionTemplateRepository>? _logger;
    private bool _initialized;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true,
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) }
    };

    public FileSystemSessionTemplateRepository(
        string dataPath,
        ILogger<FileSystemSessionTemplateRepository>? logger = null)
    {
        _dataPath = Path.Combine(dataPath, "session-templates", "user");
        _logger = logger;
    }

    public async Task<SessionTemplate?> GetByIdAsync(string id, CancellationToken ct = default)
    {
        await EnsureInitializedAsync(ct);

        // Check built-in first
        var builtIn = BuiltInSessionTemplates.GetById(id);
        if (builtIn != null) return builtIn;

        // Check user-defined
        _userTemplateCache.TryGetValue(id, out var userTemplate);
        return userTemplate;
    }

    public async Task<IEnumerable<SessionTemplate>> GetAllAsync(
        TemplateSource? source = null,
        EnvironmentMode? mode = null,
        string? categoryId = null,
        IEnumerable<string>? tags = null,
        CancellationToken ct = default)
    {
        await EnsureInitializedAsync(ct);

        IEnumerable<SessionTemplate> templates = source switch
        {
            TemplateSource.BuiltIn => BuiltInSessionTemplates.GetAll(),
            TemplateSource.UserDefined => _userTemplateCache.Values,
            _ => BuiltInSessionTemplates.GetAll().Concat(_userTemplateCache.Values)
        };

        if (mode.HasValue)
        {
            templates = templates.Where(t => t.Mode == mode.Value);
        }

        if (!string.IsNullOrEmpty(categoryId))
        {
            templates = templates.Where(t => t.CategoryId == categoryId);
        }

        if (tags != null && tags.Any())
        {
            var tagSet = new HashSet<string>(tags, StringComparer.OrdinalIgnoreCase);
            templates = templates.Where(t => t.Tags.Any(tag => tagSet.Contains(tag)));
        }

        return templates.OrderBy(t => t.SortOrder).ThenBy(t => t.Name).ToList();
    }

    public Task<IEnumerable<SessionTemplate>> GetBuiltInAsync(CancellationToken ct = default)
    {
        return Task.FromResult<IEnumerable<SessionTemplate>>(
            BuiltInSessionTemplates.GetAll().OrderBy(t => t.SortOrder).ToList());
    }

    public async Task<IEnumerable<SessionTemplate>> GetUserDefinedAsync(CancellationToken ct = default)
    {
        await EnsureInitializedAsync(ct);
        return _userTemplateCache.Values.OrderBy(t => t.SortOrder).ThenBy(t => t.Name).ToList();
    }

    public async Task SaveAsync(SessionTemplate template, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(template);

        if (BuiltInSessionTemplates.IsBuiltIn(template.Id))
        {
            throw new InvalidOperationException($"Cannot modify built-in session template: {template.Id}");
        }

        Directory.CreateDirectory(_dataPath);
        var filePath = GetFilePath(template.Id);

        template.UpdatedAt = DateTime.UtcNow;
        var json = JsonSerializer.Serialize(template, JsonOptions);
        await File.WriteAllTextAsync(filePath, json, ct);

        _userTemplateCache[template.Id] = template;
        _logger?.LogInformation("Saved session template: {TemplateId}", template.Id);
    }

    public async Task DeleteAsync(string id, CancellationToken ct = default)
    {
        if (BuiltInSessionTemplates.IsBuiltIn(id))
        {
            throw new InvalidOperationException($"Cannot delete built-in session template: {id}");
        }

        var filePath = GetFilePath(id);
        if (File.Exists(filePath))
        {
            File.Delete(filePath);
        }

        _userTemplateCache.TryRemove(id, out _);
        _logger?.LogInformation("Deleted session template: {TemplateId}", id);
        await Task.CompletedTask;
    }

    public async Task<bool> ExistsAsync(string id, CancellationToken ct = default)
    {
        await EnsureInitializedAsync(ct);
        return BuiltInSessionTemplates.IsBuiltIn(id) || _userTemplateCache.ContainsKey(id);
    }

    private async Task EnsureInitializedAsync(CancellationToken ct)
    {
        if (_initialized) return;

        if (Directory.Exists(_dataPath))
        {
            var files = Directory.GetFiles(_dataPath, "*.json");
            foreach (var file in files)
            {
                try
                {
                    var json = await File.ReadAllTextAsync(file, ct);
                    var template = JsonSerializer.Deserialize<SessionTemplate>(json, JsonOptions);
                    if (template != null)
                    {
                        _userTemplateCache[template.Id] = template;
                    }
                }
                catch (Exception ex)
                {
                    _logger?.LogWarning(ex, "Failed to load session template from {Path}", file);
                }
            }
        }

        _initialized = true;
        _logger?.LogInformation("Initialized session template repository with {BuiltIn} built-in and {UserDefined} user-defined templates",
            BuiltInSessionTemplates.GetAll().Count, _userTemplateCache.Count);
    }

    private string GetFilePath(string id)
    {
        return Path.Combine(_dataPath, $"{id}.json");
    }
}
