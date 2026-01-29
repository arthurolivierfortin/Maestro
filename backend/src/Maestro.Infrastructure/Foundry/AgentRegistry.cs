using System.Collections.Concurrent;
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
    private readonly ConcurrentDictionary<string, AgentDefinition> _cache = new();

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
            var projectAgentPath = Path.Combine(projectPath, ".maestro", "agents", $"{id}.agent.block.json");
            if (File.Exists(projectAgentPath))
            {
                return await LoadAgentFromBlockFileAsync(projectAgentPath);
            }
        }

        // Try global path
        var globalAgentPath = Path.Combine(_globalAgentsPath, $"{id}.agent.block.json");
        if (File.Exists(globalAgentPath))
        {
            return await LoadAgentFromBlockFileAsync(globalAgentPath);
        }

        return null;
    }

    /// <summary>
    /// Create or update an agent. Saves in .agent.block.json format.
    /// </summary>
    public async Task<AgentDefinition> SaveAsync(AgentDefinition agent, string? projectPath = null)
    {
        agent.UpdatedAt = DateTime.UtcNow;

        var targetPath = !string.IsNullOrEmpty(projectPath)
            ? Path.Combine(projectPath, ".maestro", "agents")
            : _globalAgentsPath;

        Directory.CreateDirectory(targetPath);

        // Save as .agent.block.json format
        var filePath = Path.Combine(targetPath, $"{agent.Id}.agent.block.json");
        var blockJson = ConvertToBlockFormat(agent);
        await File.WriteAllTextAsync(filePath, blockJson);

        _cache[agent.Id] = agent;

        return agent;
    }

    /// <summary>
    /// Delete an agent.
    /// </summary>
    public async Task<bool> DeleteAsync(string id, string? projectPath = null)
    {
        var filePath = !string.IsNullOrEmpty(projectPath)
            ? Path.Combine(projectPath, ".maestro", "agents", $"{id}.agent.block.json")
            : Path.Combine(_globalAgentsPath, $"{id}.agent.block.json");

        if (File.Exists(filePath))
        {
            File.Delete(filePath);
            _cache.TryRemove(id, out _);
            return true;
        }

        return false;
    }

    /// <summary>
    /// Convert AgentDefinition to Block format JSON.
    /// </summary>
    private string ConvertToBlockFormat(AgentDefinition agent)
    {
        var block = new
        {
            id = agent.Id,
            name = agent.Name,
            blockType = "agent",
            version = agent.Version,
            isAtomic = false,
            description = agent.Description,
            inputs = new[]
            {
                new { id = "task", name = "Task", type = "string", required = true, description = "The task to accomplish" },
                new { id = "workingDir", name = "Working Directory", type = "string", required = true, description = "The working directory" },
                new { id = "context", name = "Context", type = "string", required = false, description = "Additional context" }
            },
            outputs = new[]
            {
                new { id = "result", name = "Result", type = "string", description = "Task result" },
                new { id = "filesModified", name = "Files Modified", type = "array", description = "Modified files" },
                new { id = "status", name = "Status", type = "string", description = "Task status" }
            },
            config = new
            {
                maxIterations = agent.Config.MaxSteps,
                maxTokens = agent.Config.MaxTokens,
                temperature = agent.Config.Temperature,
                timeoutMs = agent.Config.TimeoutMs,
                requireApproval = agent.Config.RequireApproval,
                model = agent.Config.Model,
                systemPrompt = agent.Config.SystemPrompt,
                tools = agent.AvailableTools
            },
            metadata = new
            {
                category = agent.Category,
                tags = agent.Tags,
                author = agent.Author
            },
            capabilities = agent.Capabilities
        };

        return JsonSerializer.Serialize(block, _jsonOptions);
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

        // Load only .agent.block.json files (Block format) and convert to AgentDefinition
        foreach (var file in Directory.EnumerateFiles(path, "*.agent.block.json"))
        {
            try
            {
                var agent = await LoadAgentFromBlockFileAsync(file);
                if (agent != null)
                {
                    agents.Add(agent);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error loading agent block from {file}: {ex.Message}");
            }
        }

        return agents;
    }

    /// <summary>
    /// Load an agent from a .agent.block.json file (Block format) and convert to AgentDefinition.
    /// </summary>
    private async Task<AgentDefinition?> LoadAgentFromBlockFileAsync(string filePath)
    {
        try
        {
            var json = await File.ReadAllTextAsync(filePath);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            // Extract fields from Block format
            var id = root.GetProperty("id").GetString() ?? Path.GetFileNameWithoutExtension(filePath).Replace(".agent.block", "");
            var name = root.TryGetProperty("name", out var nameProp) ? nameProp.GetString() ?? id : id;
            var description = root.TryGetProperty("description", out var descProp) ? descProp.GetString() ?? "" : "";
            var version = root.TryGetProperty("version", out var verProp) ? verProp.GetString() ?? "1.0.0" : "1.0.0";

            // Extract category from metadata
            var category = "general";
            if (root.TryGetProperty("metadata", out var metadata) && metadata.TryGetProperty("category", out var catProp))
            {
                category = catProp.GetString() ?? "general";
            }

            // Extract tags from metadata
            var tags = new List<string>();
            if (root.TryGetProperty("metadata", out var meta2) && meta2.TryGetProperty("tags", out var tagsProp))
            {
                foreach (var tag in tagsProp.EnumerateArray())
                {
                    if (tag.GetString() is string t) tags.Add(t);
                }
            }

            // Extract capabilities
            var capabilities = new List<string>();
            if (root.TryGetProperty("capabilities", out var capsProp))
            {
                foreach (var cap in capsProp.EnumerateArray())
                {
                    if (cap.GetString() is string c) capabilities.Add(c);
                }
            }

            // Extract tools from config
            var availableTools = new List<string>();
            if (root.TryGetProperty("config", out var config) && config.TryGetProperty("tools", out var toolsProp))
            {
                foreach (var tool in toolsProp.EnumerateArray())
                {
                    if (tool.GetString() is string t) availableTools.Add(t);
                }
            }

            // Create AgentDefinition
            var agent = new AgentDefinition
            {
                Id = id,
                Name = name,
                Description = description,
                Version = version,
                Designation = "agent",
                BlockId = id,
                Category = category,
                Tags = tags,
                Capabilities = capabilities,
                AvailableTools = availableTools,
                AvailableAgents = new List<string>(),
                Config = new AgentConfig
                {
                    MaxSteps = config.TryGetProperty("maxIterations", out var maxIter) ? maxIter.GetInt32() : 50,
                    MaxTokens = config.TryGetProperty("maxTokens", out var maxTok) ? maxTok.GetInt32() : 10000,
                    Temperature = config.TryGetProperty("temperature", out var temp) ? temp.GetDouble() : 0.7,
                    TimeoutMs = config.TryGetProperty("timeoutMs", out var timeout) ? timeout.GetInt32() : 300000,
                    RequireApproval = config.TryGetProperty("requireApproval", out var reqAppr) && reqAppr.GetBoolean(),
                    Model = config.TryGetProperty("model", out var model) ? model.GetString() : null,
                    SystemPrompt = config.TryGetProperty("systemPrompt", out var sysPr) ? sysPr.GetString() : null
                },
                Metrics = new AgentMetrics(),
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _cache[agent.Id] = agent;
            return agent;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error parsing agent block file {filePath}: {ex.Message}");
            return null;
        }
    }
}
