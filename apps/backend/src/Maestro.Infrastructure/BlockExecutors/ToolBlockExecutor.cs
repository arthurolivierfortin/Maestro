using System.Diagnostics;
using Maestro.Application.DTOs;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using ExecutionContext = Maestro.Domain.Entities.ExecutionContext;
using Maestro.Domain.ValueObjects;

namespace Maestro.Infrastructure.BlockExecutors;

/// <summary>
/// Executes tool/script blocks in a sandboxed subprocess.
/// This is a scaffold implementation that provides timeouts and
/// working-directory isolation. Network restrictions are noted but
/// not enforced by this scaffold.
/// </summary>
public class ToolBlockExecutor : IBlockExecutor
{
    private readonly IServiceProvider? _serviceProvider;

    public string SupportedType => "tool";

    public ToolBlockExecutor() { }

    public ToolBlockExecutor(IServiceProvider serviceProvider)
    {
        _serviceProvider = serviceProvider;
    }

    public async Task<BlockExecutionResult> ExecuteAsync(
        BlockDefinition block,
        ExecutionContext context,
        Dictionary<string, object> inputs,
        CancellationToken ct = default)
    {
        var sw = Stopwatch.StartNew();

        // Basic config options
        var config = block.Config ?? new Dictionary<string, object?>();

        // Handle CLI bridge executor type
        var executorType = GetConfigString(config, "executorType");
        if (executorType == "cli-bridge")
        {
            return await ExecuteCliBridgeAsync(block, context, inputs, sw, ct);
        }

        // Handle client-side executor type — block is executed by the embedding application
        if (executorType == "client-side")
        {
            var clientOutputs = new Dictionary<string, object?>
            {
                ["_clientSideExecution"] = true,
                ["_blockId"] = block.Id,
                ["_config"] = System.Text.Json.JsonSerializer.Serialize(config)
            };
            sw.Stop();
            return new BlockExecutionResult
            {
                Outputs = clientOutputs.ToDictionary(kv => kv.Key, kv => kv.Value),
                Success = true,
                Logs = new List<string> { $"Client-side block '{block.Id}' — execution delegated to embedding application" },
                DurationMs = sw.ElapsedMilliseconds
            };
        }

        // Support both "script" format and "command"+"args" format
        var script = GetConfigString(config, "script");

        // Check for command + args format (more structured approach)
        var command = GetConfigString(config, "command");

        List<string>? args = null;
        if (config.TryGetValue("args", out var argsObj))
        {
            args = GetConfigStringArray(argsObj);
        }

        // Optional script file name relative to workingDir
        var scriptFile = GetConfigString(config, "scriptFile");

        // Timeout: check both timeoutMs and timeout config keys
        var timeoutMs = GetConfigInt(config, "timeoutMs", 0);
        if (timeoutMs == 0)
        {
            timeoutMs = GetConfigInt(config, "timeout", 30000);
        }

        // Working directory: try block's source directory from metadata, else current directory
        string? workingDir = null;
        string? blockSourceDir = null;
        if (block.Metadata != null)
        {
            if (block.Metadata.TryGetValue("_sourcePath", out var srcPathObj) && srcPathObj is string srcPath)
                blockSourceDir = Path.GetDirectoryName(srcPath);
            else if (block.Metadata.TryGetValue("path", out var pathObj) && pathObj is string pathStr)
                blockSourceDir = pathStr;
        }
        workingDir = blockSourceDir ?? Directory.GetCurrentDirectory();

        // Override working directory from inputs if provided (applies to all execution paths)
        if (inputs != null && inputs.TryGetValue("workingDir", out var wdInputGlobal) && wdInputGlobal is string wdInputGlobalStr && !string.IsNullOrEmpty(wdInputGlobalStr))
            workingDir = wdInputGlobalStr;

        // Config-specified working directory override
        var configWorkingDir = GetConfigString(config, "workingDir");
        if (!string.IsNullOrEmpty(configWorkingDir))
            workingDir = configWorkingDir;

        // Prepare outputs and logs before sandboxing
        var resultOutputs = new Dictionary<string, object?>();
        var logs = new List<string>();

        // Determine runtime: default to pwsh on Windows, bash on Unix
        var runtimeConfig = GetConfigString(config, "runtime");
        var runtime = !string.IsNullOrEmpty(runtimeConfig) ? runtimeConfig : (OperatingSystem.IsWindows() ? "powershell" : "bash");

        // If a scriptFile is provided, try to resolve it relative to the block's source directory
        if (!string.IsNullOrEmpty(scriptFile) && !string.IsNullOrEmpty(blockSourceDir))
        {
            // Validate scriptFile: reject path traversal and absolute paths
            if (scriptFile.Contains("..") || Path.IsPathRooted(scriptFile))
            {
                logs.Add($"Rejected script file path (path traversal or absolute): {scriptFile}");
                return new BlockExecutionResult
                {
                    Outputs = new Dictionary<string, object> { ["error"] = "Invalid script file path: must be relative without path traversal" },
                    Success = false,
                    DurationMs = sw.ElapsedMilliseconds
                };
            }
            var candidate = Path.Combine(blockSourceDir, scriptFile);
            var candidateFull = Path.GetFullPath(candidate);
            var baseFull = Path.GetFullPath(blockSourceDir);
            if (!candidateFull.StartsWith(baseFull + Path.DirectorySeparatorChar) && candidateFull != baseFull)
            {
                logs.Add($"Rejected script file path (outside block directory): {scriptFile}");
                return new BlockExecutionResult
                {
                    Outputs = new Dictionary<string, object> { ["error"] = "Script file path escapes block directory" },
                    Success = false,
                    DurationMs = sw.ElapsedMilliseconds
                };
            }
            if (File.Exists(candidate)) script = candidate;
        }

        // Optional sandboxing: create a temporary working directory when enabled
        var enableSandbox = config.TryGetValue("enableSandbox", out var sb) && sb is bool b && b;
        string? sandboxDir = null;
        if (enableSandbox)
        {
            sandboxDir = Path.Combine(Path.GetTempPath(), "maestro_tool_sandbox", Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(sandboxDir);
            // copy script file into sandbox if requested
            if (!string.IsNullOrEmpty(scriptFile))
            {
                var src = Path.Combine(workingDir ?? Directory.GetCurrentDirectory(), scriptFile);
                if (File.Exists(src))
                {
                    var dest = Path.Combine(sandboxDir, Path.GetFileName(scriptFile));
                    File.Copy(src, dest, true);
                    // If running under PowerShell and the script is a shell script (.sh), convert
                    // it to a simple PowerShell script to improve cross-platform test behavior.
                    if ((runtime == "powershell" || runtime == "pwsh") && src.EndsWith(".sh", StringComparison.OrdinalIgnoreCase))
                    {
                        try
                        {
                            var text = System.IO.File.ReadAllText(src);
                            // naive conversion: replace 'echo' with 'Write-Output'
                            var converted = text.Replace("echo ", "Write-Output ");
                            var psPath = Path.ChangeExtension(dest, ".ps1");
                            System.IO.File.WriteAllText(psPath, converted);
                            script = psPath;
                        }
                        catch
                        {
                            script = dest;
                        }
                    }
                    else
                    {
                        // execute the copied file by path (works for shell and powershell invocation)
                        script = dest;
                    }
                }
            }
            workingDir = sandboxDir;
            logs.Add($"Sandbox enabled: {sandboxDir}");
        }

        // Best-effort network disable flag (not a secure sandbox). When set, we try to pass
        // environment variables to common runtimes to limit outbound network access. This is
        // not a substitute for proper OS/container sandboxing and should be used for tests only.
        var disableNetwork = config.TryGetValue("disableNetwork", out var dn) && dn is bool dnb && dnb;
        if (disableNetwork)
        {
            logs.Add("Network access disabled (best-effort). This is not a secure sandbox.");
        }

        // Basic inputs validation: config may include inputs.required array
        if (config.TryGetValue("inputs", out var inputsObj) && inputsObj is System.Collections.IDictionary inputsDict && inputsDict.Contains("required"))
        {
            try
            {
                var required = (inputsDict["required"] as System.Text.Json.JsonElement?).GetValueOrDefault();
                if (required.ValueKind == System.Text.Json.JsonValueKind.Array)
                {
                    foreach (var el in required.EnumerateArray())
                    {
                        var name = el.GetString();
                        if (!string.IsNullOrEmpty(name) && (inputs == null || !inputs.ContainsKey(name)))
                        {
                            logs.Add($"Missing required input: {name}");
                            return new BlockExecutionResult { Outputs = resultOutputs.ToDictionary(kv => kv.Key, kv => kv.Value), Logs = logs, Success = false, DurationMs = sw.ElapsedMilliseconds };
                        }
                    }
                }
            }
            catch { }
        }

        try
        {
            // Handle filesystem operations
            var toolType = GetConfigString(config, "toolType");
            if (toolType == "filesystem")
            {
                var operation = GetConfigString(config, "operation");
                return await HandleFilesystemOperationAsync(block, inputs, operation, workingDir, logs, sw, ct);
            }

            // Handle shell tool type - get command from inputs
            if (toolType == "shell")
            {
                var shellCmd = inputs.TryGetValue("command", out var cmdObj) ? cmdObj?.ToString() : null;
                if (!string.IsNullOrEmpty(shellCmd))
                {
                    // Override working directory from inputs if provided
                    if (inputs.TryGetValue("workingDir", out var wdInput) && wdInput is string wdStr && !string.IsNullOrEmpty(wdStr))
                    {
                        workingDir = wdStr;
                    }

                    // Get timeout from inputs
                    var shellTimeout = timeoutMs;
                    if (inputs.TryGetValue("timeout", out var toInput))
                    {
                        if (toInput is int toInt) shellTimeout = toInt;
                        else if (toInput is long toLong) shellTimeout = (int)toLong;
                        else if (int.TryParse(toInput?.ToString(), out var toParsed)) shellTimeout = toParsed;
                    }

                    logs.Add($"Executing shell command: {shellCmd}");
                    logs.Add($"Working directory: {workingDir}");

                    // Sanitize shell command: escape quotes to prevent injection
                    string sanitizedArgs;
                    if (OperatingSystem.IsWindows())
                    {
                        // On Windows cmd.exe: wrap in quotes, escape inner quotes
                        sanitizedArgs = $"/c \"{shellCmd.Replace("\"", "\\\"")}\"";
                    }
                    else
                    {
                        // On Unix bash: use single quotes (strongest quoting), escape embedded single quotes
                        sanitizedArgs = $"-c '{shellCmd.Replace("'", "'\\''")}'";
                    }

                    var shellPsi = new ProcessStartInfo
                    {
                        FileName = OperatingSystem.IsWindows() ? "cmd.exe" : "/bin/bash",
                        Arguments = sanitizedArgs,
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        WorkingDirectory = workingDir,
                        CreateNoWindow = true,
                        UseShellExecute = false,
                    };

                    using var shellProc = new Process { StartInfo = shellPsi };
                    shellProc.Start();

                    config.TryGetValue("maxOutputBytes", out var maxOutObjShell);
                    var maxOutputBytesShell = maxOutObjShell is int mbShell ? mbShell : 200 * 1024;

                    var outputTaskShell = ReadStreamWithLimitAsync(shellProc.StandardOutput, maxOutputBytesShell, ct);
                    var errorTaskShell = ReadStreamWithLimitAsync(shellProc.StandardError, maxOutputBytesShell, ct);

                    var completedShell = await Task.WhenAny(Task.Run(() => shellProc.WaitForExit()), Task.Delay(shellTimeout, ct));
                    if (completedShell is Task delayTaskShell && delayTaskShell.IsCompleted && !shellProc.HasExited)
                    {
                        try { shellProc.Kill(true); } catch { }
                        logs.Add($"Shell process killed after timeout {shellTimeout}ms");
                    }

                    var stdoutShell = await outputTaskShell;
                    var stderrShell = await errorTaskShell;
                    var exitCodeShell = shellProc.ExitCode;

                    resultOutputs["stdout"] = stdoutShell?.Trim() ?? string.Empty;
                    resultOutputs["stderr"] = stderrShell?.Trim() ?? string.Empty;
                    resultOutputs["exitCode"] = exitCodeShell;
                    resultOutputs["success"] = exitCodeShell == 0;

                    sw.Stop();
                    return new BlockExecutionResult
                    {
                        Outputs = resultOutputs.ToDictionary(kv => kv.Key, kv => kv.Value),
                        Logs = logs,
                        Success = exitCodeShell == 0,
                        DurationMs = sw.ElapsedMilliseconds
                    };
                }
            }

            // Handle command + args format (direct execution without shell wrapper)
            if (!string.IsNullOrEmpty(command))
            {
                // Build command with args - execute directly
                // Support template substitution in args: {{inputName}} -> input value
                var processedArgs = args?.Select(arg => SubstituteTemplates(arg, inputs)).ToList();
                var cmdArgs = processedArgs != null ? string.Join(" ", processedArgs) : string.Empty;

                // Check for workingDir input override
                if (inputs.TryGetValue("workingDir", out var wdInput) && wdInput is string wdStr && !string.IsNullOrEmpty(wdStr))
                {
                    workingDir = wdStr;
                }

                var cmdPsi = new ProcessStartInfo
                {
                    FileName = command,
                    Arguments = cmdArgs,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    WorkingDirectory = workingDir,
                    CreateNoWindow = true,
                    UseShellExecute = false,
                };

                logs.Add($"Executing: {command} {cmdArgs}");
                logs.Add($"Working directory: {workingDir}");

                using var cmdProc = new Process { StartInfo = cmdPsi };
                cmdProc.Start();

                config.TryGetValue("maxOutputBytes", out var maxOutObj2);
                var maxOutputBytes2 = maxOutObj2 is int mb2 ? mb2 : 200 * 1024;

                var outputTask2 = ReadStreamWithLimitAsync(cmdProc.StandardOutput, maxOutputBytes2, ct);
                var errorTask2 = ReadStreamWithLimitAsync(cmdProc.StandardError, maxOutputBytes2, ct);

                var completed2 = await Task.WhenAny(Task.Run(() => cmdProc.WaitForExit()), Task.Delay(timeoutMs, ct));
                if (completed2 is Task delayTask2 && delayTask2.IsCompleted && !cmdProc.HasExited)
                {
                    try { cmdProc.Kill(true); } catch { }
                    logs.Add($"Process killed after timeout {timeoutMs}ms");
                }

                var stdout2 = await outputTask2;
                var stderr2 = await errorTask2;
                var exitCode = cmdProc.ExitCode;

                // Map outputs based on block definition
                // For git-diff: output "diff", for git-status: output "status", etc.
                var outputId = block.Id switch
                {
                    "git-diff" => "diff",
                    "git-status" => "status",
                    "git-log" => "log",
                    _ => "stdout"
                };

                resultOutputs[outputId] = stdout2?.Trim() ?? string.Empty;
                resultOutputs["exitCode"] = exitCode;
                if (!string.IsNullOrWhiteSpace(stderr2))
                {
                    resultOutputs["stderr"] = stderr2.Trim();
                    logs.Add($"stderr: {stderr2.Trim()}");
                }

                sw.Stop();
                return new BlockExecutionResult
                {
                    Outputs = resultOutputs.ToDictionary(kv => kv.Key, kv => kv.Value),
                    Logs = logs,
                    Success = exitCode == 0,
                    DurationMs = sw.ElapsedMilliseconds
                };
            }

            // If script points to a file path, adjust ProcessStartInfo accordingly
            var scriptIsFile = !string.IsNullOrEmpty(script) && File.Exists(script);

            // If script is a file but not a native PowerShell script, for PowerShell runtimes
            // read the file and execute its contents as a command. This helps running .sh files
            // on Windows where the runtime may be 'powershell'.
            if (scriptIsFile && (runtime == "powershell" || runtime == "pwsh") && !script.EndsWith(".ps1", StringComparison.OrdinalIgnoreCase))
            {
                try
                {
                    script = await System.IO.File.ReadAllTextAsync(script, ct);
                    scriptIsFile = false; // treat as command string now
                }
                catch { /* ignore and fall back to attempting file exec */ }
            }

            string arguments;
            if (scriptIsFile)
            {
                // Execute file with appropriate runtime wrapper
                arguments = runtime switch
                {
                    "node" => script,
                    "python" => script,
                    "powershell" => $"-NoProfile -NonInteractive -File \"{script}\"",
                    "pwsh" => $"-NoProfile -NonInteractive -File \"{script}\"",
                    "bash" => $"-lc \"bash '{script}'\"",
                    _ => $"-NoProfile -NonInteractive -Command \"{script}\"",
                };
            }
            else
            {
                arguments = runtime switch
                {
                    "node" => script,
                    "python" => script,
                    "powershell" => $"-NoProfile -NonInteractive -Command \"{script}\"",
                    "pwsh" => $"-NoProfile -NonInteractive -Command \"{script}\"",
                    "bash" => $"-lc \"{script}\"",
                    _ => $"-NoProfile -NonInteractive -Command \"{script}\"",
                };
            }

            // Map common runtime names to executables
            var fileName = runtime;
            if (runtime == "node") fileName = "node";
            else if (runtime == "python") fileName = "python";
            else if (runtime == "pwsh") fileName = "pwsh";
            else if (runtime == "powershell") fileName = OperatingSystem.IsWindows() ? "powershell" : "pwsh";
            else if (runtime == "bash") fileName = "bash";

            var psi = new ProcessStartInfo
            {
                FileName = fileName,
                Arguments = arguments,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                WorkingDirectory = workingDir,
                CreateNoWindow = true,
                UseShellExecute = false,
            };

            // Pass block inputs as environment variables for script access
            if (inputs != null)
            {
                foreach (var kvp in inputs)
                {
                    var envKey = $"MAESTRO_INPUT_{kvp.Key.ToUpperInvariant().Replace('-', '_')}";
                    psi.Environment[envKey] = kvp.Value?.ToString() ?? "";
                }
            }

            // Pass the block source directory so scripts can reference sibling files
            if (!string.IsNullOrEmpty(blockSourceDir))
            {
                psi.Environment["MAESTRO_BLOCK_DIR"] = blockSourceDir;
            }

            // Best-effort environment tweaks to disable network in common runtimes
            if (disableNetwork)
            {
                // Example: set HTTP_PROXY/HTTPS_PROXY to invalid value to discourage network calls
                psi.Environment["HTTP_PROXY"] = "127.0.0.1:0";
                psi.Environment["HTTPS_PROXY"] = "127.0.0.1:0";
                // Node: set environment to disable certain modules via NODE_OPTIONS (best-effort)
                if (fileName == "node") psi.Environment["NODE_OPTIONS"] = "--no-experimental-fetch";
                // Python: set env var to discourage pip or requests; not guaranteed
                if (fileName == "python") psi.Environment["PYTHONWARNINGS"] = "ignore";
            }

            using var proc = new Process { StartInfo = psi };
            proc.Start();

            // Limit captured output size (bytes) to avoid OOM from noisy tools
            config.TryGetValue("maxOutputBytes", out var maxOutObj);
            var maxOutputBytes = maxOutObj is int mb ? mb : 200 * 1024; // default 200KB

            var outputTask = ReadStreamWithLimitAsync(proc.StandardOutput, maxOutputBytes, ct);
            var errorTask = ReadStreamWithLimitAsync(proc.StandardError, maxOutputBytes, ct);

            var completed = await Task.WhenAny(Task.Run(() => proc.WaitForExit()), Task.Delay(timeoutMs, ct));
            if (completed is Task delayTask && delayTask.IsCompleted && !proc.HasExited)
            {
                try { proc.Kill(true); } catch { }
                logs.Add($"Process killed after timeout {timeoutMs}ms");
            }

            var stdout = await outputTask;
            var stderr = await errorTask;

            if (!string.IsNullOrWhiteSpace(stdout)) logs.Add(stdout.Trim());
            if (!string.IsNullOrWhiteSpace(stderr)) logs.Add(stderr.Trim());

            // Optionally parse stdout as JSON into outputs
            var parseOut = GetConfigString(config, "parseOutput") ?? string.Empty;
            if (parseOut.Equals("json", StringComparison.OrdinalIgnoreCase))
            {
                var parsed = false;
                var trimmed = (stdout ?? string.Empty).Trim();
                try
                {
                    var doc = System.Text.Json.JsonDocument.Parse(trimmed);
                    if (doc.RootElement.ValueKind == System.Text.Json.JsonValueKind.Object)
                    {
                        foreach (var p in doc.RootElement.EnumerateObject())
                        {
                            resultOutputs[p.Name] = JsonElementToObject(p.Value);
                        }
                        parsed = true;
                    }
                }
                catch
                {
                    // try to extract JSON substring heuristically
                    try
                    {
                        var start = trimmed.IndexOf('{');
                        var end = trimmed.LastIndexOf('}');
                        if (start >= 0 && end > start)
                        {
                            var sub = trimmed.Substring(start, end - start + 1);
                            var doc2 = System.Text.Json.JsonDocument.Parse(sub);
                            if (doc2.RootElement.ValueKind == System.Text.Json.JsonValueKind.Object)
                            {
                                foreach (var p in doc2.RootElement.EnumerateObject())
                                {
                                    resultOutputs[p.Name] = JsonElementToObject(p.Value);
                                }
                                parsed = true;
                            }
                        }
                    }
                    catch
                    {
                        // ignored
                    }
                }

                if (!parsed)
                {
                    resultOutputs["stdout"] = stdout;
                    logs.Add("Failed to parse stdout as JSON");
                }
            }
            else
            {
                resultOutputs["stdout"] = stdout;
                // Only include stderr if non-empty — avoids multi-output format
                // that prepends "stdout: " prefix, breaking downstream JSON parsing
                if (!string.IsNullOrWhiteSpace(stderr))
                    resultOutputs["stderr"] = stderr;
            }

            sw.Stop();

            return new BlockExecutionResult
            {
                Outputs = resultOutputs.ToDictionary(kv => kv.Key, kv => kv.Value),
                Logs = logs,
                Success = true,
                DurationMs = sw.ElapsedMilliseconds
            };
        }
        catch (Exception ex)
        {
            sw.Stop();
            logs.Add(ex.Message);
            return new BlockExecutionResult
            {
                Outputs = resultOutputs.ToDictionary(kv => kv.Key, kv => kv.Value),
                Logs = logs,
                Success = false,
                DurationMs = sw.ElapsedMilliseconds
            };
        }
        finally
        {
            // Clean up sandbox directory if created
            if (!string.IsNullOrEmpty(sandboxDir))
            {
                try { Directory.Delete(sandboxDir, true); } catch { }
            }
        }
    }

    private static async Task<string> ReadStreamWithLimitAsync(System.IO.TextReader reader, int maxBytes, CancellationToken ct)
    {
        const int bufferSize = 4096;
        var sb = new System.Text.StringBuilder();
        var total = 0;
        var buffer = new char[bufferSize];

        while (!ct.IsCancellationRequested)
        {
            var read = await reader.ReadAsync(buffer, 0, bufferSize);
            if (read <= 0) break;
            total += read;
            if (total > maxBytes)
            {
                // append only the allowed portion
                var allowed = read - (total - maxBytes);
                if (allowed > 0)
                    sb.Append(buffer, 0, allowed);
                sb.Append("\n--output-truncated--\n");
                break;
            }
            sb.Append(buffer, 0, read);
        }

        return sb.ToString();
    }

    private static object? JsonElementToObject(System.Text.Json.JsonElement el)
    {
        switch (el.ValueKind)
        {
            case System.Text.Json.JsonValueKind.String:
                return el.GetString();
            case System.Text.Json.JsonValueKind.Number:
                return el.TryGetInt64(out var l) ? (object)l : el.GetDouble();
            case System.Text.Json.JsonValueKind.True:
                return true;
            case System.Text.Json.JsonValueKind.False:
                return false;
            case System.Text.Json.JsonValueKind.Object:
                var dict = new Dictionary<string, object?>();
                foreach (var prop in el.EnumerateObject())
                    dict[prop.Name] = JsonElementToObject(prop.Value);
                return dict;
            case System.Text.Json.JsonValueKind.Array:
                var list = new List<object?>();
                foreach (var item in el.EnumerateArray())
                    list.Add(JsonElementToObject(item));
                return list;
            default:
                return null;
        }
    }

    /// <summary>
    /// Handles filesystem operations (read, write, etc.)
    /// </summary>
    private async Task<BlockExecutionResult> HandleFilesystemOperationAsync(
        BlockDefinition block,
        Dictionary<string, object> inputs,
        string operation,
        string? workingDir,
        List<string> logs,
        Stopwatch sw,
        CancellationToken ct)
    {
        var resultOutputs = new Dictionary<string, object?>();

        try
        {
            // Get file path from inputs
            var filePath = inputs.TryGetValue("path", out var pathObj) ? pathObj?.ToString() : null;
            if (string.IsNullOrEmpty(filePath))
            {
                logs.Add("Missing required input: path");
                return new BlockExecutionResult
                {
                    Outputs = resultOutputs.ToDictionary(kv => kv.Key, kv => kv.Value),
                    Logs = logs,
                    Success = false,
                    DurationMs = sw.ElapsedMilliseconds
                };
            }

            // Override working directory from inputs if provided (check this FIRST)
            if (inputs.TryGetValue("workingDir", out var wdObj) && wdObj is string wdStr && !string.IsNullOrEmpty(wdStr))
            {
                workingDir = wdStr;
            }

            // Resolve path relative to working directory if not absolute
            if (!Path.IsPathRooted(filePath) && !string.IsNullOrEmpty(workingDir))
            {
                filePath = Path.Combine(workingDir, filePath);
            }

            filePath = Path.GetFullPath(filePath);

            // Validate that resolved path stays within working directory (prevent path traversal)
            if (!string.IsNullOrEmpty(workingDir))
            {
                var baseDir = Path.GetFullPath(workingDir);
                if (!filePath.StartsWith(baseDir + Path.DirectorySeparatorChar) && filePath != baseDir)
                {
                    logs.Add($"Rejected file path (path traversal outside working directory): {filePath}");
                    return new BlockExecutionResult
                    {
                        Outputs = new Dictionary<string, object> { ["error"] = "File path escapes working directory" },
                        Success = false,
                        DurationMs = sw.ElapsedMilliseconds
                    };
                }
            }

            switch (operation.ToLowerInvariant())
            {
                case "read":
                    return await HandleFileReadAsync(filePath, inputs, logs, sw, ct);

                case "write":
                    return await HandleFileWriteAsync(filePath, inputs, logs, sw, ct);

                case "edit":
                    return await HandleFileEditAsync(filePath, inputs, logs, sw, ct);

                case "list":
                    return HandleDirectoryList(filePath, logs, sw);

                default:
                    logs.Add($"Unknown filesystem operation: {operation}");
                    return new BlockExecutionResult
                    {
                        Outputs = resultOutputs.ToDictionary(kv => kv.Key, kv => kv.Value),
                        Logs = logs,
                        Success = false,
                        DurationMs = sw.ElapsedMilliseconds
                    };
            }
        }
        catch (Exception ex)
        {
            logs.Add($"Filesystem error: {ex.Message}");
            return new BlockExecutionResult
            {
                Outputs = resultOutputs.ToDictionary(kv => kv.Key, kv => kv.Value),
                Logs = logs,
                Success = false,
                DurationMs = sw.ElapsedMilliseconds
            };
        }
    }

    private async Task<BlockExecutionResult> HandleFileReadAsync(
        string filePath,
        Dictionary<string, object> inputs,
        List<string> logs,
        Stopwatch sw,
        CancellationToken ct)
    {
        var resultOutputs = new Dictionary<string, object?>();
        var encoding = inputs.TryGetValue("encoding", out var encObj) ? encObj?.ToString() : "utf-8";

        logs.Add($"Reading file: {filePath}");

        if (!File.Exists(filePath))
        {
            logs.Add($"File not found: {filePath}");
            resultOutputs["content"] = string.Empty;
            resultOutputs["exists"] = false;
            resultOutputs["size"] = 0;

            return new BlockExecutionResult
            {
                Outputs = resultOutputs.ToDictionary(kv => kv.Key, kv => kv.Value),
                Logs = logs,
                Success = false,
                DurationMs = sw.ElapsedMilliseconds
            };
        }

        var fileInfo = new FileInfo(filePath);
        var enc = GetEncodingFromString(encoding);
        var content = await File.ReadAllTextAsync(filePath, enc, ct);

        resultOutputs["content"] = content;
        resultOutputs["exists"] = true;
        resultOutputs["size"] = fileInfo.Length;

        logs.Add($"Read {fileInfo.Length} bytes");

        return new BlockExecutionResult
        {
            Outputs = resultOutputs.ToDictionary(kv => kv.Key, kv => kv.Value),
            Logs = logs,
            Success = true,
            DurationMs = sw.ElapsedMilliseconds
        };
    }

    private async Task<BlockExecutionResult> HandleFileWriteAsync(
        string filePath,
        Dictionary<string, object> inputs,
        List<string> logs,
        Stopwatch sw,
        CancellationToken ct)
    {
        var resultOutputs = new Dictionary<string, object?>();
        var encoding = inputs.TryGetValue("encoding", out var encObj) ? encObj?.ToString() : "utf-8";
        var mode = inputs.TryGetValue("mode", out var modeObj) ? modeObj?.ToString() : "overwrite";
        var createDirs = !inputs.TryGetValue("createDirectories", out var cdObj) || cdObj is not bool cdBool || cdBool;

        // Get content to write (may be string or JsonElement from --input-json)
        string? content = null;
        if (inputs.TryGetValue("content", out var contentObj))
        {
            if (contentObj is string s)
                content = s;
            else if (contentObj is System.Text.Json.JsonElement je && je.ValueKind == System.Text.Json.JsonValueKind.String)
                content = je.GetString();
            else if (contentObj != null)
                content = contentObj.ToString();
        }

        if (content == null)
        {
            logs.Add("Missing required input: content");
            resultOutputs["success"] = false;
            resultOutputs["path"] = filePath;
            resultOutputs["bytesWritten"] = 0;

            return new BlockExecutionResult
            {
                Outputs = resultOutputs.ToDictionary(kv => kv.Key, kv => kv.Value),
                Logs = logs,
                Success = false,
                DurationMs = sw.ElapsedMilliseconds
            };
        }

        logs.Add($"Writing to file: {filePath}");

        // Create directories if needed
        var directory = Path.GetDirectoryName(filePath);
        if (createDirs && !string.IsNullOrEmpty(directory) && !Directory.Exists(directory))
        {
            Directory.CreateDirectory(directory);
            logs.Add($"Created directory: {directory}");
        }

        // Handle write mode
        switch (mode?.ToLowerInvariant())
        {
            case "create":
                if (File.Exists(filePath))
                {
                    logs.Add($"File already exists: {filePath}");
                    resultOutputs["success"] = false;
                    resultOutputs["path"] = filePath;
                    resultOutputs["bytesWritten"] = 0;

                    return new BlockExecutionResult
                    {
                        Outputs = resultOutputs.ToDictionary(kv => kv.Key, kv => kv.Value),
                        Logs = logs,
                        Success = false,
                        DurationMs = sw.ElapsedMilliseconds
                    };
                }
                break;

            case "append":
                var enc = GetEncodingFromString(encoding);
                await File.AppendAllTextAsync(filePath, content, enc, ct);
                var appendedBytes = enc.GetByteCount(content);
                logs.Add($"Appended {appendedBytes} bytes");

                resultOutputs["success"] = true;
                resultOutputs["path"] = filePath;
                resultOutputs["bytesWritten"] = appendedBytes;

                return new BlockExecutionResult
                {
                    Outputs = resultOutputs.ToDictionary(kv => kv.Key, kv => kv.Value),
                    Logs = logs,
                    Success = true,
                    DurationMs = sw.ElapsedMilliseconds
                };
        }

        // Default: overwrite
        var writeEnc = GetEncodingFromString(encoding);
        await File.WriteAllTextAsync(filePath, content, writeEnc, ct);
        var bytesWritten = writeEnc.GetByteCount(content);
        logs.Add($"Wrote {bytesWritten} bytes");

        resultOutputs["success"] = true;
        resultOutputs["path"] = filePath;
        resultOutputs["bytesWritten"] = bytesWritten;

        return new BlockExecutionResult
        {
            Outputs = resultOutputs.ToDictionary(kv => kv.Key, kv => kv.Value),
            Logs = logs,
            Success = true,
            DurationMs = sw.ElapsedMilliseconds
        };
    }

    private async Task<BlockExecutionResult> HandleFileEditAsync(
        string filePath,
        Dictionary<string, object> inputs,
        List<string> logs,
        Stopwatch sw,
        CancellationToken ct)
    {
        var resultOutputs = new Dictionary<string, object?>();

        logs.Add($"Editing file: {filePath}");

        if (!File.Exists(filePath))
        {
            logs.Add($"File not found: {filePath}");
            resultOutputs["success"] = false;
            resultOutputs["path"] = filePath;
            resultOutputs["replacementCount"] = 0;

            return new BlockExecutionResult
            {
                Outputs = resultOutputs.ToDictionary(kv => kv.Key, kv => kv.Value),
                Logs = logs,
                Success = false,
                DurationMs = sw.ElapsedMilliseconds
            };
        }

        // Get old_string and new_string from inputs
        string? oldString = null;
        if (inputs.TryGetValue("old_string", out var osObj))
        {
            if (osObj is string s) oldString = s;
            else if (osObj is System.Text.Json.JsonElement je && je.ValueKind == System.Text.Json.JsonValueKind.String)
                oldString = je.GetString();
            else if (osObj != null) oldString = osObj.ToString();
        }

        string? newString = null;
        if (inputs.TryGetValue("new_string", out var nsObj))
        {
            if (nsObj is string s) newString = s;
            else if (nsObj is System.Text.Json.JsonElement je && je.ValueKind == System.Text.Json.JsonValueKind.String)
                newString = je.GetString();
            else if (nsObj != null) newString = nsObj.ToString();
        }

        if (oldString == null)
        {
            logs.Add("Missing required input: old_string");
            resultOutputs["success"] = false;
            resultOutputs["path"] = filePath;
            resultOutputs["replacementCount"] = 0;
            return new BlockExecutionResult
            {
                Outputs = resultOutputs.ToDictionary(kv => kv.Key, kv => kv.Value),
                Logs = logs,
                Success = false,
                DurationMs = sw.ElapsedMilliseconds
            };
        }

        // new_string can be empty (deletion), but must not be null
        newString ??= string.Empty;

        // Check replace_all flag
        var replaceAll = false;
        if (inputs.TryGetValue("replace_all", out var raObj))
        {
            if (raObj is bool b) replaceAll = b;
            else if (raObj is System.Text.Json.JsonElement je)
            {
                if (je.ValueKind == System.Text.Json.JsonValueKind.True) replaceAll = true;
                else if (je.ValueKind == System.Text.Json.JsonValueKind.String)
                    bool.TryParse(je.GetString(), out replaceAll);
            }
            else if (raObj != null) bool.TryParse(raObj.ToString(), out replaceAll);
        }

        // Read the file
        var content = await File.ReadAllTextAsync(filePath, new System.Text.UTF8Encoding(false), ct);

        // Count occurrences
        var count = 0;
        var idx = 0;
        while ((idx = content.IndexOf(oldString, idx, StringComparison.Ordinal)) >= 0)
        {
            count++;
            idx += oldString.Length;
        }

        if (count == 0)
        {
            logs.Add("old_string not found in file");
            resultOutputs["success"] = false;
            resultOutputs["path"] = filePath;
            resultOutputs["replacementCount"] = 0;
            return new BlockExecutionResult
            {
                Outputs = resultOutputs.ToDictionary(kv => kv.Key, kv => kv.Value),
                Logs = logs,
                Success = false,
                DurationMs = sw.ElapsedMilliseconds
            };
        }

        if (count > 1 && !replaceAll)
        {
            logs.Add($"old_string found {count} times — ambiguous. Set replace_all=true to replace all occurrences.");
            resultOutputs["success"] = false;
            resultOutputs["path"] = filePath;
            resultOutputs["replacementCount"] = 0;
            return new BlockExecutionResult
            {
                Outputs = resultOutputs.ToDictionary(kv => kv.Key, kv => kv.Value),
                Logs = logs,
                Success = false,
                DurationMs = sw.ElapsedMilliseconds
            };
        }

        // Perform replacement
        string newContent;
        int replacementCount;
        if (replaceAll)
        {
            newContent = content.Replace(oldString, newString, StringComparison.Ordinal);
            replacementCount = count;
        }
        else
        {
            // Replace first (and only) occurrence
            var pos = content.IndexOf(oldString, StringComparison.Ordinal);
            newContent = string.Concat(content.AsSpan(0, pos), newString, content.AsSpan(pos + oldString.Length));
            replacementCount = 1;
        }

        // Write back without BOM
        await File.WriteAllTextAsync(filePath, newContent, new System.Text.UTF8Encoding(false), ct);
        logs.Add($"Replaced {replacementCount} occurrence(s)");

        resultOutputs["success"] = true;
        resultOutputs["path"] = filePath;
        resultOutputs["replacementCount"] = replacementCount;

        return new BlockExecutionResult
        {
            Outputs = resultOutputs.ToDictionary(kv => kv.Key, kv => kv.Value),
            Logs = logs,
            Success = true,
            DurationMs = sw.ElapsedMilliseconds
        };
    }

    private BlockExecutionResult HandleDirectoryList(
        string dirPath,
        List<string> logs,
        Stopwatch sw)
    {
        var resultOutputs = new Dictionary<string, object?>();

        if (!Directory.Exists(dirPath))
        {
            logs.Add($"Directory does not exist: {dirPath}");
            resultOutputs["content"] = "";
            resultOutputs["exists"] = false;
            return new BlockExecutionResult
            {
                Outputs = resultOutputs.ToDictionary(kv => kv.Key, kv => kv.Value),
                Logs = logs,
                Success = true,
                DurationMs = sw.ElapsedMilliseconds
            };
        }

        logs.Add($"Listing directory: {dirPath}");
        var entries = new List<string>();
        foreach (var dir in Directory.GetDirectories(dirPath))
            entries.Add(Path.GetFileName(dir) + "/");
        foreach (var file in Directory.GetFiles(dirPath))
            entries.Add(Path.GetFileName(file));

        var listing = string.Join("\n", entries);
        logs.Add($"Found {entries.Count} entries");

        resultOutputs["content"] = listing;
        resultOutputs["exists"] = true;

        return new BlockExecutionResult
        {
            Outputs = resultOutputs.ToDictionary(kv => kv.Key, kv => kv.Value),
            Logs = logs,
            Success = true,
            DurationMs = sw.ElapsedMilliseconds
        };
    }

    private static System.Text.Encoding GetEncodingFromString(string? encoding)
    {
        return encoding?.ToLowerInvariant() switch
        {
            // Use UTF8 WITHOUT BOM — BOM breaks Vite, Node.js JSON parsers, and most modern tools.
            // System.Text.Encoding.UTF8 includes BOM; new UTF8Encoding(false) does not.
            "utf-8" or "utf8" => new System.Text.UTF8Encoding(false),
            "utf-16" or "utf16" or "unicode" => System.Text.Encoding.Unicode,
            "ascii" => System.Text.Encoding.ASCII,
            "utf-32" or "utf32" => System.Text.Encoding.UTF32,
            _ => new System.Text.UTF8Encoding(false)
        };
    }

    /// <summary>
    /// Gets a string value from config, handling JsonElement conversion.
    /// </summary>
    private static string GetConfigString(Dictionary<string, object?> config, string key)
    {
        if (!config.TryGetValue(key, out var value)) return string.Empty;
        if (value == null) return string.Empty;
        if (value is string str) return str;
        if (value is System.Text.Json.JsonElement jsonEl && jsonEl.ValueKind == System.Text.Json.JsonValueKind.String)
            return jsonEl.GetString() ?? string.Empty;
        return value.ToString() ?? string.Empty;
    }

    /// <summary>
    /// Gets a string array from a config value, handling JsonElement conversion.
    /// </summary>
    private static List<string>? GetConfigStringArray(object? value)
    {
        if (value == null) return null;

        if (value is System.Text.Json.JsonElement jsonEl)
        {
            if (jsonEl.ValueKind == System.Text.Json.JsonValueKind.Array)
            {
                return jsonEl.EnumerateArray().Select(x => x.GetString() ?? string.Empty).ToList();
            }
            return null;
        }

        if (value is IEnumerable<object> enumerable)
        {
            return enumerable.Select(x => x?.ToString() ?? string.Empty).ToList();
        }

        if (value is System.Collections.IEnumerable list)
        {
            var result = new List<string>();
            foreach (var item in list)
            {
                result.Add(item?.ToString() ?? string.Empty);
            }
            return result;
        }

        return null;
    }

    /// <summary>
    /// Gets an integer value from config, handling JsonElement conversion.
    /// </summary>
    private static int GetConfigInt(Dictionary<string, object?> config, string key, int defaultValue)
    {
        if (!config.TryGetValue(key, out var value)) return defaultValue;
        if (value == null) return defaultValue;
        if (value is int i) return i;
        if (value is long l) return (int)l;
        if (value is double d) return (int)d;
        if (value is System.Text.Json.JsonElement jsonEl)
        {
            if (jsonEl.ValueKind == System.Text.Json.JsonValueKind.Number)
                return jsonEl.TryGetInt32(out var intVal) ? intVal : defaultValue;
        }
        if (int.TryParse(value.ToString(), out var parsed)) return parsed;
        return defaultValue;
    }

    /// <summary>
    /// Substitutes {{inputName}} templates in a string with actual input values.
    /// </summary>
    private static string SubstituteTemplates(string template, Dictionary<string, object> inputs)
    {
        if (string.IsNullOrEmpty(template) || !template.Contains("{{"))
            return template;

        var result = template;
        foreach (var kvp in inputs)
        {
            var placeholder = "{{" + kvp.Key + "}}";
            var value = kvp.Value?.ToString() ?? string.Empty;
            result = result.Replace(placeholder, value);
        }
        return result;
    }

    /// <summary>
    /// Executes a CLI bridge tool - routes commands through the CLI executor.
    /// </summary>
    private async Task<BlockExecutionResult> ExecuteCliBridgeAsync(
        BlockDefinition block,
        ExecutionContext context,
        Dictionary<string, object> inputs,
        Stopwatch sw,
        CancellationToken ct)
    {
        var logs = new List<string>();
        var resultOutputs = new Dictionary<string, object?>();

        // Get command from inputs
        if (!inputs.TryGetValue("command", out var commandObj) || commandObj == null)
        {
            logs.Add("CLI bridge error: 'command' input is required");
            return new BlockExecutionResult
            {
                Outputs = new Dictionary<string, object> { ["success"] = false, ["error"] = "Command is required", ["exitCode"] = 1 },
                Logs = logs,
                Success = false,
                DurationMs = sw.ElapsedMilliseconds
            };
        }

        var command = commandObj.ToString() ?? string.Empty;
        logs.Add($"CLI bridge executing: {command}");

        // Resolve ICliExecutor from service provider
        if (_serviceProvider == null)
        {
            logs.Add("CLI bridge error: Service provider not available");
            return new BlockExecutionResult
            {
                Outputs = new Dictionary<string, object> { ["success"] = false, ["error"] = "CLI executor not available", ["exitCode"] = 1 },
                Logs = logs,
                Success = false,
                DurationMs = sw.ElapsedMilliseconds
            };
        }

        var cliExecutor = _serviceProvider.GetService(typeof(ICliExecutor)) as ICliExecutor;
        if (cliExecutor == null)
        {
            logs.Add("CLI bridge error: ICliExecutor service not registered");
            return new BlockExecutionResult
            {
                Outputs = new Dictionary<string, object> { ["success"] = false, ["error"] = "CLI executor not available", ["exitCode"] = 1 },
                Logs = logs,
                Success = false,
                DurationMs = sw.ElapsedMilliseconds
            };
        }

        // Build CLI execution context from domain ExecutionContext
        // These values may be stored in the context Variables
        var workspaceId = context.Variables.TryGetValue("workspaceId", out var wsObj) ? wsObj?.ToString() : null;
        var sessionId = context.Variables.TryGetValue("sessionId", out var sessObj) ? sessObj?.ToString() : null;
        var agentId = context.Variables.TryGetValue("agentId", out var agentObj) ? agentObj?.ToString() : null;

        var cliContext = new CliExecutionContext
        {
            WorkspaceId = workspaceId,
            SessionId = sessionId,
            AgentId = agentId
        };

        // Execute command
        var result = await cliExecutor.ExecuteAsync(command, cliContext, ct);

        logs.Add($"CLI result: success={result.Success}, exitCode={result.ExitCode}");

        resultOutputs["success"] = result.Success;
        resultOutputs["output"] = result.Output;
        resultOutputs["error"] = result.Error;
        resultOutputs["exitCode"] = result.ExitCode;

        sw.Stop();
        return new BlockExecutionResult
        {
            Outputs = resultOutputs.ToDictionary(kv => kv.Key, kv => kv.Value ?? new object()),
            Logs = logs,
            Success = result.Success,
            DurationMs = sw.ElapsedMilliseconds
        };
    }
}
