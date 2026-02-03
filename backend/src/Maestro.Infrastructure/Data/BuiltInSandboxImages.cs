using Maestro.Domain.Entities;

namespace Maestro.Infrastructure.Data;

/// <summary>
/// Provides built-in sandbox image definitions.
/// These images come pre-registered with Maestro and cannot be modified or deleted.
/// </summary>
public static class BuiltInSandboxImages
{
    /// <summary>
    /// Gets all built-in sandbox images.
    /// </summary>
    public static IReadOnlyList<SandboxImage> GetAll() => new List<SandboxImage>
    {
        SandboxImage.CreateBuiltIn(
            id: "sandbox-empty",
            name: "Empty Sandbox",
            dockerImage: "alpine:3.19",
            description: "Minimal Alpine-based sandbox with only basic shell. Use for simple tests or as a base for custom setups.",
            tools: new[] { "sh" },
            tags: new[] { "minimal", "alpine" }
        ),

        SandboxImage.CreateBuiltIn(
            id: "sandbox-git",
            name: "Git Sandbox",
            dockerImage: "maestro/sandbox-git:latest",
            description: "Sandbox with Git, Bash, and common CLI tools. Ideal for testing Git operations, commit workflows, and repository management.",
            tools: new[] { "git", "bash", "curl", "wget", "jq" },
            tags: new[] { "git", "vcs", "bash" }
        ),

        SandboxImage.CreateBuiltIn(
            id: "sandbox-nodejs",
            name: "Node.js Sandbox",
            dockerImage: "maestro/sandbox-nodejs:latest",
            description: "Node.js development environment with npm, Git, and common tools. Perfect for JavaScript/TypeScript projects and npm package testing.",
            tools: new[] { "node", "npm", "npx", "git", "bash", "curl" },
            tags: new[] { "nodejs", "javascript", "typescript", "npm" }
        ),

        SandboxImage.CreateBuiltIn(
            id: "sandbox-python",
            name: "Python Sandbox",
            dockerImage: "maestro/sandbox-python:latest",
            description: "Python development environment with pip, Git, and common tools. Suitable for Python projects, scripts, and pip package testing.",
            tools: new[] { "python3", "pip", "git", "bash", "curl" },
            tags: new[] { "python", "pip", "scripting" }
        )
    };

    /// <summary>
    /// Gets a built-in sandbox image by ID.
    /// </summary>
    public static SandboxImage? GetById(string id)
    {
        return GetAll().FirstOrDefault(i => i.Id == id);
    }

    /// <summary>
    /// Checks if an ID is a built-in sandbox image.
    /// </summary>
    public static bool IsBuiltIn(string id)
    {
        return GetAll().Any(i => i.Id == id);
    }
}
