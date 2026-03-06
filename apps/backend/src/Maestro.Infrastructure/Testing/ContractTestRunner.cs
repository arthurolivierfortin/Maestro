using System.Diagnostics;
using System.Text.Json;
using System.Text.RegularExpressions;
using Maestro.Application.DTOs;
using Maestro.Application.Interfaces;
using Maestro.Domain.Configuration;
using Maestro.Domain.Entities;
using Maestro.Domain.ValueObjects;
using Maestro.Infrastructure.BlockExecutors;
using Microsoft.Extensions.Logging;
using ExecutionContext = Maestro.Domain.Entities.ExecutionContext;

namespace Maestro.Infrastructure.Testing;

/// <summary>
/// Executes contract tests against a block and computes fitness scores.
/// Supports all 8 check types: non-empty, contains, contains-all, contains-any,
/// does-not-contain, tool-call, json-parseable, regex.
/// </summary>
public class ContractTestRunner
{
    private readonly IBlockDiscoveryService _blockDiscovery;
    private readonly BlockExecutorRegistry _executorRegistry;
    private readonly ILLMGateway _llmGateway;
    private readonly IProjectSessionRepository _sessionRepository;
    private readonly ILogger<ContractTestRunner> _logger;

    public ContractTestRunner(
        IBlockDiscoveryService blockDiscovery,
        BlockExecutorRegistry executorRegistry,
        ILLMGateway llmGateway,
        IProjectSessionRepository sessionRepository,
        ILogger<ContractTestRunner> logger)
    {
        _blockDiscovery = blockDiscovery;
        _executorRegistry = executorRegistry;
        _llmGateway = llmGateway;
        _sessionRepository = sessionRepository;
        _logger = logger;
    }

    /// <summary>
    /// Run all tests from a contract against a block. Returns per-feature scores and global fitness.
    /// </summary>
    public async Task<ContractTestResult> RunAsync(
        JsonElement contract,
        BlockDefinition block,
        CancellationToken ct = default)
    {
        var sw = Stopwatch.StartNew();
        var contractId = contract.GetProperty("id").GetString() ?? "";
        var contractVersion = contract.TryGetProperty("version", out var v) ? v.GetString() ?? "" : "";
        var minimumFitness = contract.TryGetProperty("minimumFitness", out var mf) ? mf.GetDouble() : 0.0;

        // Create a temporary session for block execution (required by MultiNodeBlockExecutor)
        var tempSession = ProjectSession.Create(
            $"contract-test-{contractId}-{block.Id}",
            Authority.Agent("contract-test-runner"),
            new ProjectSessionConfig(),
            Directory.GetCurrentDirectory());
        await _sessionRepository.SaveAsync(tempSession, ct);
        _tempSessionId = tempSession.Id;

        try
        {
            return await RunInternalAsync(contract, block, contractId, contractVersion, minimumFitness, sw, ct);
        }
        finally
        {
            _tempSessionId = null;
            try { await _sessionRepository.DeleteAsync(SessionId.From(tempSession.Id), ct); }
            catch { /* best-effort cleanup */ }
        }
    }

    private string? _tempSessionId;

    private async Task<ContractTestResult> RunInternalAsync(
        JsonElement contract, BlockDefinition block,
        string contractId, string contractVersion, double minimumFitness,
        Stopwatch sw, CancellationToken ct)
    {
        var result = new ContractTestResult
        {
            ContractId = contractId,
            ContractVersion = contractVersion,
            BlockId = block.Id
        };

        // 1. Check requiredCapabilities gate
        var blockCaps = block.Capabilities ?? new List<string>();
        var requiredCaps = new List<string>();
        if (contract.TryGetProperty("requiredCapabilities", out var rcEl) && rcEl.ValueKind == JsonValueKind.Array)
        {
            foreach (var cap in rcEl.EnumerateArray())
                requiredCaps.Add(cap.GetString() ?? "");
        }

        result.MeetsRequiredCapabilities = requiredCaps.All(rc => blockCaps.Contains(rc));
        if (!result.MeetsRequiredCapabilities)
        {
            var missing = requiredCaps.Where(rc => !blockCaps.Contains(rc));
            result.FailureReasons.Add($"Missing required capabilities: {string.Join(", ", missing)}");
            result.Passed = false;
            sw.Stop();
            result.DurationMs = sw.ElapsedMilliseconds;
            return result;
        }

        // 2. Process each feature
        if (!contract.TryGetProperty("features", out var featuresEl))
        {
            result.Passed = true;
            sw.Stop();
            result.DurationMs = sw.ElapsedMilliseconds;
            return result;
        }

        var allPassed = true;
        double totalWeightedScore = 0;
        double totalWeight = 0;

        foreach (var featureProp in featuresEl.EnumerateObject())
        {
            var featureId = featureProp.Name;
            var feature = featureProp.Value;

            var featureResult = new FeatureTestResult
            {
                FeatureId = featureId,
                Description = feature.TryGetProperty("description", out var desc) ? desc.GetString() ?? "" : "",
                Weight = feature.TryGetProperty("weight", out var w2) ? w2.GetDouble() : 0.0,
                MinimumScore = feature.TryGetProperty("minimumScore", out var ms) ? ms.GetDouble() : 0.0
            };

            // Check if feature is active (block has all required capabilities)
            var featureRequires = new List<string>();
            if (feature.TryGetProperty("requires", out var reqEl) && reqEl.ValueKind == JsonValueKind.Array)
            {
                foreach (var req in reqEl.EnumerateArray())
                    featureRequires.Add(req.GetString() ?? "");
            }

            featureResult.Active = featureRequires.All(r => blockCaps.Contains(r));

            if (!featureResult.Active)
            {
                result.Features.Add(featureResult);
                continue;
            }

            // Collect tests from contract
            var tests = new List<JsonElement>();
            if (feature.TryGetProperty("tests", out var testsEl) && testsEl.ValueKind == JsonValueKind.Array)
            {
                foreach (var test in testsEl.EnumerateArray())
                    tests.Add(test);
            }

            featureResult.TestsTotal = tests.Count;

            // Execute each test
            int passed = 0;
            foreach (var test in tests)
            {
                var testResult = await ExecuteTestAsync(test, block, featureId, ct);
                result.TestResults.Add(testResult);

                if (testResult.Skipped)
                {
                    result.SkippedTests++;
                }
                else if (testResult.Passed)
                {
                    passed++;
                    result.PassedTests++;
                }
                else
                {
                    result.FailedTests++;
                }
            }

            featureResult.TestsPassed = passed;
            featureResult.Score = featureResult.TestsTotal > 0
                ? (double)passed / featureResult.TestsTotal
                : 0.0;
            featureResult.MeetsThreshold = featureResult.Score >= featureResult.MinimumScore;

            if (!featureResult.MeetsThreshold)
            {
                result.FailureReasons.Add(
                    $"Feature '{featureId}' score {featureResult.Score:F2} < minimum {featureResult.MinimumScore:F2}");
                allPassed = false;
            }

            totalWeightedScore += featureResult.Weight * featureResult.Score;
            totalWeight += featureResult.Weight;

            result.Features.Add(featureResult);
        }

        result.TotalTests = result.PassedTests + result.FailedTests + result.SkippedTests;

        // Raw performance score (P) — weighted average of feature pass rates
        var rawPerformance = totalWeight > 0 ? totalWeightedScore / totalWeight : 0.0;
        result.PerformanceScore = rawPerformance;

        // Build inputs for FitnessScore.Calculate()
        var metrics = new WorkflowExecutionMetrics
        {
            Quality = new QualityScore
            {
                Score = (int)Math.Round(rawPerformance * 100) // P needs 0-100
            },
            BlocksTotal = result.TotalTests,
            BlocksSucceeded = result.PassedTests,
            TotalRetries = 0, // Contract tests don't retry
            TotalCostUsd = result.EstimatedCostUsd
        };

        // Get model info from the block's config
        var modelId = "unknown";
        if (block.Config != null && block.Config.TryGetValue("model", out var modelObj))
            modelId = modelObj?.ToString() ?? "unknown";

        var profile = ModelProfile.CreateGeneric(modelId, "unknown");
        var entropy = TaskEntropy.FromFeatureCount(result.Features.Count(f => f.Active));
        var config = FitnessConfig.Default;

        var fitnessScore = FitnessScore.Calculate(metrics, profile, entropy, config);
        result.Fitness = fitnessScore.TotalFitness;
        result.FitnessBreakdown = fitnessScore.GetBreakdown();
        result.Passed = allPassed && result.Fitness >= minimumFitness;

        if (!allPassed && result.Fitness < minimumFitness)
        {
            result.FailureReasons.Add(
                $"Global fitness {result.Fitness:F2} < minimum {minimumFitness:F2}");
        }

        sw.Stop();
        result.DurationMs = sw.ElapsedMilliseconds;

        _logger.LogInformation(
            "Contract test {ContractId} vs {BlockId}: fitness={Fitness:F2}, passed={Passed}, tests={Passed}/{Total}",
            contractId, block.Id, result.Fitness, result.Passed, result.PassedTests, result.TotalTests);

        return result;
    }

    private async Task<SingleTestResult> ExecuteTestAsync(
        JsonElement test, BlockDefinition block, string featureId, CancellationToken ct)
    {
        var testId = test.TryGetProperty("id", out var idEl) ? idEl.GetString() ?? "" : "";
        var description = test.TryGetProperty("description", out var descEl) ? descEl.GetString() : null;
        var testSw = Stopwatch.StartNew();

        var testResult = new SingleTestResult
        {
            TestId = testId,
            FeatureId = featureId,
            Description = description
        };

        try
        {
            // Determine if single-turn or multi-turn
            if (test.TryGetProperty("turns", out var turnsEl) && turnsEl.ValueKind == JsonValueKind.Array)
            {
                await ExecuteMultiTurnTestAsync(testResult, turnsEl, test, block, ct);
            }
            else if (test.TryGetProperty("prompt", out var promptEl))
            {
                var prompt = promptEl.GetString() ?? "";
                var check = test.TryGetProperty("check", out var checkEl) ? checkEl : (JsonElement?)null;
                var execResult = await SendPromptToBlockAsync(block, prompt, ct);
                var response = ExtractResponseText(execResult);
                testResult.Response = Truncate(response, 500);

                if (check.HasValue)
                {
                    var (passed, checkType, failureReason) = EvaluateCheck(check.Value, response, execResult.Outputs);
                    testResult.Passed = passed;
                    testResult.CheckType = checkType;
                    testResult.FailureReason = failureReason;
                }
                else
                {
                    testResult.Passed = !string.IsNullOrEmpty(response);
                    testResult.CheckType = "non-empty";
                }
            }
            else
            {
                testResult.Skipped = true;
                testResult.FailureReason = "Test has neither 'prompt' nor 'turns'";
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Test {TestId} failed with exception", testId);
            testResult.Passed = false;
            testResult.FailureReason = $"Execution error: {ex.Message}";
        }

        testSw.Stop();
        testResult.DurationMs = testSw.ElapsedMilliseconds;
        return testResult;
    }

    private async Task ExecuteMultiTurnTestAsync(
        SingleTestResult testResult, JsonElement turns, JsonElement test,
        BlockDefinition block, CancellationToken ct)
    {
        // For multi-turn, we send each turn sequentially and check the ones that have checks
        var conversationHistory = new List<(string role, string content)>();
        string lastResponse = "";
        bool allChecksPassed = true;
        string? lastCheckType = null;
        string? lastFailure = null;

        foreach (var turn in turns.EnumerateArray())
        {
            var prompt = turn.TryGetProperty("prompt", out var p) ? p.GetString() ?? "" : "";

            // Build a combined prompt with conversation history for context
            var fullPrompt = BuildMultiTurnPrompt(conversationHistory, prompt);
            var execResult = await SendPromptToBlockAsync(block, fullPrompt, ct);
            var response = ExtractResponseText(execResult);
            lastResponse = response;

            conversationHistory.Add(("user", prompt));
            conversationHistory.Add(("assistant", response));

            // Check if this turn has a check
            if (turn.TryGetProperty("check", out var checkEl))
            {
                var (passed, checkType, failureReason) = EvaluateCheck(checkEl, response, execResult.Outputs);
                lastCheckType = checkType;
                if (!passed)
                {
                    allChecksPassed = false;
                    lastFailure = failureReason;
                }
            }
        }

        testResult.Passed = allChecksPassed;
        testResult.Response = Truncate(lastResponse, 500);
        testResult.CheckType = lastCheckType;
        testResult.FailureReason = lastFailure;
    }

    private string BuildMultiTurnPrompt(List<(string role, string content)> history, string currentPrompt)
    {
        if (history.Count == 0)
            return currentPrompt;

        var sb = new System.Text.StringBuilder();
        sb.AppendLine("Previous conversation:");
        foreach (var (role, content) in history)
        {
            sb.AppendLine($"{role}: {content}");
        }
        sb.AppendLine();
        sb.AppendLine($"user: {currentPrompt}");
        return sb.ToString();
    }

    /// <summary>
    /// Send a prompt to a block and get the full execution result.
    /// Uses the block's executor (agent, inference, tool) through the standard pipeline.
    /// </summary>
    private async Task<BlockExecutionResult> SendPromptToBlockAsync(BlockDefinition block, string prompt, CancellationToken ct)
    {
        var executor = _executorRegistry.Get(block.BlockType);
        if (executor == null)
            throw new InvalidOperationException($"No executor for block type '{block.BlockType}'");

        var context = new ExecutionContext();
        context.Variables["workingDir"] = Directory.GetCurrentDirectory();

        // Required by MultiNodeBlockExecutor (agent, workflow, tool blocks)
        if (_tempSessionId != null)
            context.Variables["sessionId"] = _tempSessionId;

        // For agent/inference blocks, the prompt goes as "prompt" or "message" input
        var inputs = new Dictionary<string, object>
        {
            ["prompt"] = prompt,
            ["message"] = prompt
        };

        return await executor.ExecuteAsync(block, context, inputs, ct);
    }

    /// <summary>
    /// Extract response text from a BlockExecutionResult.
    /// </summary>
    private static string ExtractResponseText(BlockExecutionResult result)
    {
        if (result.Outputs.TryGetValue("response", out var resp) && resp != null)
            return resp.ToString() ?? "";
        if (result.Outputs.TryGetValue("result", out var res) && res != null)
            return res.ToString() ?? "";
        if (result.Outputs.TryGetValue("content", out var cnt) && cnt != null)
            return cnt.ToString() ?? "";
        if (result.Outputs.Count == 1)
            return result.Outputs.Values.First()?.ToString() ?? "";

        return string.Join("\n", result.Outputs
            .Where(kv => !kv.Key.StartsWith("_"))
            .Select(kv => kv.Value?.ToString() ?? ""));
    }

    /// <summary>
    /// Evaluate a check against a response. Returns (passed, checkType, failureReason).
    /// </summary>
    public static (bool passed, string checkType, string? failureReason) EvaluateCheck(
        JsonElement check, string response, Dictionary<string, object>? blockOutputs)
    {
        var type = check.TryGetProperty("type", out var typeEl) ? typeEl.GetString() ?? "" : "";

        switch (type)
        {
            case "non-empty":
            {
                var minLength = check.TryGetProperty("minLength", out var ml) ? ml.GetInt32() : 1;
                var passed = response.Length >= minLength;
                return (passed, type,
                    passed ? null : $"Response length {response.Length} < minLength {minLength}");
            }

            case "contains":
            {
                var value = check.GetProperty("value").GetString() ?? "";
                var passed = response.Contains(value, StringComparison.OrdinalIgnoreCase);
                return (passed, type,
                    passed ? null : $"Response does not contain '{value}'");
            }

            case "contains-all":
            {
                var values = GetStringArray(check, "values");
                var missing = values.Where(v => !response.Contains(v, StringComparison.OrdinalIgnoreCase)).ToList();
                var passed = missing.Count == 0;
                return (passed, type,
                    passed ? null : $"Response missing: {string.Join(", ", missing.Select(m => $"'{m}'"))}");
            }

            case "contains-any":
            {
                var values = GetStringArray(check, "values");
                var found = values.Any(v => response.Contains(v, StringComparison.OrdinalIgnoreCase));
                return (found, type,
                    found ? null : $"Response contains none of: {string.Join(", ", values.Select(v => $"'{v}'"))}");
            }

            case "does-not-contain":
            {
                var values = GetStringArray(check, "values");
                var foundBad = values.Where(v => response.Contains(v, StringComparison.OrdinalIgnoreCase)).ToList();
                var passed = foundBad.Count == 0;
                return (passed, type,
                    passed ? null : $"Response contains forbidden: {string.Join(", ", foundBad.Select(f => $"'{f}'"))}");
            }

            case "tool-call":
            {
                var toolName = check.GetProperty("toolName").GetString() ?? "";
                // Check in the response text for tool call patterns
                var passed = response.Contains(toolName, StringComparison.OrdinalIgnoreCase);
                // Also check block outputs for tool call metadata
                if (!passed && blockOutputs != null)
                {
                    if (blockOutputs.TryGetValue("_toolCalls", out var tc))
                        passed = tc?.ToString()?.Contains(toolName, StringComparison.OrdinalIgnoreCase) ?? false;
                }
                return (passed, type,
                    passed ? null : $"No tool call to '{toolName}' detected");
            }

            case "json-parseable":
            {
                try
                {
                    // Try to find JSON in the response
                    var jsonStart = response.IndexOf('{');
                    var jsonEnd = response.LastIndexOf('}');
                    if (jsonStart >= 0 && jsonEnd > jsonStart)
                    {
                        var jsonStr = response[jsonStart..(jsonEnd + 1)];
                        JsonDocument.Parse(jsonStr);
                        return (true, type, null);
                    }
                    // Try array
                    jsonStart = response.IndexOf('[');
                    jsonEnd = response.LastIndexOf(']');
                    if (jsonStart >= 0 && jsonEnd > jsonStart)
                    {
                        var jsonStr = response[jsonStart..(jsonEnd + 1)];
                        JsonDocument.Parse(jsonStr);
                        return (true, type, null);
                    }
                    return (false, type, "No valid JSON found in response");
                }
                catch (JsonException ex)
                {
                    return (false, type, $"JSON parse error: {ex.Message}");
                }
            }

            case "regex":
            {
                var pattern = check.GetProperty("pattern").GetString() ?? "";
                var flags = check.TryGetProperty("flags", out var fl) ? fl.GetString() ?? "" : "";
                var options = RegexOptions.None;
                if (flags.Contains('i')) options |= RegexOptions.IgnoreCase;
                if (flags.Contains('m')) options |= RegexOptions.Multiline;
                try
                {
                    var passed = Regex.IsMatch(response, pattern, options);
                    return (passed, type,
                        passed ? null : $"Response does not match pattern '{pattern}'");
                }
                catch (RegexParseException ex)
                {
                    return (false, type, $"Invalid regex: {ex.Message}");
                }
            }

            default:
                return (false, type, $"Unknown check type: '{type}'");
        }
    }

    private static List<string> GetStringArray(JsonElement element, string propertyName)
    {
        var result = new List<string>();
        if (element.TryGetProperty(propertyName, out var arr) && arr.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in arr.EnumerateArray())
                result.Add(item.GetString() ?? "");
        }
        return result;
    }

    private static string Truncate(string s, int maxLength)
    {
        return s.Length <= maxLength ? s : s[..maxLength] + "...";
    }
}
