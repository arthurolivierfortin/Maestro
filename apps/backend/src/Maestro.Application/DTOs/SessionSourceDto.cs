using Maestro.Domain.Configuration;

namespace Maestro.Application.DTOs;

/// <summary>
/// DTO for session source type.
/// </summary>
public enum SessionSourceDto
{
    /// <summary>
    /// Isolated sandbox (default).
    /// </summary>
    Sandbox,

    /// <summary>
    /// Bound to a local repository.
    /// </summary>
    Repository
}

/// <summary>
/// DTO for repository access level.
/// </summary>
public enum RepositoryAccessLevelDto
{
    /// <summary>
    /// Read-only access.
    /// </summary>
    ReadOnly,

    /// <summary>
    /// Controlled access with staged changes.
    /// </summary>
    Controlled,

    /// <summary>
    /// Full unrestricted access.
    /// </summary>
    Full
}

/// <summary>
/// DTO for repository source configuration.
/// </summary>
public class RepositorySourceConfigDto
{
    /// <summary>
    /// Path to the repository on the host system.
    /// </summary>
    public string RepositoryPath { get; set; } = string.Empty;

    /// <summary>
    /// Path inside the Docker container where the repository will be mounted.
    /// </summary>
    public string DockerBindPath { get; set; } = "/workspace";

    /// <summary>
    /// Access level for the repository mount.
    /// </summary>
    public string AccessLevel { get; set; } = "controlled";

    /// <summary>
    /// Branch to checkout (optional).
    /// </summary>
    public string? Branch { get; set; }

    /// <summary>
    /// File patterns to exclude from access.
    /// </summary>
    public List<string> ExcludePatterns { get; set; } = new()
    {
        ".env",
        ".env.*",
        "*.pem",
        "*.key",
        "secrets/"
    };

    public static RepositorySourceConfigDto FromDomain(RepositorySourceConfig config)
    {
        return new RepositorySourceConfigDto
        {
            RepositoryPath = config.RepositoryPath,
            DockerBindPath = config.DockerBindPath,
            AccessLevel = config.AccessLevel.ToString().ToLowerInvariant(),
            Branch = config.Branch,
            ExcludePatterns = config.ExcludePatterns.ToList()
        };
    }

    public RepositorySourceConfig ToDomain()
    {
        return new RepositorySourceConfig
        {
            RepositoryPath = RepositoryPath,
            DockerBindPath = DockerBindPath,
            AccessLevel = Enum.TryParse<RepositoryAccessLevel>(AccessLevel, true, out var level)
                ? level
                : RepositoryAccessLevel.Controlled,
            Branch = Branch,
            ExcludePatterns = ExcludePatterns
        };
    }
}

/// <summary>
/// DTO for Foundry session configuration.
/// </summary>
public class FoundrySessionConfigDto
{
    /// <summary>
    /// The draft ID to work on.
    /// </summary>
    public string? DraftId { get; set; }

    /// <summary>
    /// Session source type.
    /// </summary>
    public string Source { get; set; } = "sandbox";

    /// <summary>
    /// Repository source configuration (when source is repository).
    /// </summary>
    public RepositorySourceConfigDto? RepositoryConfig { get; set; }

    /// <summary>
    /// Training run configuration.
    /// </summary>
    public TrainingRunConfigDto Training { get; set; } = new();

    /// <summary>
    /// Evaluation configuration.
    /// </summary>
    public EvaluationConfigDto Evaluation { get; set; } = new();

    public static FoundrySessionConfigDto FromDomain(FoundrySessionConfig config)
    {
        return new FoundrySessionConfigDto
        {
            DraftId = config.DraftId,
            Source = config.Source.ToString().ToLowerInvariant(),
            RepositoryConfig = config.RepositoryConfig != null
                ? RepositorySourceConfigDto.FromDomain(config.RepositoryConfig)
                : null,
            Training = TrainingRunConfigDto.FromDomain(config.Training),
            Evaluation = EvaluationConfigDto.FromDomain(config.Evaluation)
        };
    }

    public FoundrySessionConfig ToDomain()
    {
        return new FoundrySessionConfig
        {
            DraftId = DraftId,
            Source = Enum.TryParse<SessionSource>(Source, true, out var source)
                ? source
                : SessionSource.Sandbox,
            RepositoryConfig = RepositoryConfig?.ToDomain(),
            Training = Training.ToDomain(),
            Evaluation = Evaluation.ToDomain()
        };
    }
}

/// <summary>
/// DTO for training run configuration.
/// </summary>
public class TrainingRunConfigDto
{
    public int Iterations { get; set; } = 10;
    public int Parallel { get; set; } = 1;
    public int DelayMs { get; set; } = 0;
    public int TimeoutMs { get; set; } = 60000;
    public List<Dictionary<string, object>> Inputs { get; set; } = new();
    public List<string> Tags { get; set; } = new();

    public static TrainingRunConfigDto FromDomain(TrainingRunConfig config)
    {
        return new TrainingRunConfigDto
        {
            Iterations = config.Iterations,
            Parallel = config.Parallel,
            DelayMs = config.DelayMs,
            TimeoutMs = config.TimeoutMs,
            Inputs = config.Inputs.Select(i => new Dictionary<string, object>(i)).ToList(),
            Tags = config.Tags.ToList()
        };
    }

    public TrainingRunConfig ToDomain()
    {
        return new TrainingRunConfig
        {
            Iterations = Iterations,
            Parallel = Parallel,
            DelayMs = DelayMs,
            TimeoutMs = TimeoutMs,
            Inputs = Inputs.Select(i => (IDictionary<string, object>)new Dictionary<string, object>(i)).ToList(),
            Tags = Tags
        };
    }
}

/// <summary>
/// DTO for evaluation configuration.
/// </summary>
public class EvaluationConfigDto
{
    public string Mode { get; set; } = "manual";
    public AutoEvaluatorConfigDto? AutoEvaluator { get; set; }
    public List<string> Criteria { get; set; } = new() { "Correctness", "Quality", "Efficiency" };
    public double PassThreshold { get; set; } = 0.7;
    public double HumanReviewThreshold { get; set; } = 0.5;

    public static EvaluationConfigDto FromDomain(EvaluationConfig config)
    {
        return new EvaluationConfigDto
        {
            Mode = config.Mode.ToString().ToLowerInvariant(),
            AutoEvaluator = config.AutoEvaluator != null
                ? AutoEvaluatorConfigDto.FromDomain(config.AutoEvaluator)
                : null,
            Criteria = config.Criteria.ToList(),
            PassThreshold = config.PassThreshold,
            HumanReviewThreshold = config.HumanReviewThreshold
        };
    }

    public EvaluationConfig ToDomain()
    {
        return new EvaluationConfig
        {
            Mode = Enum.TryParse<EvaluationMode>(Mode, true, out var mode)
                ? mode
                : EvaluationMode.Manual,
            AutoEvaluator = AutoEvaluator?.ToDomain(),
            Criteria = Criteria,
            PassThreshold = PassThreshold,
            HumanReviewThreshold = HumanReviewThreshold
        };
    }
}

/// <summary>
/// DTO for auto-evaluator configuration.
/// </summary>
public class AutoEvaluatorConfigDto
{
    public string Type { get; set; } = "llm";
    public string? ModelId { get; set; }
    public string? AgentId { get; set; }
    public string? EvaluationPrompt { get; set; }
    public List<HeuristicRuleDto>? HeuristicRules { get; set; }

    public static AutoEvaluatorConfigDto FromDomain(AutoEvaluatorConfig config)
    {
        return new AutoEvaluatorConfigDto
        {
            Type = config.Type.ToString().ToLowerInvariant(),
            ModelId = config.ModelId,
            AgentId = config.AgentId,
            EvaluationPrompt = config.EvaluationPrompt,
            HeuristicRules = config.HeuristicRules?.Select(HeuristicRuleDto.FromDomain).ToList()
        };
    }

    public AutoEvaluatorConfig ToDomain()
    {
        return new AutoEvaluatorConfig
        {
            Type = Enum.TryParse<EvaluatorType>(Type, true, out var type)
                ? type
                : EvaluatorType.LLM,
            ModelId = ModelId,
            AgentId = AgentId,
            EvaluationPrompt = EvaluationPrompt,
            HeuristicRules = HeuristicRules?.Select(r => r.ToDomain()).ToList()
        };
    }
}

/// <summary>
/// DTO for heuristic rule.
/// </summary>
public class HeuristicRuleDto
{
    public string Name { get; set; } = string.Empty;
    public string CheckType { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
    public double Weight { get; set; } = 1.0;

    public static HeuristicRuleDto FromDomain(HeuristicRule rule)
    {
        return new HeuristicRuleDto
        {
            Name = rule.Name,
            CheckType = rule.CheckType,
            Value = rule.Value,
            Weight = rule.Weight
        };
    }

    public HeuristicRule ToDomain()
    {
        return new HeuristicRule
        {
            Name = Name,
            CheckType = CheckType,
            Value = Value,
            Weight = Weight
        };
    }
}

/// <summary>
/// Request to create a Foundry session.
/// </summary>
public class CreateFoundrySessionRequest
{
    /// <summary>
    /// Session name.
    /// </summary>
    public string? Name { get; set; }

    /// <summary>
    /// Authority for the session (human, agent, ai).
    /// </summary>
    public string Authority { get; set; } = "human";

    /// <summary>
    /// Session source type (sandbox or repository).
    /// </summary>
    public string Source { get; set; } = "sandbox";

    /// <summary>
    /// Repository configuration (when source is repository).
    /// </summary>
    public RepositorySourceConfigDto? RepositoryConfig { get; set; }

    /// <summary>
    /// Draft ID to load.
    /// </summary>
    public string? DraftId { get; set; }

    /// <summary>
    /// Training configuration.
    /// </summary>
    public TrainingRunConfigDto? Training { get; set; }

    /// <summary>
    /// Evaluation configuration.
    /// </summary>
    public EvaluationConfigDto? Evaluation { get; set; }
}
