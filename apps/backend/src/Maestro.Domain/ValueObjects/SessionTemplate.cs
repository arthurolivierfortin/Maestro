namespace Maestro.Domain.ValueObjects;

/// <summary>
/// Template for creating sessions with pre-configured permissions.
/// Sessions created from a template inherit its permission configuration.
/// </summary>
public record SessionTemplate
{
    /// <summary>Session type identifier (e.g., "training", "foundry", "project").</summary>
    public string Type { get; init; } = string.Empty;

    /// <summary>Human-readable description.</summary>
    public string? Description { get; init; }

    /// <summary>Permissions for sessions created from this template.</summary>
    public ContextPermissions Permissions { get; init; } = ContextPermissions.None;

    /// <summary>Whether to log all CLI commands executed in this session.</summary>
    public bool LogAllCommands { get; init; } = true;

    /// <summary>Maximum allowed duration in minutes (0 = unlimited).</summary>
    public int MaxDurationMinutes { get; init; }

    /// <summary>Maximum iterations/steps allowed (0 = unlimited).</summary>
    public int MaxIterations { get; init; }

    /// <summary>Whether sessions of this type can create nested sessions.</summary>
    public bool AllowNestedSessions { get; init; }

    /// <summary>Default model ID for inference in this session type.</summary>
    public string? DefaultModelId { get; init; }

    /// <summary>
    /// Training session template - restricted permissions for automated training.
    /// </summary>
    public static SessionTemplate Training => new()
    {
        Type = "training",
        Description = "Training session with restricted permissions for automated model training",
        Permissions = new ContextPermissions
        {
            AllowedCommands = new() { "run", "list-tools", "data" },
            AllowedTools = new() { "system:fitness-calculator", "system:data-store", "system:metrics-collector" },
            AllowedBlocks = new() { "*" },
            CanCreateBlocks = false,
            CanCreateSessions = false,
            DataCollections = new() { "experiments", "metrics", "checkpoints" },
            AllowedPaths = new() { "data/" }
        },
        LogAllCommands = true,
        AllowNestedSessions = false
    };

    /// <summary>
    /// Foundry session template - full access for block development.
    /// </summary>
    public static SessionTemplate Foundry => new()
    {
        Type = "foundry",
        Description = "Block development session with full access for creating and testing blocks",
        Permissions = ContextPermissions.Full,
        LogAllCommands = true,
        AllowNestedSessions = true
    };

    /// <summary>
    /// Project session template - standard access for project work.
    /// </summary>
    public static SessionTemplate Project => new()
    {
        Type = "project",
        Description = "Project session with standard permissions",
        Permissions = ContextPermissions.Standard,
        LogAllCommands = false,
        AllowNestedSessions = true
    };

    /// <summary>
    /// Evaluation session template - read-only for model evaluation.
    /// </summary>
    public static SessionTemplate Evaluation => new()
    {
        Type = "evaluation",
        Description = "Evaluation session with read-only access for model testing",
        Permissions = new ContextPermissions
        {
            AllowedCommands = new() { "run", "list-tools", "list-blocks", "describe", "data" },
            AllowedTools = new() { "system:fitness-calculator" },
            AllowedBlocks = new() { "*" },
            CanCreateBlocks = false,
            CanCreateSessions = false,
            DataCollections = new() { "experiments", "metrics" },
            AllowedPaths = new() { "data/" }
        },
        LogAllCommands = true,
        AllowNestedSessions = false,
        MaxIterations = 100 // Limit evaluation iterations
    };

    /// <summary>
    /// Sandbox session template - isolated with minimal permissions.
    /// </summary>
    public static SessionTemplate Sandbox => new()
    {
        Type = "sandbox",
        Description = "Isolated sandbox session with minimal permissions",
        Permissions = new ContextPermissions
        {
            AllowedCommands = new() { "run", "list-tools" },
            AllowedTools = new(),
            AllowedBlocks = new(),
            CanCreateBlocks = false,
            CanCreateSessions = false,
            DataCollections = new(),
            AllowedPaths = new()
        },
        LogAllCommands = true,
        AllowNestedSessions = false,
        MaxDurationMinutes = 60 // 1 hour max
    };

    /// <summary>
    /// Get all predefined session templates.
    /// </summary>
    public static Dictionary<string, SessionTemplate> GetPredefinedTemplates()
    {
        return new Dictionary<string, SessionTemplate>
        {
            ["training"] = Training,
            ["foundry"] = Foundry,
            ["project"] = Project,
            ["evaluation"] = Evaluation,
            ["sandbox"] = Sandbox
        };
    }

    /// <summary>
    /// Create a custom session template with specified permissions.
    /// </summary>
    public static SessionTemplate Create(
        string type,
        ContextPermissions permissions,
        string? description = null,
        bool logAllCommands = true)
    {
        return new SessionTemplate
        {
            Type = type,
            Description = description,
            Permissions = permissions,
            LogAllCommands = logAllCommands
        };
    }
}
