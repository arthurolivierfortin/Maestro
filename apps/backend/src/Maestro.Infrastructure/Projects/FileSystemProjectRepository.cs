using System.Collections.Concurrent;
using System.Text.Json;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using Maestro.Domain.ValueObjects;
using Maestro.Infrastructure.Configuration;
using Microsoft.Extensions.Logging;

namespace Maestro.Infrastructure.Projects;

/// <summary>
/// Filesystem-based implementation of IProjectRepository.
/// Discovers and manages projects stored in .maestro/project.json files.
/// </summary>
public class FileSystemProjectRepository : IProjectRepository
{
    private readonly ConcurrentDictionary<string, Project> _cache = new();
    private readonly ILogger<FileSystemProjectRepository>? _logger;
    private readonly MaestroPathConfiguration _pathConfig;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true
    };

    public FileSystemProjectRepository(
        MaestroPathConfiguration pathConfig,
        ILogger<FileSystemProjectRepository>? logger = null)
    {
        _pathConfig = pathConfig;
        _logger = logger;
        
        // Initial scan
        _ = DiscoverProjectsAsync(_pathConfig.GetSearchPaths());
    }

    public Task<Project?> GetByIdAsync(ProjectId id, CancellationToken ct = default)
    {
        var project = _cache.Values.FirstOrDefault(p => p.Id == id);
        return Task.FromResult(project);
    }

    public Task<Project?> GetByPathAsync(string rootPath, CancellationToken ct = default)
    {
        var normalizedPath = Path.GetFullPath(rootPath);
        _cache.TryGetValue(normalizedPath, out var project);
        return Task.FromResult(project);
    }

    public Task<IEnumerable<Project>> GetAllAsync(CancellationToken ct = default)
    {
        return Task.FromResult(_cache.Values.AsEnumerable());
    }

    public async Task SaveAsync(Project project, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(project);

        var maestroFolder = project.GetMaestroFolderPath();
        var blocksFolder = project.GetBlocksFolderPath();
        var workflowsFolder = project.GetWorkflowsFolderPath();
        var configPath = project.GetConfigFilePath();

        // Ensure directories exist
        Directory.CreateDirectory(maestroFolder);
        Directory.CreateDirectory(blocksFolder);
        Directory.CreateDirectory(workflowsFolder);

        // Serialize project to JSON
        var projectJson = new
        {
            id = project.Id.ToString(),
            name = project.Name,
            description = project.Description,
            version = project.Version,
            runtime = new
            {
                type = project.Runtime.Type,
                image = project.Runtime.Image,
                workDir = project.Runtime.WorkDir,
                env = project.Runtime.Environment,
                resources = project.Runtime.Resources != null ? new
                {
                    cpuLimit = project.Runtime.Resources.CpuLimit,
                    memoryLimit = project.Runtime.Resources.MemoryLimit,
                    timeoutSeconds = project.Runtime.Resources.TimeoutSeconds
                } : null,
                network = project.Runtime.NetworkMode
            },
            blocks = new
            {
                searchPaths = project.BlockSearchPaths
            },
            models = new
            {
                @default = project.DefaultModel,
                overrides = project.ModelOverrides
            },
            createdAt = project.CreatedAt,
            updatedAt = project.UpdatedAt
        };

        var json = JsonSerializer.Serialize(projectJson, JsonOptions);
        await File.WriteAllTextAsync(configPath, json, ct);

        // Update cache
        var normalizedPath = Path.GetFullPath(project.RootPath);
        _cache[normalizedPath] = project;

        _logger?.LogInformation("Saved project {Name} at {Path}", project.Name, project.RootPath);
    }

    public Task DeleteAsync(ProjectId id, CancellationToken ct = default)
    {
        var project = _cache.Values.FirstOrDefault(p => p.Id == id);
        if (project == null) return Task.CompletedTask;

        var configPath = project.GetConfigFilePath();
        if (File.Exists(configPath))
        {
            File.Delete(configPath);
        }

        _cache.TryRemove(Path.GetFullPath(project.RootPath), out _);
        _logger?.LogInformation("Deleted project {Name}", project.Name);

        return Task.CompletedTask;
    }

    public Task<IEnumerable<Project>> DiscoverProjectsAsync(string[] searchPaths, CancellationToken ct = default)
    {
        var discovered = new List<Project>();

        foreach (var basePath in searchPaths)
        {
            if (!Directory.Exists(basePath)) continue;

            try
            {
                // Look for project.json in .maestro folders
                var projectFiles = Directory.EnumerateFiles(
                    basePath, 
                    MaestroConstants.ProjectConfigFileName, 
                    SearchOption.AllDirectories);

                foreach (var projectFile in projectFiles)
                {
                    try
                    {
                        var project = LoadProjectFromFile(projectFile);
                        if (project != null)
                        {
                            var normalizedPath = Path.GetFullPath(project.RootPath);
                            _cache[normalizedPath] = project;
                            discovered.Add(project);
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger?.LogWarning(ex, "Failed to load project from {Path}", projectFile);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger?.LogWarning(ex, "Failed to scan for projects in {Path}", basePath);
            }
        }

        _logger?.LogInformation("Discovered {Count} projects", discovered.Count);
        return Task.FromResult(discovered.AsEnumerable());
    }

    private Project? LoadProjectFromFile(string projectFilePath)
    {
        if (!File.Exists(projectFilePath)) return null;

        var json = File.ReadAllText(projectFilePath);
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        // The project root is two levels up from project.json (.maestro/project.json)
        var maestroFolder = Path.GetDirectoryName(projectFilePath);
        var rootPath = maestroFolder != null ? Path.GetDirectoryName(maestroFolder) : null;
        if (rootPath == null) return null;

        // Parse ID or generate new one
        var idStr = root.TryGetProperty("id", out var idEl) ? idEl.GetString() : null;
        var id = !string.IsNullOrEmpty(idStr) ? ProjectId.From(idStr) : ProjectId.New();

        // Parse name
        var name = root.TryGetProperty("name", out var nameEl) ? nameEl.GetString() : Path.GetFileName(rootPath);

        var project = Project.Create(id, name ?? "Unnamed Project", rootPath);

        // Parse description
        if (root.TryGetProperty("description", out var descEl))
            project.Description = descEl.GetString();

        // Parse version
        if (root.TryGetProperty("version", out var verEl))
            project.Version = verEl.GetString() ?? "1.0.0";

        // Parse runtime configuration
        if (root.TryGetProperty("runtime", out var runtimeEl))
        {
            project.Runtime = ParseRuntimeConfig(runtimeEl);
        }

        // Parse models
        if (root.TryGetProperty("models", out var modelsEl))
        {
            if (modelsEl.TryGetProperty("default", out var defaultModelEl))
                project.DefaultModel = defaultModelEl.GetString();

            if (modelsEl.TryGetProperty("overrides", out var overridesEl))
            {
                var overrides = new Dictionary<string, string>();
                foreach (var prop in overridesEl.EnumerateObject())
                {
                    if (prop.Value.ValueKind == JsonValueKind.String)
                        overrides[prop.Name] = prop.Value.GetString()!;
                }
                project.ModelOverrides = overrides;
            }
        }

        // Parse timestamps
        if (root.TryGetProperty("createdAt", out var createdEl) && 
            DateTime.TryParse(createdEl.GetString(), out var createdAt))
        {
            // CreatedAt is init-only, we handle this in the Create method
        }

        if (root.TryGetProperty("updatedAt", out var updatedEl) && 
            DateTime.TryParse(updatedEl.GetString(), out var updatedAt))
        {
            project.UpdatedAt = updatedAt;
        }

        return project;
    }

    private static RuntimeConfiguration ParseRuntimeConfig(JsonElement runtimeEl)
    {
        var type = runtimeEl.TryGetProperty("type", out var typeEl) ? typeEl.GetString() : "none";
        var image = runtimeEl.TryGetProperty("image", out var imageEl) ? imageEl.GetString() : null;
        var workDir = runtimeEl.TryGetProperty("workDir", out var workDirEl) ? workDirEl.GetString() : "/app";
        var network = runtimeEl.TryGetProperty("network", out var networkEl) ? networkEl.GetString() : "none";

        var env = new Dictionary<string, string>();
        if (runtimeEl.TryGetProperty("env", out var envEl))
        {
            foreach (var prop in envEl.EnumerateObject())
            {
                if (prop.Value.ValueKind == JsonValueKind.String)
                    env[prop.Name] = prop.Value.GetString()!;
            }
        }

        ResourceLimits? resources = null;
        if (runtimeEl.TryGetProperty("resources", out var resEl) && resEl.ValueKind == JsonValueKind.Object)
        {
            resources = new ResourceLimits
            {
                CpuLimit = resEl.TryGetProperty("cpuLimit", out var cpuEl) ? cpuEl.GetString() : null,
                MemoryLimit = resEl.TryGetProperty("memoryLimit", out var memEl) ? memEl.GetString() : null,
                TimeoutSeconds = resEl.TryGetProperty("timeoutSeconds", out var timeEl) ? timeEl.GetInt32() : null
            };
        }

        return new RuntimeConfiguration
        {
            Type = type ?? "none",
            Image = image,
            WorkDir = workDir ?? "/app",
            Environment = env,
            Resources = resources,
            NetworkMode = network ?? "none"
        };
    }
}
