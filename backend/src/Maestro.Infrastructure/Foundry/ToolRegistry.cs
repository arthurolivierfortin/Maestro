using System.Collections.Concurrent;
using System.Text.Json;
using Maestro.Domain.Entities;

namespace Maestro.Infrastructure.Foundry;

/// <summary>
/// Registry for managing tools - discovers, stores, and retrieves tool definitions.
/// </summary>
public class ToolRegistry
{
    private readonly string _globalToolsPath;
    private readonly JsonSerializerOptions _jsonOptions;
    private readonly ConcurrentDictionary<string, ToolDefinition> _cache = new();

    public ToolRegistry(string globalToolsPath)
    {
        _globalToolsPath = globalToolsPath;
        Directory.CreateDirectory(_globalToolsPath);

        _jsonOptions = new JsonSerializerOptions
        {
            WriteIndented = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };
    }

    /// <summary>
    /// Get all registered tools.
    /// </summary>
    public async Task<List<ToolDefinition>> GetAllAsync(string? projectPath = null)
    {
        var tools = new List<ToolDefinition>();

        // Load global tools
        tools.AddRange(await LoadToolsFromDirectoryAsync(_globalToolsPath));

        // Load project-specific tools
        if (!string.IsNullOrEmpty(projectPath))
        {
            var projectToolsPath = Path.Combine(projectPath, ".maestro", "tools");
            if (Directory.Exists(projectToolsPath))
            {
                tools.AddRange(await LoadToolsFromDirectoryAsync(projectToolsPath));
            }
        }

        return tools;
    }

    /// <summary>
    /// Get a specific tool by ID.
    /// </summary>
    public async Task<ToolDefinition?> GetByIdAsync(string id, string? projectPath = null)
    {
        // Check cache first
        if (_cache.TryGetValue(id, out var cached))
        {
            return cached;
        }

        // Try project path first
        if (!string.IsNullOrEmpty(projectPath))
        {
            var projectToolPath = Path.Combine(projectPath, ".maestro", "tools", $"{id}.tool.json");
            if (File.Exists(projectToolPath))
            {
                return await LoadToolAsync(projectToolPath);
            }
        }

        // Try global path
        var globalToolPath = Path.Combine(_globalToolsPath, $"{id}.tool.json");
        if (File.Exists(globalToolPath))
        {
            return await LoadToolAsync(globalToolPath);
        }

        return null;
    }

    /// <summary>
    /// Create or update a tool.
    /// </summary>
    public async Task<ToolDefinition> SaveAsync(ToolDefinition tool, string? projectPath = null)
    {
        tool.UpdatedAt = DateTime.UtcNow;

        var targetPath = !string.IsNullOrEmpty(projectPath)
            ? Path.Combine(projectPath, ".maestro", "tools")
            : _globalToolsPath;

        Directory.CreateDirectory(targetPath);

        var filePath = Path.Combine(targetPath, $"{tool.Id}.tool.json");
        var json = JsonSerializer.Serialize(tool, _jsonOptions);
        await File.WriteAllTextAsync(filePath, json);

        _cache[tool.Id] = tool;

        return tool;
    }

    /// <summary>
    /// Delete a tool.
    /// </summary>
    public async Task<bool> DeleteAsync(string id, string? projectPath = null)
    {
        var filePath = !string.IsNullOrEmpty(projectPath)
            ? Path.Combine(projectPath, ".maestro", "tools", $"{id}.tool.json")
            : Path.Combine(_globalToolsPath, $"{id}.tool.json");

        if (File.Exists(filePath))
        {
            File.Delete(filePath);
            _cache.TryRemove(id, out _);
            return true;
        }

        return false;
    }

    /// <summary>
    /// Record a tool execution result for metrics.
    /// </summary>
    public async Task RecordRunAsync(string toolId, bool success, long executionTimeMs, int tokenCost, double score, string? projectPath = null)
    {
        var tool = await GetByIdAsync(toolId, projectPath);
        if (tool == null) return;

        tool.Metrics.RecordRun(success, executionTimeMs, tokenCost, score);
        await SaveAsync(tool, projectPath);
    }

    /// <summary>
    /// Get tools by category.
    /// </summary>
    public async Task<List<ToolDefinition>> GetByCategoryAsync(string category, string? projectPath = null)
    {
        var all = await GetAllAsync(projectPath);
        return all.Where(t => t.Category.Equals(category, StringComparison.OrdinalIgnoreCase)).ToList();
    }

    /// <summary>
    /// Get tools used by a specific agent.
    /// </summary>
    public async Task<List<ToolDefinition>> GetByAgentAsync(string agentId, string? projectPath = null)
    {
        var all = await GetAllAsync(projectPath);
        return all.Where(t => t.Metrics.UsedByAgents.Contains(agentId)).ToList();
    }

    /// <summary>
    /// Get top tools by score.
    /// </summary>
    public async Task<List<ToolDefinition>> GetTopByScoreAsync(int limit = 10, string? projectPath = null)
    {
        var all = await GetAllAsync(projectPath);
        return all.OrderByDescending(t => t.Metrics.OverallScore).Take(limit).ToList();
    }

    private async Task<List<ToolDefinition>> LoadToolsFromDirectoryAsync(string path)
    {
        var tools = new List<ToolDefinition>();

        if (!Directory.Exists(path)) return tools;

        foreach (var file in Directory.EnumerateFiles(path, "*.tool.json"))
        {
            try
            {
                var tool = await LoadToolAsync(file);
                if (tool != null)
                {
                    tools.Add(tool);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error loading tool from {file}: {ex.Message}");
            }
        }

        return tools;
    }

    private async Task<ToolDefinition?> LoadToolAsync(string filePath)
    {
        try
        {
            var json = await File.ReadAllTextAsync(filePath);
            var tool = JsonSerializer.Deserialize<ToolDefinition>(json, _jsonOptions);

            if (tool != null)
            {
                _cache[tool.Id] = tool;
            }

            return tool;
        }
        catch
        {
            return null;
        }
    }
}
