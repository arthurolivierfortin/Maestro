using Maestro.Domain.Entities;
using Maestro.Domain.Enums;

namespace Maestro.Infrastructure.Data;

/// <summary>
/// Provides built-in session template definitions.
/// These templates come pre-registered with Maestro and cannot be modified or deleted.
/// </summary>
public static class BuiltInSessionTemplates
{
    /// <summary>
    /// Gets all built-in session templates.
    /// </summary>
    public static IReadOnlyList<SessionTemplate> GetAll() => new List<SessionTemplate>
    {
        SessionTemplate.CreateBuiltIn(
            id: "quick-git-test",
            name: "Quick Git Test",
            sandboxImageId: "sandbox-git",
            description: "Ephemeral sandbox for testing Git operations. Perfect for testing commit workflows, branching strategies, and repository manipulation.",
            mode: EnvironmentMode.Sandbox,
            categoryId: "testing",
            icon: "🧪",
            sortOrder: 10,
            tags: new[] { "git", "testing", "quick" }
        ),

        SessionTemplate.CreateBuiltIn(
            id: "project-default",
            name: "Project Session",
            sandboxImageId: "sandbox-git",
            description: "Standard project session bound to a repository. Use for real development work with file persistence.",
            mode: EnvironmentMode.Repo,
            categoryId: "projects",
            icon: "📁",
            sortOrder: 20,
            tags: new[] { "project", "development", "repo" }
        ),

        SessionTemplate.CreateBuiltIn(
            id: "foundry-default",
            name: "Foundry Session",
            sandboxImageId: "sandbox-nodejs",
            description: "Sandbox environment for developing and testing blocks. Isolated from real projects for safe experimentation.",
            mode: EnvironmentMode.Sandbox,
            categoryId: "foundry",
            icon: "🔨",
            sortOrder: 30,
            tags: new[] { "foundry", "blocks", "development" }
        ),

        SessionTemplate.CreateBuiltIn(
            id: "training-default",
            name: "Training Session",
            sandboxImageId: "sandbox-nodejs",
            description: "Sandbox for running training and fine-tuning workflows. Ephemeral environment for model training iterations.",
            mode: EnvironmentMode.Sandbox,
            categoryId: "training",
            icon: "🎯",
            sortOrder: 40,
            tags: new[] { "training", "ml", "iteration" }
        ),

        SessionTemplate.CreateBuiltIn(
            id: "nodejs-sandbox",
            name: "Node.js Sandbox",
            sandboxImageId: "sandbox-nodejs",
            description: "Ephemeral Node.js environment for testing JavaScript/TypeScript code and npm packages.",
            mode: EnvironmentMode.Sandbox,
            categoryId: "testing",
            icon: "🟢",
            sortOrder: 50,
            tags: new[] { "nodejs", "javascript", "npm" }
        ),

        SessionTemplate.CreateBuiltIn(
            id: "python-sandbox",
            name: "Python Sandbox",
            sandboxImageId: "sandbox-python",
            description: "Ephemeral Python environment for testing scripts and pip packages.",
            mode: EnvironmentMode.Sandbox,
            categoryId: "testing",
            icon: "🐍",
            sortOrder: 60,
            tags: new[] { "python", "pip", "scripting" }
        ),

        SessionTemplate.CreateBuiltIn(
            id: "nodejs-project",
            name: "Node.js Project",
            sandboxImageId: "sandbox-nodejs",
            description: "Node.js development environment bound to a repository. Full Node.js tooling with repository persistence.",
            mode: EnvironmentMode.Repo,
            categoryId: "projects",
            icon: "📦",
            sortOrder: 70,
            tags: new[] { "nodejs", "project", "development" }
        ),

        SessionTemplate.CreateBuiltIn(
            id: "python-project",
            name: "Python Project",
            sandboxImageId: "sandbox-python",
            description: "Python development environment bound to a repository. Full Python tooling with repository persistence.",
            mode: EnvironmentMode.Repo,
            categoryId: "projects",
            icon: "📦",
            sortOrder: 80,
            tags: new[] { "python", "project", "development" }
        )
    };

    /// <summary>
    /// Gets a built-in session template by ID.
    /// </summary>
    public static SessionTemplate? GetById(string id)
    {
        return GetAll().FirstOrDefault(t => t.Id == id);
    }

    /// <summary>
    /// Checks if an ID is a built-in session template.
    /// </summary>
    public static bool IsBuiltIn(string id)
    {
        return GetAll().Any(t => t.Id == id);
    }
}
