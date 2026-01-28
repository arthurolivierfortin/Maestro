using System.Text.Json;
using Maestro.Domain.Entities;

namespace Maestro.Infrastructure.Foundry;

/// <summary>
/// Registry for managing agents - discovers, stores, and retrieves agent definitions.
/// </summary>
public class AgentRegistry
{
    private readonly string _globalAgentsPath;
    private readonly JsonSerializerOptions _jsonOptions;
    private readonly Dictionary<string, AgentDefinition> _cache = new();

    public AgentRegistry(string globalAgentsPath)
    {
        _globalAgentsPath = globalAgentsPath;
        Directory.CreateDirectory(_globalAgentsPath);

        _jsonOptions = new JsonSerializerOptions
        {
            WriteIndented = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };
    }

    /// <summary>
    /// Get all registered agents.
    /// </summary>
    public async Task<List<AgentDefinition>> GetAllAsync(string? projectPath = null)
    {
        var agents = new List<AgentDefinition>();

        // Load global agents
        agents.AddRange(await LoadAgentsFromDirectoryAsync(_globalAgentsPath));

        // Load project-specific agents
        if (!string.IsNullOrEmpty(projectPath))
        {
            var projectAgentsPath = Path.Combine(projectPath, ".maestro", "agents");
            if (Directory.Exists(projectAgentsPath))
            {
                agents.AddRange(await LoadAgentsFromDirectoryAsync(projectAgentsPath));
            }
        }

        return agents;
    }

    /// <summary>
    /// Get a specific agent by ID.
    /// </summary>
    public async Task<AgentDefinition?> GetByIdAsync(string id, string? projectPath = null)
    {
        // Check cache first
        if (_cache.TryGetValue(id, out var cached))
        {
            return cached;
        }

        // Try project path first
        if (!string.IsNullOrEmpty(projectPath))
        {
            var projectAgentPath = Path.Combine(projectPath, ".maestro", "agents", $"{id}.agent.json");
            if (File.Exists(projectAgentPath))
            {
                return await LoadAgentAsync(projectAgentPath);
            }
        }

        // Try global path
        var globalAgentPath = Path.Combine(_globalAgentsPath, $"{id}.agent.json");
        if (File.Exists(globalAgentPath))
        {
            return await LoadAgentAsync(globalAgentPath);
        }

        return null;
    }

    /// <summary>
    /// Create or update an agent.
    /// </summary>
    public async Task<AgentDefinition> SaveAsync(AgentDefinition agent, string? projectPath = null)
    {
        agent.UpdatedAt = DateTime.UtcNow;

        var targetPath = !string.IsNullOrEmpty(projectPath)
            ? Path.Combine(projectPath, ".maestro", "agents")
            : _globalAgentsPath;

        Directory.CreateDirectory(targetPath);

        var filePath = Path.Combine(targetPath, $"{agent.Id}.agent.json");
        var json = JsonSerializer.Serialize(agent, _jsonOptions);
        await File.WriteAllTextAsync(filePath, json);

        _cache[agent.Id] = agent;

        return agent;
    }

    /// <summary>
    /// Delete an agent.
    /// </summary>
    public async Task<bool> DeleteAsync(string id, string? projectPath = null)
    {
        var filePath = !string.IsNullOrEmpty(projectPath)
            ? Path.Combine(projectPath, ".maestro", "agents", $"{id}.agent.json")
            : Path.Combine(_globalAgentsPath, $"{id}.agent.json");

        if (File.Exists(filePath))
        {
            File.Delete(filePath);
            _cache.Remove(id);
            return true;
        }

        return false;
    }

    /// <summary>
    /// Record an agent execution result for metrics.
    /// </summary>
    public async Task RecordRunAsync(string agentId, AgentRunResult result, string? projectPath = null)
    {
        var agent = await GetByIdAsync(agentId, projectPath);
        if (agent == null) return;

        agent.Metrics.RecordRun(result);
        await SaveAsync(agent, projectPath);
    }

    /// <summary>
    /// Get agents by category.
    /// </summary>
    public async Task<List<AgentDefinition>> GetByCategoryAsync(string category, string? projectPath = null)
    {
        var all = await GetAllAsync(projectPath);
        return all.Where(a => a.Category.Equals(category, StringComparison.OrdinalIgnoreCase)).ToList();
    }

    /// <summary>
    /// Get agents that use a specific tool.
    /// </summary>
    public async Task<List<AgentDefinition>> GetByToolAsync(string toolId, string? projectPath = null)
    {
        var all = await GetAllAsync(projectPath);
        return all.Where(a => a.AvailableTools.Contains(toolId)).ToList();
    }

    /// <summary>
    /// Get top agents by score.
    /// </summary>
    public async Task<List<AgentDefinition>> GetTopByScoreAsync(int limit = 10, string? projectPath = null)
    {
        var all = await GetAllAsync(projectPath);
        return all.OrderByDescending(a => a.Metrics.OverallScore).Take(limit).ToList();
    }

    /// <summary>
    /// Get agents that can be used as sub-agents.
    /// </summary>
    public async Task<List<AgentDefinition>> GetSubAgentsForAsync(string agentId, string? projectPath = null)
    {
        var agent = await GetByIdAsync(agentId, projectPath);
        if (agent == null) return new List<AgentDefinition>();

        var all = await GetAllAsync(projectPath);
        return all.Where(a => agent.AvailableAgents.Contains(a.Id)).ToList();
    }

    private async Task<List<AgentDefinition>> LoadAgentsFromDirectoryAsync(string path)
    {
        var agents = new List<AgentDefinition>();

        if (!Directory.Exists(path)) return agents;

        foreach (var file in Directory.EnumerateFiles(path, "*.agent.json"))
        {
            try
            {
                var agent = await LoadAgentAsync(file);
                if (agent != null)
                {
                    agents.Add(agent);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error loading agent from {file}: {ex.Message}");
            }
        }

        return agents;
    }

    private async Task<AgentDefinition?> LoadAgentAsync(string filePath)
    {
        try
        {
            var json = await File.ReadAllTextAsync(filePath);
            var agent = JsonSerializer.Deserialize<AgentDefinition>(json, _jsonOptions);

            if (agent != null)
            {
                _cache[agent.Id] = agent;
            }

            return agent;
        }
        catch
        {
            return null;
        }
    }
}
