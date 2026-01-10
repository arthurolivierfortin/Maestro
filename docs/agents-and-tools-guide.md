# Agents and Tools Development Guide

> **Purpose**: This guide defines how to build specialized agents and tools for B-One Maestro, including structure, security rules, isolation patterns, and terminal usage constraints.

---

## 🎯 Agents and Tools Philosophy

### Core Principles

1. **Specialization**: Each agent has a single, well-defined purpose
2. **Model Agnosticism**: Agents **NEVER** talk directly to LLMs - always via ILLMGateway
3. **Tool Assignment**: Agents receive specific tools based on their role
4. **Sandboxed Execution**: Tools run in controlled environments with permission checks
5. **Composability**: Agents work together via workflow orchestration

### What Agents ARE

- ✅ **Specialized workers** for specific software engineering tasks
- ✅ **Prompt engineers** crafting effective prompts for LLMs
- ✅ **Tool users** leveraging assigned tools to accomplish tasks
- ✅ **Output producers** generating structured, actionable results

### What Agents are NOT

- ❌ **Not AI models** - they use models via gateway
- ❌ **Not general-purpose** - each has specific expertise
- ❌ **Not unrestricted** - sandboxed with permission controls
- ❌ **Not autonomous** - orchestrated by workflow engine

---

## 🤖 Agent Types

### 1. Planner Agent

**Purpose**: Break down high-level tasks into actionable steps

**Input**:
- Task description
- Project context
- Requirements

**Output**:
- Structured plan (JSON or Markdown)
- List of steps with dependencies
- Estimated effort

**Tools**: Minimal (read-only file access)

**Example**:
```csharp
public class PlannerAgent : AgentBase
{
    protected override string SystemPrompt => @"
        You are a senior software architect and project planner.
        Your role is to analyze requirements and create detailed,
        actionable implementation plans.
        
        Output format:
        ```json
        {
          ""steps"": [
            {
              ""id"": 1,
              ""title"": ""Set up project structure"",
              ""description"": ""Create solution and project files"",
              ""estimatedHours"": 2,
              ""dependencies"": []
            }
          ]
        }
        ```
    ";
    
    public override async Task<AgentOutput> ExecuteAsync(
        AgentInput input, 
        CancellationToken cancellationToken)
    {
        var llmRequest = new LLMRequest
        {
            SystemPrompt = SystemPrompt,
            Messages = new List<Message>
            {
                new Message 
                { 
                    Role = "user", 
                    Content = $"Create a plan for: {input.Task}" 
                }
            }
        };
        
        var response = await LLMGateway.SendAsync(llmRequest, cancellationToken);
        
        return ParsePlan(response.Content);
    }
}
```

### 2. Coder Agent

**Purpose**: Write or modify code based on specifications

**Input**:
- Requirements/specifications
- Existing codebase context
- Language and framework

**Output**:
- Code files
- Implementation notes
- Dependencies added

**Tools**: Full (file read/write, git, language-specific tools)

**Example**:
```csharp
public class CoderAgent : AgentBase
{
    protected override string SystemPrompt => @"
        You are an expert software developer.
        Write clean, maintainable, well-tested code.
        Follow the project's coding standards and architecture.
        
        Always include:
        - Proper error handling
        - XML documentation comments
        - Unit tests
    ";
    
    public override async Task<AgentOutput> ExecuteAsync(
        AgentInput input, 
        CancellationToken cancellationToken)
    {
        // Read existing code if needed
        var codeContext = await GetCodeContext(input, cancellationToken);
        
        var llmRequest = new LLMRequest
        {
            SystemPrompt = SystemPrompt,
            Messages = BuildCodingMessages(input, codeContext),
            Tools = new List<Tool>
            {
                FileSystemTool.Read,
                FileSystemTool.Write,
                GitTool.Status,
                GitTool.Add
            }
        };
        
        var response = await LLMGateway.SendAsync(llmRequest, cancellationToken);
        
        // Parse code from response
        var code = ExtractCode(response.Content);
        
        // Write code using file system tool
        await WriteCodeAsync(code, cancellationToken);
        
        return AgentOutput.Success(code);
    }
}
```

### 3. Tester Agent

**Purpose**: Create and run tests for code

**Input**:
- Code to test
- Testing framework
- Coverage requirements

**Output**:
- Test files
- Test results
- Coverage report

**Tools**: File system, bash (for running tests), language test runners

**Example**:
```csharp
public class TesterAgent : AgentBase
{
    protected override string SystemPrompt => @"
        You are a QA engineer and test automation expert.
        Write comprehensive unit tests with high coverage.
        Use the project's testing framework and conventions.
        
        Test coverage should include:
        - Happy path scenarios
        - Edge cases
        - Error conditions
        - Null/empty input handling
    ";
    
    public override async Task<AgentOutput> ExecuteAsync(
        AgentInput input, 
        CancellationToken cancellationToken)
    {
        // Generate tests
        var testCode = await GenerateTests(input, cancellationToken);
        
        // Write test file
        await WriteTestFileAsync(testCode, cancellationToken);
        
        // Run tests
        var testResults = await RunTestsAsync(cancellationToken);
        
        return AgentOutput.Success(new
        {
            TestCode = testCode,
            Results = testResults
        });
    }
    
    private async Task<TestResults> RunTestsAsync(CancellationToken cancellationToken)
    {
        // Use bash tool to run tests
        var bashTool = GetTool<BashToolExecutor>();
        var result = await bashTool.ExecuteAsync(new ToolInput
        {
            Command = "dotnet test --no-build",
            WorkingDirectory = ProjectPath
        }, cancellationToken);
        
        return ParseTestResults(result.Output);
    }
}
```

### 4. Reviewer Agent

**Purpose**: Analyze code for quality, security, and best practices

**Input**:
- Code files
- Review criteria
- Project standards

**Output**:
- Review comments
- Severity ratings
- Suggested improvements

**Tools**: Read-only file system, static analysis tools

**Example**:
```csharp
public class ReviewerAgent : AgentBase
{
    protected override string SystemPrompt => @"
        You are a senior code reviewer with expertise in:
        - Code quality and maintainability
        - Security vulnerabilities
        - Performance optimization
        - Best practices and design patterns
        
        Provide constructive feedback with:
        - Severity: Critical/High/Medium/Low/Info
        - Location: File and line number
        - Issue: What's wrong
        - Suggestion: How to fix it
    ";
    
    public override async Task<AgentOutput> ExecuteAsync(
        AgentInput input, 
        CancellationToken cancellationToken)
    {
        var code = await ReadCodeAsync(input.FilePath, cancellationToken);
        
        var llmRequest = new LLMRequest
        {
            SystemPrompt = SystemPrompt,
            Messages = new List<Message>
            {
                new Message
                {
                    Role = "user",
                    Content = $"Review this code:\n\n```csharp\n{code}\n```"
                }
            }
        };
        
        var response = await LLMGateway.SendAsync(llmRequest, cancellationToken);
        
        var reviews = ParseReviewComments(response.Content);
        
        return AgentOutput.Success(reviews);
    }
}
```

### 5. Debugger Agent

**Purpose**: Investigate and fix bugs

**Input**:
- Bug description
- Stack trace/error logs
- Relevant code

**Output**:
- Root cause analysis
- Fix suggestions
- Code patches

**Tools**: File system, git (for history), log analysis

---

## 🛠️ Tool System

### Tool Categories

#### 1. Bash Tools
Execute shell commands in controlled environment

```csharp
public class BashToolExecutor : IToolExecutor
{
    public async Task<ToolResult> ExecuteAsync(ToolInput input, CancellationToken cancellationToken)
    {
        // Validate command (no dangerous operations)
        ValidateCommand(input.Command);
        
        // Execute in sandboxed process
        using var process = new Process
        {
            StartInfo = new ProcessStartInfo
            {
                FileName = "/bin/bash",
                Arguments = $"-c \"{input.Command}\"",
                WorkingDirectory = input.WorkingDirectory,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            }
        };
        
        process.Start();
        
        var stdout = await process.StandardOutput.ReadToEndAsync();
        var stderr = await process.StandardError.ReadToEndAsync();
        
        await process.WaitForExitAsync(cancellationToken);
        
        return new ToolResult
        {
            Success = process.ExitCode == 0,
            Output = stdout,
            Error = stderr,
            ExitCode = process.ExitCode
        };
    }
    
    private void ValidateCommand(string command)
    {
        // Block dangerous commands
        var blockedCommands = new[] { "rm -rf", "dd", "mkfs", "format" };
        
        foreach (var blocked in blockedCommands)
        {
            if (command.Contains(blocked, StringComparison.OrdinalIgnoreCase))
            {
                throw new SecurityException($"Command '{blocked}' is not allowed");
            }
        }
    }
}
```

#### 2. Git Tools
Git operations (clone, commit, push, PR)

```csharp
public class GitToolExecutor : IToolExecutor
{
    public async Task<ToolResult> ExecuteAsync(ToolInput input, CancellationToken cancellationToken)
    {
        return input.Operation switch
        {
            "status" => await GetStatusAsync(input.WorkingDirectory, cancellationToken),
            "add" => await AddFilesAsync(input.Files, input.WorkingDirectory, cancellationToken),
            "commit" => await CommitAsync(input.Message, input.WorkingDirectory, cancellationToken),
            "push" => await PushAsync(input.WorkingDirectory, cancellationToken),
            _ => throw new ArgumentException($"Unknown git operation: {input.Operation}")
        };
    }
    
    private async Task<ToolResult> CommitAsync(string message, string workingDirectory, CancellationToken cancellationToken)
    {
        using var repo = new Repository(workingDirectory);
        
        var signature = new Signature("B-One Maestro", "maestro@example.com", DateTimeOffset.Now);
        var commit = repo.Commit(message, signature, signature);
        
        return ToolResult.Success($"Committed {commit.Sha}");
    }
}
```

#### 3. File System Tools
Read/write files with sandboxing

```csharp
public class FileSystemToolExecutor : IToolExecutor
{
    private readonly string _projectRoot;
    
    public async Task<ToolResult> ExecuteAsync(ToolInput input, CancellationToken cancellationToken)
    {
        // Validate path is within project directory
        var fullPath = Path.GetFullPath(Path.Combine(_projectRoot, input.FilePath));
        if (!fullPath.StartsWith(_projectRoot))
        {
            throw new SecurityException("Access denied: Path outside project directory");
        }
        
        return input.Operation switch
        {
            "read" => await ReadFileAsync(fullPath, cancellationToken),
            "write" => await WriteFileAsync(fullPath, input.Content, cancellationToken),
            "list" => await ListDirectoryAsync(fullPath, cancellationToken),
            _ => throw new ArgumentException($"Unknown operation: {input.Operation}")
        };
    }
}
```

#### 4. Language-Specific Tools
.NET, npm, pip, etc.

```csharp
public class DotNetToolExecutor : IToolExecutor
{
    public async Task<ToolResult> ExecuteAsync(ToolInput input, CancellationToken cancellationToken)
    {
        var command = input.Operation switch
        {
            "build" => "dotnet build",
            "test" => "dotnet test",
            "restore" => "dotnet restore",
            _ => throw new ArgumentException($"Unknown operation: {input.Operation}")
        };
        
        // Delegate to bash tool
        var bashTool = new BashToolExecutor();
        return await bashTool.ExecuteAsync(new ToolInput
        {
            Command = command,
            WorkingDirectory = input.WorkingDirectory
        }, cancellationToken);
    }
}
```

---

## 🔒 Security and Isolation

### Sandboxing Rules

1. **File System Access**: Restricted to project directory
2. **Command Execution**: Whitelist of allowed commands
3. **Network Access**: Optional, disabled by default
4. **Resource Limits**: CPU, memory, execution time limits
5. **Privilege Escalation**: Denied (no sudo, no root)

### Permission Model

```csharp
public class ToolPermissions
{
    public bool AllowFileRead { get; set; }
    public bool AllowFileWrite { get; set; }
    public bool AllowExecution { get; set; }
    public bool AllowNetworkAccess { get; set; }
    public List<string> AllowedPaths { get; set; } = new();
    public List<string> AllowedCommands { get; set; } = new();
}

public class ToolExecutionContext
{
    public ToolPermissions Permissions { get; set; }
    public string ProjectRoot { get; set; }
    public Dictionary<string, string> EnvironmentVariables { get; set; }
    
    public void ValidateAccess(string operation, string path)
    {
        if (operation == "write" && !Permissions.AllowFileWrite)
        {
            throw new UnauthorizedAccessException("Write access denied");
        }
        
        var fullPath = Path.GetFullPath(path);
        if (!fullPath.StartsWith(ProjectRoot))
        {
            throw new UnauthorizedAccessException("Access denied: Outside project directory");
        }
    }
}
```

### Agent-Tool Assignment

```csharp
public static class AgentToolConfiguration
{
    public static ToolPermissions GetPermissions(AgentType agentType)
    {
        return agentType switch
        {
            AgentType.Planner => new ToolPermissions
            {
                AllowFileRead = true,
                AllowFileWrite = false,
                AllowExecution = false
            },
            
            AgentType.Coder => new ToolPermissions
            {
                AllowFileRead = true,
                AllowFileWrite = true,
                AllowExecution = true,
                AllowedCommands = new List<string> { "dotnet", "git" }
            },
            
            AgentType.Tester => new ToolPermissions
            {
                AllowFileRead = true,
                AllowFileWrite = true,
                AllowExecution = true,
                AllowedCommands = new List<string> { "dotnet test", "npm test" }
            },
            
            AgentType.Reviewer => new ToolPermissions
            {
                AllowFileRead = true,
                AllowFileWrite = false,
                AllowExecution = false
            },
            
            _ => throw new ArgumentException($"Unknown agent type: {agentType}")
        };
    }
}
```

---

## 📟 Terminal Usage Constraints

### Terminal Output Streaming

```csharp
public class TerminalOutputStreamer : ITerminalOutputStreamer
{
    private readonly IHubContext<ExecutionHub> _hubContext;
    
    public async Task StreamOutputAsync(
        ExecutionId executionId, 
        string output, 
        CancellationToken cancellationToken)
    {
        // Parse ANSI color codes
        var parsedOutput = ParseANSI(output);
        
        // Broadcast to connected clients
        await _hubContext.Clients
            .Group(executionId.ToString())
            .SendAsync("TerminalOutput", parsedOutput, cancellationToken);
    }
    
    private TerminalOutput ParseANSI(string rawOutput)
    {
        // Parse ANSI color codes for frontend display
        // \x1b[31m = red, \x1b[32m = green, etc.
        return new TerminalOutput
        {
            Text = rawOutput,
            ColorSegments = ExtractColorSegments(rawOutput)
        };
    }
}
```

### Interactive Terminal (Future)

For agents that need interactive prompts:

```csharp
public class InteractiveTerminalSession
{
    public async Task<string> PromptUserAsync(string prompt, CancellationToken cancellationToken)
    {
        // Send prompt to frontend
        await _hub.Clients.Group(ExecutionId).SendAsync("TerminalPrompt", prompt);
        
        // Wait for user response
        var response = await WaitForUserInput(cancellationToken);
        
        return response;
    }
}
```

---

## 🚫 Anti-Patterns to Avoid

### ❌ Direct LLM SDK Usage

```csharp
// ❌ BAD: Agent using OpenAI directly
using OpenAI;

public class CoderAgent
{
    private readonly OpenAIClient _client; // ❌ NEVER!
    
    public async Task<AgentOutput> ExecuteAsync(AgentInput input)
    {
        var response = await _client.Chat.CompleteChatAsync(...); // ❌
    }
}

// ✅ GOOD: Agent using ILLMGateway
public class CoderAgent : AgentBase
{
    protected ILLMGateway LLMGateway { get; } // ✅ Abstraction
    
    public async Task<AgentOutput> ExecuteAsync(AgentInput input)
    {
        var response = await LLMGateway.SendAsync(new LLMRequest { ... }); // ✅
    }
}
```

### ❌ Unrestricted File Access

```csharp
// ❌ BAD: No path validation
public async Task<string> ReadFile(string path)
{
    return await File.ReadAllTextAsync(path); // ❌ Can access anything!
}

// ✅ GOOD: Validated, sandboxed access
public async Task<string> ReadFile(string relativePath)
{
    var fullPath = Path.GetFullPath(Path.Combine(_projectRoot, relativePath));
    
    if (!fullPath.StartsWith(_projectRoot)) // ✅ Validation
    {
        throw new SecurityException("Access denied");
    }
    
    return await File.ReadAllTextAsync(fullPath);
}
```

---

## 🔗 Related Documentation

- [README.md](../README.md) - Project overview
- [Backend Guide](./backend-guide.md) - Backend development guide
- [Workflow Engine Guide](./workflow-engine-guide.md) - Workflow execution guide
- [ROADMAP.md](../ROADMAP.md) - Development roadmap

---

**Last Updated**: 2026-01-10  
**Maintained by**: Backend Team
