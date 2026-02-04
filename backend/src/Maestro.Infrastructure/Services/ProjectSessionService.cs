using System.Diagnostics;
using System.Text;
using Maestro.Application.Interfaces;
using Maestro.Domain.Configuration;
using Maestro.Domain.Entities;
using Maestro.Domain.Enums;
using Maestro.Domain.ValueObjects;
using Microsoft.Extensions.Logging;

namespace Maestro.Infrastructure.Services;

/// <summary>
/// Service for managing project session operations.
/// Orchestrates workflow execution, diff generation, testing, and Git operations.
/// </summary>
public class ProjectSessionService : IProjectSessionService
{
    private readonly IProjectSessionRepository _sessionRepository;
    private readonly IProjectRepository _projectRepository;
    private readonly IWorkflowExecutor _workflowExecutor;
    private readonly IBlockRepository _blockRepository;
    private readonly ILogger<ProjectSessionService> _logger;

    public ProjectSessionService(
        IProjectSessionRepository sessionRepository,
        IProjectRepository projectRepository,
        IWorkflowExecutor workflowExecutor,
        IBlockRepository blockRepository,
        ILogger<ProjectSessionService> logger)
    {
        _sessionRepository = sessionRepository;
        _projectRepository = projectRepository;
        _workflowExecutor = workflowExecutor;
        _blockRepository = blockRepository;
        _logger = logger;
    }

    public async Task<ProjectSession> CreateAsync(
        string name,
        ProjectSessionConfig config,
        CancellationToken ct = default)
    {
        // Validate project exists
        var project = await FindProjectByIdAsync(config.ProjectId, ct);
        if (project == null)
        {
            throw new InvalidOperationException($"Project {config.ProjectId} not found");
        }

        // Create session with default human authority
        var session = ProjectSession.Create(name, Authority.Human(), config);
        await _sessionRepository.SaveAsync(session, ct);

        _logger.LogInformation("Created session {SessionId} for project {ProjectId}",
            session.Id, config.ProjectId);

        return session;
    }

    public Task<ProjectSession?> GetAsync(SessionId id, CancellationToken ct = default)
    {
        return _sessionRepository.GetByIdAsync(id, ct);
    }

    public Task<IEnumerable<ProjectSession>> GetAllAsync(
        SessionStatus? status = null,
        string? projectId = null,
        string? workflowId = null,
        int? limit = null,
        CancellationToken ct = default)
    {
        return _sessionRepository.GetAllAsync(status, projectId, workflowId, limit, ct);
    }

    public async Task<ProjectSession> StartAsync(SessionId id, CancellationToken ct = default)
    {
        var session = await _sessionRepository.GetByIdAsync(id, ct);
        if (session == null)
        {
            throw new InvalidOperationException($"Session {id.Value} not found");
        }

        var project = await FindProjectByIdAsync(session.Config.ProjectId, ct);
        if (project == null)
        {
            throw new InvalidOperationException($"Project {session.Config.ProjectId} not found");
        }

        // Start the session
        session.Start();
        await _sessionRepository.SaveAsync(session, ct);

        _logger.LogInformation("Starting session {SessionId}", id.Value);

        try
        {
            // Get workflow blocks
            var workflow = await LoadWorkflowAsync(session.Config.WorkflowId, ct);
            if (workflow == null)
            {
                throw new InvalidOperationException($"Workflow {session.Config.WorkflowId} not found");
            }

            // Prepare inputs
            var inputs = new Dictionary<string, object>(session.Config.Inputs)
            {
                ["task"] = session.Config.Task,
                ["projectPath"] = project.RootPath
            };

            if (session.Config.Context != null)
            {
                inputs["context"] = session.Config.Context;
            }

            // Execute workflow
            var result = await _workflowExecutor.ExecuteAsync(
                workflow,
                inputs,
                new ExecutionOptions(MaxParallelism: 4, MaxRetries: 3),
                null,
                ct);

            if (result.Success)
            {
                session.Complete();
                _logger.LogInformation("Session {SessionId} completed successfully", id.Value);
            }
            else
            {
                session.Fail(result.Error ?? "Unknown error");
                _logger.LogWarning("Session {SessionId} failed: {Error}", id.Value, result.Error);
            }
        }
        catch (Exception ex)
        {
            session.Fail(ex.Message);
            _logger.LogError(ex, "Session {SessionId} failed with exception", id.Value);
        }

        await _sessionRepository.SaveAsync(session, ct);
        return session;
    }

    public async Task<SessionDiff> GetDiffAsync(SessionId id, CancellationToken ct = default)
    {
        var session = await _sessionRepository.GetByIdAsync(id, ct);
        if (session == null)
        {
            throw new InvalidOperationException($"Session {id.Value} not found");
        }

        var project = await FindProjectByIdAsync(session.Config.ProjectId, ct);
        if (project == null)
        {
            throw new InvalidOperationException($"Project {session.Config.ProjectId} not found");
        }

        return await GenerateGitDiffAsync(project.RootPath, ct);
    }

    public async Task<TestResult> RunTestsAsync(SessionId id, string? testCommand = null, CancellationToken ct = default)
    {
        var session = await _sessionRepository.GetByIdAsync(id, ct);
        if (session == null)
        {
            throw new InvalidOperationException($"Session {id.Value} not found");
        }

        var project = await FindProjectByIdAsync(session.Config.ProjectId, ct);
        if (project == null)
        {
            throw new InvalidOperationException($"Project {session.Config.ProjectId} not found");
        }

        // Determine test command
        var command = testCommand ?? session.Config.Validation.TestCommand;
        if (string.IsNullOrEmpty(command))
        {
            // Try to detect test command based on project
            command = DetectTestCommand(project.RootPath);
        }

        if (string.IsNullOrEmpty(command))
        {
            return new TestResult
            {
                Passed = false,
                Output = "No test command specified and could not auto-detect"
            };
        }

        _logger.LogInformation("Running tests for session {SessionId} with command: {Command}",
            id.Value, command);

        var stopwatch = Stopwatch.StartNew();
        var result = await ExecuteCommandAsync(project.RootPath, command, ct);
        stopwatch.Stop();

        var testResult = ParseTestResult(result, stopwatch.ElapsedMilliseconds);

        // Store result in session
        session.SetTestResult(testResult);
        await _sessionRepository.SaveAsync(session, ct);

        return testResult;
    }

    public async Task<CommitInfo> CommitAsync(
        SessionId id,
        string message,
        string? branch = null,
        bool push = false,
        CancellationToken ct = default)
    {
        var session = await _sessionRepository.GetByIdAsync(id, ct);
        if (session == null)
        {
            throw new InvalidOperationException($"Session {id.Value} not found");
        }

        var project = await FindProjectByIdAsync(session.Config.ProjectId, ct);
        if (project == null)
        {
            throw new InvalidOperationException($"Project {session.Config.ProjectId} not found");
        }

        var projectPath = project.RootPath;

        // Get current branch if not specified
        var currentBranch = branch ?? await GetCurrentBranchAsync(projectPath, ct);

        // Create new branch if specified and different from current
        if (branch != null && branch != currentBranch)
        {
            await ExecuteCommandAsync(projectPath, $"git checkout -b {branch}", ct);
            currentBranch = branch;
        }

        // Stage all changes
        await ExecuteCommandAsync(projectPath, "git add -A", ct);

        // Commit
        var commitResult = await ExecuteCommandAsync(projectPath,
            $"git commit -m \"{message.Replace("\"", "\\\"")}\"", ct);

        if (commitResult.ExitCode != 0)
        {
            throw new InvalidOperationException($"Git commit failed: {commitResult.StandardError}");
        }

        // Get commit hash
        var hashResult = await ExecuteCommandAsync(projectPath, "git rev-parse HEAD", ct);
        var commitHash = hashResult.StandardOutput.Trim();

        // Push if requested
        if (push)
        {
            await ExecuteCommandAsync(projectPath, $"git push -u origin {currentBranch}", ct);
        }

        var commitInfo = new CommitInfo
        {
            CommitHash = commitHash,
            Message = message,
            Branch = currentBranch,
            Pushed = push,
            CreatedAt = DateTime.UtcNow
        };

        // Store in session
        session.SetCommitInfo(commitInfo);
        await _sessionRepository.SaveAsync(session, ct);

        _logger.LogInformation("Committed changes for session {SessionId}: {CommitHash}",
            id.Value, commitHash);

        return commitInfo;
    }

    public async Task<ProjectSession> CancelAsync(SessionId id, bool discardChanges = true, CancellationToken ct = default)
    {
        var session = await _sessionRepository.GetByIdAsync(id, ct);
        if (session == null)
        {
            throw new InvalidOperationException($"Session {id.Value} not found");
        }

        session.Cancel();

        if (discardChanges)
        {
            var project = await FindProjectByIdAsync(session.Config.ProjectId, ct);
            if (project != null)
            {
                // Discard all changes
                await ExecuteCommandAsync(project.RootPath, "git checkout -- .", ct);
                await ExecuteCommandAsync(project.RootPath, "git clean -fd", ct);
            }
        }

        await _sessionRepository.SaveAsync(session, ct);

        _logger.LogInformation("Cancelled session {SessionId}, discardChanges={DiscardChanges}",
            id.Value, discardChanges);

        return session;
    }

    private async Task<Project?> FindProjectByIdAsync(string projectId, CancellationToken ct)
    {
        var projects = await _projectRepository.GetAllAsync(ct);
        return projects.FirstOrDefault(p => p.Id.ToString() == projectId);
    }

    private async Task<WorkflowDefinition?> LoadWorkflowAsync(string workflowId, CancellationToken ct)
    {
        // Try to load workflow from block repository
        var allBlocks = await _blockRepository.GetAllAsync(ct);
        var workflowBlock = allBlocks.FirstOrDefault(b =>
            b.BlockType.Equals("workflow", StringComparison.OrdinalIgnoreCase) &&
            (b.Id == workflowId || b.Name.Equals(workflowId, StringComparison.OrdinalIgnoreCase)));

        if (workflowBlock == null)
        {
            return null;
        }

        // Extract child blocks (nodes) from workflow config
        var blocks = new List<BlockDefinition> { workflowBlock };
        var connections = new List<ConnectionDefinition>();

        if (workflowBlock.Config.TryGetValue("nodes", out var nodesObj) && nodesObj != null)
        {
            // Nodes are stored as JSON - parse them to get block IDs
            var nodeIds = ExtractNodeIds(nodesObj);
            var childBlocks = allBlocks.Where(b => nodeIds.Contains(b.Id)).ToList();
            blocks.AddRange(childBlocks);
        }

        if (workflowBlock.Config.TryGetValue("connections", out var connObj) && connObj != null)
        {
            connections = ParseConnections(connObj);
        }

        return new WorkflowDefinition(
            workflowBlock.Id,
            blocks,
            connections
        );
    }

    private static List<string> ExtractNodeIds(object nodesObj)
    {
        var ids = new List<string>();

        if (nodesObj is System.Text.Json.JsonElement jsonElement)
        {
            if (jsonElement.ValueKind == System.Text.Json.JsonValueKind.Array)
            {
                foreach (var node in jsonElement.EnumerateArray())
                {
                    if (node.TryGetProperty("id", out var idProp))
                    {
                        var id = idProp.GetString();
                        if (!string.IsNullOrEmpty(id))
                        {
                            ids.Add(id);
                        }
                    }
                }
            }
        }
        else if (nodesObj is IEnumerable<object> enumerable)
        {
            foreach (var item in enumerable)
            {
                if (item is IDictionary<string, object> dict && dict.TryGetValue("id", out var idVal))
                {
                    var id = idVal?.ToString();
                    if (!string.IsNullOrEmpty(id))
                    {
                        ids.Add(id);
                    }
                }
            }
        }

        return ids;
    }

    private static List<ConnectionDefinition> ParseConnections(object connectionsObj)
    {
        var connections = new List<ConnectionDefinition>();

        if (connectionsObj is System.Text.Json.JsonElement jsonElement)
        {
            if (jsonElement.ValueKind == System.Text.Json.JsonValueKind.Array)
            {
                foreach (var conn in jsonElement.EnumerateArray())
                {
                    var fromBlockId = conn.TryGetProperty("fromBlockId", out var f) ? f.GetString() : null;
                    var toBlockId = conn.TryGetProperty("toBlockId", out var t) ? t.GetString() : null;

                    if (!string.IsNullOrEmpty(fromBlockId) && !string.IsNullOrEmpty(toBlockId))
                    {
                        connections.Add(new ConnectionDefinition
                        {
                            FromBlockId = fromBlockId,
                            ToBlockId = toBlockId,
                            FromPort = conn.TryGetProperty("fromPort", out var fp) ? fp.GetString() ?? "default" : "default",
                            ToPort = conn.TryGetProperty("toPort", out var tp) ? tp.GetString() ?? "default" : "default"
                        });
                    }
                }
            }
        }

        return connections;
    }

    private async Task<SessionDiff> GenerateGitDiffAsync(string projectPath, CancellationToken ct)
    {
        var diff = new SessionDiff
        {
            Files = new List<FileDiff>()
        };

        // Get status of changes
        var statusResult = await ExecuteCommandAsync(projectPath, "git status --porcelain", ct);
        if (statusResult.ExitCode != 0)
        {
            return diff;
        }

        var lines = statusResult.StandardOutput.Split('\n', StringSplitOptions.RemoveEmptyEntries);
        var totalLinesAdded = 0;
        var totalLinesRemoved = 0;

        foreach (var line in lines)
        {
            if (line.Length < 3) continue;

            var status = line[0..2].Trim();
            var filePath = line[3..].Trim();

            var changeType = status switch
            {
                "A" or "??" => FileChangeType.Created,
                "D" => FileChangeType.Deleted,
                _ => FileChangeType.Modified
            };

            // Get diff for this file
            var fileDiffResult = await ExecuteCommandAsync(projectPath, $"git diff HEAD -- \"{filePath}\"", ct);
            var fileDiffContent = fileDiffResult.StandardOutput;

            // If file is untracked, show its content
            if (status == "??")
            {
                fileDiffResult = await ExecuteCommandAsync(projectPath, $"git diff --no-index /dev/null \"{filePath}\"", ct);
                fileDiffContent = fileDiffResult.StandardOutput;
            }

            // Count lines added/removed
            var linesAdded = 0;
            var linesRemoved = 0;
            foreach (var diffLine in fileDiffContent.Split('\n'))
            {
                if (diffLine.StartsWith("+") && !diffLine.StartsWith("+++"))
                    linesAdded++;
                else if (diffLine.StartsWith("-") && !diffLine.StartsWith("---"))
                    linesRemoved++;
            }

            diff.Files.Add(new FileDiff
            {
                Path = filePath,
                ChangeType = changeType,
                Diff = fileDiffContent,
                LinesAdded = linesAdded,
                LinesRemoved = linesRemoved
            });

            totalLinesAdded += linesAdded;
            totalLinesRemoved += linesRemoved;
        }

        // Set totals using reflection since they're init-only
        var type = typeof(SessionDiff);
        var bindingFlags = System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Public;

        var linesAddedField = type.GetField("<LinesAdded>k__BackingField", bindingFlags);
        linesAddedField?.SetValue(diff, totalLinesAdded);

        var linesRemovedField = type.GetField("<LinesRemoved>k__BackingField", bindingFlags);
        linesRemovedField?.SetValue(diff, totalLinesRemoved);

        return diff;
    }

    private async Task<string> GetCurrentBranchAsync(string projectPath, CancellationToken ct)
    {
        var result = await ExecuteCommandAsync(projectPath, "git rev-parse --abbrev-ref HEAD", ct);
        return result.StandardOutput.Trim();
    }

    private static string? DetectTestCommand(string projectPath)
    {
        // Check for common project files to detect test framework
        if (File.Exists(Path.Combine(projectPath, "package.json")))
        {
            return "npm test";
        }
        if (File.Exists(Path.Combine(projectPath, "pytest.ini")) ||
            File.Exists(Path.Combine(projectPath, "pyproject.toml")))
        {
            return "pytest";
        }
        if (Directory.GetFiles(projectPath, "*.csproj").Length > 0 ||
            Directory.GetFiles(projectPath, "*.sln").Length > 0)
        {
            return "dotnet test";
        }
        if (File.Exists(Path.Combine(projectPath, "pom.xml")))
        {
            return "mvn test";
        }
        if (File.Exists(Path.Combine(projectPath, "build.gradle")))
        {
            return "gradle test";
        }

        return null;
    }

    private static TestResult ParseTestResult(CommandResult result, long durationMs)
    {
        var output = result.StandardOutput + "\n" + result.StandardError;

        // Try to parse test counts from output
        var totalTests = 0;
        var passedTests = 0;
        var failedTests = 0;

        // Common patterns for test output
        // dotnet: "Passed: 5, Failed: 1, Skipped: 0, Total: 6"
        // pytest: "5 passed, 1 failed"
        // npm test/jest: "Tests: 1 failed, 5 passed, 6 total"

        var patterns = new[]
        {
            @"Total:\s*(\d+)",
            @"(\d+)\s+total",
            @"(\d+)\s+tests?"
        };

        foreach (var pattern in patterns)
        {
            var match = System.Text.RegularExpressions.Regex.Match(output, pattern, System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            if (match.Success && int.TryParse(match.Groups[1].Value, out var total))
            {
                totalTests = total;
                break;
            }
        }

        var passedPatterns = new[]
        {
            @"Passed:\s*(\d+)",
            @"(\d+)\s+passed"
        };

        foreach (var pattern in passedPatterns)
        {
            var match = System.Text.RegularExpressions.Regex.Match(output, pattern, System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            if (match.Success && int.TryParse(match.Groups[1].Value, out var passed))
            {
                passedTests = passed;
                break;
            }
        }

        var failedPatterns = new[]
        {
            @"Failed:\s*(\d+)",
            @"(\d+)\s+failed"
        };

        foreach (var pattern in failedPatterns)
        {
            var match = System.Text.RegularExpressions.Regex.Match(output, pattern, System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            if (match.Success && int.TryParse(match.Groups[1].Value, out var failed))
            {
                failedTests = failed;
                break;
            }
        }

        // If we couldn't parse, at least use exit code
        if (totalTests == 0 && result.ExitCode == 0)
        {
            totalTests = 1;
            passedTests = 1;
        }

        return new TestResult
        {
            Passed = result.ExitCode == 0 && failedTests == 0,
            TotalTests = totalTests > 0 ? totalTests : passedTests + failedTests,
            PassedTests = passedTests,
            FailedTests = failedTests,
            Output = output,
            DurationMs = durationMs
        };
    }

    private async Task<CommandResult> ExecuteCommandAsync(string workingDirectory, string command, CancellationToken ct)
    {
        var isWindows = OperatingSystem.IsWindows();
        var shell = isWindows ? "cmd.exe" : "/bin/bash";
        var shellArgs = isWindows ? $"/c {command}" : $"-c \"{command}\"";

        using var process = new Process
        {
            StartInfo = new ProcessStartInfo
            {
                FileName = shell,
                Arguments = shellArgs,
                WorkingDirectory = workingDirectory,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            }
        };

        var stdout = new StringBuilder();
        var stderr = new StringBuilder();

        process.OutputDataReceived += (_, e) =>
        {
            if (e.Data != null) stdout.AppendLine(e.Data);
        };
        process.ErrorDataReceived += (_, e) =>
        {
            if (e.Data != null) stderr.AppendLine(e.Data);
        };

        process.Start();
        process.BeginOutputReadLine();
        process.BeginErrorReadLine();

        try
        {
            await process.WaitForExitAsync(ct);
        }
        catch (OperationCanceledException)
        {
            process.Kill(true);
            throw;
        }

        return new CommandResult
        {
            ExitCode = process.ExitCode,
            StandardOutput = stdout.ToString(),
            StandardError = stderr.ToString()
        };
    }

    private record CommandResult
    {
        public int ExitCode { get; init; }
        public string StandardOutput { get; init; } = string.Empty;
        public string StandardError { get; init; } = string.Empty;
    }
}
