using Maestro.Domain.Entities;

namespace Maestro.Infrastructure.Data;

/// <summary>
/// Built-in session categories provided by Maestro.
/// These serve as examples and starting points - users can create their own categories.
/// The "system" category is special and cannot be deleted.
/// </summary>
public static class BuiltInSessionCategories
{
    /// <summary>
    /// System category for system-related workflows and sessions.
    /// This category is non-deletable and always available.
    /// </summary>
    public static SessionCategory System { get; } = SessionCategory.CreateBuiltIn(
        id: "system",
        name: "System",
        description: "System-related workflows, maintenance tasks, and internal operations.",
        icon: "settings",
        color: "#6B7280",
        isSystem: true,
        displayOrder: 0
    );

    /// <summary>
    /// Projects category for repository-based work.
    /// </summary>
    public static SessionCategory Projects { get; } = SessionCategory.CreateBuiltIn(
        id: "projects",
        name: "Projects",
        description: "Sessions for working on real codebases and repositories.",
        icon: "folder-git",
        color: "#3B82F6",
        isSystem: false,
        displayOrder: 10
    );

    /// <summary>
    /// Foundry category for block development and testing.
    /// </summary>
    public static SessionCategory Foundry { get; } = SessionCategory.CreateBuiltIn(
        id: "foundry",
        name: "Foundry",
        description: "Sessions for developing, testing, and improving blocks.",
        icon: "flask",
        color: "#8B5CF6",
        isSystem: false,
        displayOrder: 20
    );

    /// <summary>
    /// Testing category for test and validation sessions.
    /// </summary>
    public static SessionCategory Testing { get; } = SessionCategory.CreateBuiltIn(
        id: "testing",
        name: "Testing",
        description: "Sessions for running tests, validations, and experiments.",
        icon: "test-tube",
        color: "#10B981",
        isSystem: false,
        displayOrder: 30
    );

    /// <summary>
    /// Training category for model training and fine-tuning.
    /// </summary>
    public static SessionCategory Training { get; } = SessionCategory.CreateBuiltIn(
        id: "training",
        name: "Training",
        description: "Sessions for model training, fine-tuning, and evaluation.",
        icon: "brain",
        color: "#F59E0B",
        isSystem: false,
        displayOrder: 40
    );

    /// <summary>
    /// All built-in categories.
    /// </summary>
    public static IReadOnlyList<SessionCategory> All { get; } = new[]
    {
        System,
        Projects,
        Foundry,
        Testing,
        Training
    };

    /// <summary>
    /// Gets all built-in categories as a dictionary for quick lookup.
    /// </summary>
    public static IReadOnlyDictionary<string, SessionCategory> ById { get; } =
        All.ToDictionary(c => c.Id);
}
