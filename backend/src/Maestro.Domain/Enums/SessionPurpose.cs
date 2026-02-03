namespace Maestro.Domain.Enums;

/// <summary>
/// Purpose of a session - categorizes the intended use.
/// </summary>
public enum SessionPurpose
{
    /// <summary>
    /// Interactive session for general-purpose use, exploration, and ad-hoc tasks.
    /// </summary>
    Interactive,

    /// <summary>
    /// Project session for executing workflows on real codebases.
    /// </summary>
    Project,

    /// <summary>
    /// Foundry session for developing, testing, and improving blocks.
    /// </summary>
    Foundry,

    /// <summary>
    /// Training session for running model training and fine-tuning workflows.
    /// </summary>
    Training
}
