using System.Text.Json;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using Maestro.Domain.Enums;
using Maestro.Infrastructure.Data;
using Microsoft.Extensions.Logging;

namespace Maestro.Infrastructure.SessionCategories;

/// <summary>
/// File system-based repository for session categories.
/// Combines built-in categories with user-defined categories stored as JSON files.
/// </summary>
public class FileSystemSessionCategoryRepository : ISessionCategoryRepository
{
    private readonly string _userCategoriesPath;
    private readonly ILogger<FileSystemSessionCategoryRepository> _logger;
    private readonly JsonSerializerOptions _jsonOptions;

    public FileSystemSessionCategoryRepository(
        string dataPath,
        ILogger<FileSystemSessionCategoryRepository> logger)
    {
        _userCategoriesPath = Path.Combine(dataPath, "session-categories", "user");
        _logger = logger;
        _jsonOptions = new JsonSerializerOptions
        {
            WriteIndented = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };

        EnsureDirectoriesExist();
    }

    private void EnsureDirectoriesExist()
    {
        Directory.CreateDirectory(_userCategoriesPath);
    }

    public async Task<IEnumerable<SessionCategory>> GetAllAsync()
    {
        var builtIn = BuiltInSessionCategories.All;
        var userDefined = await GetUserDefinedAsync();

        return builtIn.Concat(userDefined).OrderBy(c => c.DisplayOrder).ThenBy(c => c.Name);
    }

    public async Task<SessionCategory?> GetByIdAsync(string id)
    {
        // Check built-in first
        if (BuiltInSessionCategories.ById.TryGetValue(id, out var builtIn))
        {
            return builtIn;
        }

        // Check user-defined
        var filePath = GetUserCategoryPath(id);
        if (!File.Exists(filePath))
        {
            return null;
        }

        try
        {
            var json = await File.ReadAllTextAsync(filePath);
            return JsonSerializer.Deserialize<SessionCategory>(json, _jsonOptions);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to read session category {Id}", id);
            return null;
        }
    }

    public async Task<SessionCategory> CreateAsync(SessionCategory category)
    {
        // Validate ID doesn't conflict with built-in
        if (BuiltInSessionCategories.ById.ContainsKey(category.Id))
        {
            throw new InvalidOperationException($"Category ID '{category.Id}' conflicts with a built-in category.");
        }

        // Check if already exists
        var filePath = GetUserCategoryPath(category.Id);
        if (File.Exists(filePath))
        {
            throw new InvalidOperationException($"Category '{category.Id}' already exists.");
        }

        // Ensure it's marked as user-defined
        category.Source = ImageSource.UserDefined;
        category.IsSystem = false;
        category.CreatedAt = DateTime.UtcNow;

        var json = JsonSerializer.Serialize(category, _jsonOptions);
        await File.WriteAllTextAsync(filePath, json);

        _logger.LogInformation("Created session category {Id}", category.Id);
        return category;
    }

    public async Task<SessionCategory> UpdateAsync(SessionCategory category)
    {
        // Cannot update built-in categories
        if (BuiltInSessionCategories.ById.ContainsKey(category.Id))
        {
            throw new InvalidOperationException($"Cannot update built-in category '{category.Id}'.");
        }

        var filePath = GetUserCategoryPath(category.Id);
        if (!File.Exists(filePath))
        {
            throw new InvalidOperationException($"Category '{category.Id}' not found.");
        }

        category.Source = ImageSource.UserDefined;
        category.IsSystem = false;
        category.UpdatedAt = DateTime.UtcNow;

        var json = JsonSerializer.Serialize(category, _jsonOptions);
        await File.WriteAllTextAsync(filePath, json);

        _logger.LogInformation("Updated session category {Id}", category.Id);
        return category;
    }

    public async Task DeleteAsync(string id)
    {
        // Cannot delete built-in categories
        if (BuiltInSessionCategories.ById.TryGetValue(id, out var builtIn))
        {
            if (builtIn.IsSystem)
            {
                throw new InvalidOperationException($"Cannot delete system category '{id}'.");
            }
            throw new InvalidOperationException($"Cannot delete built-in category '{id}'.");
        }

        var filePath = GetUserCategoryPath(id);
        if (!File.Exists(filePath))
        {
            throw new InvalidOperationException($"Category '{id}' not found.");
        }

        File.Delete(filePath);
        _logger.LogInformation("Deleted session category {Id}", id);

        await Task.CompletedTask;
    }

    public async Task<bool> ExistsAsync(string id)
    {
        if (BuiltInSessionCategories.ById.ContainsKey(id))
        {
            return true;
        }

        return File.Exists(GetUserCategoryPath(id));
    }

    public async Task<IEnumerable<SessionCategory>> GetUserDefinedAsync()
    {
        var categories = new List<SessionCategory>();

        if (!Directory.Exists(_userCategoriesPath))
        {
            return categories;
        }

        foreach (var file in Directory.GetFiles(_userCategoriesPath, "*.json"))
        {
            try
            {
                var json = await File.ReadAllTextAsync(file);
                var category = JsonSerializer.Deserialize<SessionCategory>(json, _jsonOptions);
                if (category != null)
                {
                    categories.Add(category);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to read category file {File}", file);
            }
        }

        return categories.OrderBy(c => c.DisplayOrder).ThenBy(c => c.Name);
    }

    public Task<IEnumerable<SessionCategory>> GetBuiltInAsync()
    {
        return Task.FromResult<IEnumerable<SessionCategory>>(BuiltInSessionCategories.All);
    }

    private string GetUserCategoryPath(string id)
    {
        return Path.Combine(_userCategoriesPath, $"{id}.json");
    }
}
