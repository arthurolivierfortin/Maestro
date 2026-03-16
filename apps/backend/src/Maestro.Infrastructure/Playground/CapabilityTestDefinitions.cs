namespace Maestro.Infrastructure.Playground;

/// <summary>
/// Static definitions for the 6 capability tests.
/// Each test has a system prompt, user prompt, and a validator config.
/// </summary>
public static class CapabilityTestDefinitions
{
    public static readonly List<CapabilityTestDefinition> All = new()
    {
        new CapabilityTestDefinition
        {
            Id = "structured-output",
            Name = "Structured Output (JSON)",
            Description = "Validates the model can produce well-formed JSON with required fields.",
            Category = "output-format",
            SystemPrompt = "You must respond ONLY with a JSON object. No explanation.",
            UserPrompt = "Describe a software developer with fields: name (string), age (number), skills (array of strings)",
            ValidatorType = ValidatorType.Json,
            ValidatorConfig = new JsonValidatorConfig
            {
                RequiredFields = new[] { "name", "age", "skills" }
            }
        },
        new CapabilityTestDefinition
        {
            Id = "tool-calling",
            Name = "Tool Calling",
            Description = "Validates the model can produce a tool call in JSON format with tool and args.",
            Category = "tool-use",
            SystemPrompt = "When asked to perform an action, respond with a JSON tool call: {\"tool\":\"<name>\",\"args\":{...}}",
            UserPrompt = "Search for files matching *.ts in the src directory",
            ValidatorType = ValidatorType.ToolCall,
            ValidatorConfig = null
        },
        new CapabilityTestDefinition
        {
            Id = "long-context",
            Name = "Long Context",
            Description = "Validates the model can extract a specific detail from a long passage.",
            Category = "comprehension",
            SystemPrompt = "Read the following text carefully and answer the question at the end.",
            UserPrompt = BuildLongContextPrompt(),
            ValidatorType = ValidatorType.ContainsAny,
            ValidatorConfig = new ContainsAnyValidatorConfig
            {
                Words = new[] { "blue", "Blue", "BLUE" }
            }
        },
        new CapabilityTestDefinition
        {
            Id = "code-generation",
            Name = "Code Generation",
            Description = "Validates the model can generate syntactically plausible code.",
            Category = "code",
            SystemPrompt = "You are a code generator. Respond only with code, no explanations.",
            UserPrompt = "Write a TypeScript function that checks if a number is prime",
            ValidatorType = ValidatorType.Contains,
            ValidatorConfig = new ContainsValidatorConfig
            {
                ExpectedTexts = new[] { "function", "return" }
            }
        },
        new CapabilityTestDefinition
        {
            Id = "instruction-following",
            Name = "Instruction Following",
            Description = "Validates the model follows exact formatting constraints (3 bullet points).",
            Category = "instruction",
            SystemPrompt = "Follow instructions exactly. Do not add extra content.",
            UserPrompt = "List exactly 3 benefits of unit testing. Use bullet points starting with -",
            ValidatorType = ValidatorType.LineCount,
            ValidatorConfig = new LineCountValidatorConfig
            {
                ExpectedCount = 3,
                LinePrefix = "-"
            }
        },
        new CapabilityTestDefinition
        {
            Id = "multi-language",
            Name = "Multi-Language",
            Description = "Validates the model can respond in a specified language (French).",
            Category = "language",
            SystemPrompt = "Respond in the language specified by the user.",
            UserPrompt = "Explain what an API is in French.",
            ValidatorType = ValidatorType.ContainsAny,
            ValidatorConfig = new ContainsAnyValidatorConfig
            {
                Words = new[] { "le", "la", "les", "est", "une", "des", "un", "qui", "que", "dans", "pour", "avec" }
            }
        }
    };

    private static string BuildLongContextPrompt()
    {
        // Build a 2000+ character passage with a specific buried detail
        var paragraphs = new[]
        {
            "Paragraph 1: The annual technology conference was held in downtown Seattle on a rainy Tuesday morning. " +
            "Hundreds of developers from around the world gathered in the main hall, exchanging ideas about the future " +
            "of software development. The keynote speaker discussed the importance of open-source collaboration and how " +
            "it has transformed the industry over the past decade. Several workshops were organized on topics ranging " +
            "from machine learning to cloud infrastructure. The atmosphere was electric with excitement and possibility.",

            "Paragraph 2: During the lunch break, participants explored the exhibition hall where dozens of companies " +
            "showcased their latest products. A startup from Berlin demonstrated an innovative code review tool that " +
            "uses AI to detect potential security vulnerabilities. Another company presented a real-time collaboration " +
            "platform designed for remote development teams. The food was catered by a local restaurant, offering a " +
            "variety of options including vegetarian and vegan dishes. Many attendees used this time to network and " +
            "exchange business cards.",

            "Paragraph 3: After lunch, a panel discussion took place about the future of autonomous vehicles. One of " +
            "the panelists mentioned that their company had recently completed a cross-country test drive with a blue " +
            "car that traveled over 3,000 miles without human intervention. The car was equipped with 12 cameras, 5 " +
            "LIDAR sensors, and a custom neural network trained on millions of miles of driving data. The audience " +
            "was particularly impressed by the safety record achieved during the test.",

            "Paragraph 4: The afternoon sessions focused on developer tools and productivity. A popular talk covered " +
            "the evolution of integrated development environments and how modern IDEs leverage language servers for " +
            "intelligent code completion. Another session explored the use of containerization in microservices " +
            "architecture, comparing Docker and Podman. The day concluded with a networking event on the rooftop " +
            "terrace, where attendees enjoyed stunning views of the city skyline while discussing the day's highlights."
        };

        return string.Join("\n\n", paragraphs)
               + "\n\nQuestion: What color was the car mentioned in paragraph 3?";
    }
}

/// <summary>
/// A capability test definition with system/user prompts and validation config.
/// </summary>
public class CapabilityTestDefinition
{
    public string Id { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string Description { get; init; } = string.Empty;
    public string Category { get; init; } = string.Empty;
    public string SystemPrompt { get; init; } = string.Empty;
    public string UserPrompt { get; init; } = string.Empty;
    public ValidatorType ValidatorType { get; init; }
    public IValidatorConfig? ValidatorConfig { get; init; }
}

public enum ValidatorType
{
    Json,
    Contains,
    ToolCall,
    LineCount,
    ContainsAny
}

// Validator config types

public interface IValidatorConfig { }

public class JsonValidatorConfig : IValidatorConfig
{
    public string[] RequiredFields { get; init; } = Array.Empty<string>();
}

public class ContainsValidatorConfig : IValidatorConfig
{
    public string[] ExpectedTexts { get; init; } = Array.Empty<string>();
}

public class ContainsAnyValidatorConfig : IValidatorConfig
{
    public string[] Words { get; init; } = Array.Empty<string>();
}

public class LineCountValidatorConfig : IValidatorConfig
{
    public int ExpectedCount { get; init; }
    public string LinePrefix { get; init; } = string.Empty;
}
