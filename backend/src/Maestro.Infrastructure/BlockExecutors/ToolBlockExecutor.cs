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
    public string SupportedType => "tool";

    public async Task<BlockExecutionResult> ExecuteAsync(
        BlockDefinition block,
        ExecutionContext context,
        Dictionary<string, object> inputs,
        CancellationToken ct = default)
    {
        var sw = Stopwatch.StartNew();

        // Basic config options
        var config = block.Config ?? new Dictionary<string, object?>();
        config.TryGetValue("script", out var scriptObj);
        var script = scriptObj as string ?? string.Empty;
        // Optional script file name relative to workingDir
        config.TryGetValue("scriptFile", out var scriptFileObj);
        var scriptFile = scriptFileObj as string ?? string.Empty;

        config.TryGetValue("timeoutMs", out var timeoutObj);
        var timeoutMs = timeoutObj is int t ? t : 30000;

        // Working directory: try metadata 'path' entry, else current directory
        string? workingDir = null;
        if (block.Metadata != null && block.Metadata.TryGetValue("path", out var pathObj) && pathObj is string pathStr)
            workingDir = pathStr;
        workingDir ??= Directory.GetCurrentDirectory();

        // Prepare outputs and logs before sandboxing
        var resultOutputs = new Dictionary<string, object?>();
        var logs = new List<string>();

        // Determine runtime: default to pwsh on Windows, bash on Unix
        var runtime = config.TryGetValue("runtime", out var r) && r is string rs ? rs : (OperatingSystem.IsWindows() ? "powershell" : "bash");

        // If a scriptFile is provided and the block has a metadata.path, try to resolve it relative to that path
        if (!string.IsNullOrEmpty(scriptFile) && block.Metadata != null && block.Metadata.TryGetValue("path", out var metaPathObj) && metaPathObj is string metaPath)
        {
            var candidate = Path.Combine(metaPath, scriptFile);
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
            config.TryGetValue("parseOutput", out var parseOutObj);
            var parseOut = parseOutObj as string ?? string.Empty;
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
        return el.ValueKind switch
        {
            System.Text.Json.JsonValueKind.String => el.GetString(),
            System.Text.Json.JsonValueKind.Number => el.TryGetInt64(out var l) ? (object)l : el.GetDouble(),
            System.Text.Json.JsonValueKind.True => true,
            System.Text.Json.JsonValueKind.False => false,
            System.Text.Json.JsonValueKind.Object => el.ToString(),
            System.Text.Json.JsonValueKind.Array => el.ToString(),
            _ => null,
        };
    }
}
