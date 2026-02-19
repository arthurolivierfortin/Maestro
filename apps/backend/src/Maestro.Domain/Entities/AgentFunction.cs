using System;
using System.Collections.Generic;

namespace Maestro.Domain.Entities
{
    /// <summary>
    /// Represents a function/role that an agent can perform
    /// </summary>
    public class AgentFunction
    {
        public string Id { get; private set; }
        public string Name { get; private set; }
        public string Category { get; private set; } // "Development", "QA", "Operations", "Research", etc.
        public string Description { get; private set; }
        public List<string> Capabilities { get; private set; } = new();
        public List<string> RequiredTools { get; private set; } = new();
        public bool IsBuiltIn { get; private set; }
        public DateTime CreatedAt { get; private set; }

        private AgentFunction() { }

        public static AgentFunction Create(
            string name,
            string category,
            string description,
            bool isBuiltIn = false)
        {
            if (string.IsNullOrWhiteSpace(name))
                throw new ArgumentException("Function name is required", nameof(name));
            if (string.IsNullOrWhiteSpace(category))
                throw new ArgumentException("Category is required", nameof(category));

            return new AgentFunction
            {
                Id = $"func-{Guid.NewGuid():N}",
                Name = name,
                Category = category,
                Description = description ?? "",
                IsBuiltIn = isBuiltIn,
                CreatedAt = DateTime.UtcNow
            };
        }

        /// <summary>
        /// Creates built-in agent functions
        /// </summary>
        public static IEnumerable<AgentFunction> GetBuiltInFunctions()
        {
            yield return CreateBuiltIn("Planner", "Development", "Creates implementation plans and breaks down tasks",
                new[] { "planning", "task-decomposition", "architecture" },
                new[] { "file-read", "search" });

            yield return CreateBuiltIn("Coder", "Development", "Writes and modifies code",
                new[] { "code-generation", "refactoring", "bug-fixing" },
                new[] { "file-read", "file-write", "search" });

            yield return CreateBuiltIn("Reviewer", "QA", "Reviews code for quality and issues",
                new[] { "code-review", "quality-analysis", "security-review" },
                new[] { "file-read", "search" });

            yield return CreateBuiltIn("Tester", "QA", "Writes and runs tests",
                new[] { "test-generation", "test-execution", "coverage-analysis" },
                new[] { "file-read", "file-write", "bash", "test-runner" });

            yield return CreateBuiltIn("Debugger", "Development", "Diagnoses and fixes bugs",
                new[] { "bug-diagnosis", "log-analysis", "fix-generation" },
                new[] { "file-read", "file-write", "bash", "search" });

            yield return CreateBuiltIn("Documenter", "Development", "Creates documentation",
                new[] { "documentation", "api-docs", "readme-generation" },
                new[] { "file-read", "file-write" });

            yield return CreateBuiltIn("Researcher", "Research", "Researches solutions and best practices",
                new[] { "research", "analysis", "recommendation" },
                new[] { "web-search", "file-read" });

            yield return CreateBuiltIn("Deployer", "Operations", "Handles deployment tasks",
                new[] { "deployment", "configuration", "monitoring" },
                new[] { "bash", "docker", "kubernetes" });
        }

        private static AgentFunction CreateBuiltIn(
            string name,
            string category,
            string description,
            string[] capabilities,
            string[] requiredTools)
        {
            var func = Create(name, category, description, true);
            func.Id = $"builtin-{name.ToLower()}";
            func.Capabilities.AddRange(capabilities);
            func.RequiredTools.AddRange(requiredTools);
            return func;
        }

        public void AddCapability(string capability)
        {
            if (!Capabilities.Contains(capability))
            {
                Capabilities.Add(capability);
            }
        }

        public void AddRequiredTool(string tool)
        {
            if (!RequiredTools.Contains(tool))
            {
                RequiredTools.Add(tool);
            }
        }
    }
}
