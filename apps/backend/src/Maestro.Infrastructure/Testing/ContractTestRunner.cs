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
    private readonly IModelPricingService _pricingService;
    private readonly ILogger<ContractTestRunner> _logger;

    public ContractTestRunner(
        IBlockDiscoveryService blockDiscovery,
        BlockExecutorRegistry executorRegistry,
        ILLMGateway llmGateway,
        IProjectSessionRepository sessionRepository,
        IModelPricingService pricingService,
        ILogger<ContractTestRunner> logger)
    {
        _blockDiscovery = blockDiscovery;
        _executorRegistry = executorRegistry;
        _llmGateway = llmGateway;
        _sessionRepository = sessionRepository;
        _pricingService = pricingService;
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

        // Cost accumulators
        decimal totalCost = 0;
        int totalPromptTokens = 0;
        int totalCompletionTokens = 0;

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
                var (testResult, blockResult) = await ExecuteTestAsync(test, block, featureId, ct);
                result.TestResults.Add(testResult);

                // Accumulate costs from block execution
                if (blockResult != null)
                {
                    totalCost += blockResult.EstimatedCostUsd;
                    totalPromptTokens += blockResult.PromptTokens;
                    totalCompletionTokens += blockResult.CompletionTokens;
                }

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
        result.EstimatedCostUsd = totalCost;

        // Raw performance score (P) — weighted average of feature pass rates
        var rawPerformance = totalWeight > 0 ? totalWeightedScore / totalWeight : 0.0;
        result.PerformanceScore = rawPerformance;

        // Resolve model ID from block config or fallback
        var modelId = "unknown";
        if (block.Config != null && block.Config.TryGetValue("model", out var modelObj))
            modelId = modelObj?.ToString() ?? "unknown";

        // Build enriched model profile using pricing service
        var pricing = await _pricingService.GetPricingAsync(modelId, ct);
        var isLocal = modelId.ToLowerInvariant() is var mid
            && (mid.Contains("qwen") || mid.Contains("llama") || mid.Contains("smollm")
                || mid.Contains("local") || mid.Contains("mistral") || mid.Contains("mixtral")
                || mid.Contains("phi") || mid.Contains("gemma") || mid.Contains("deepseek"));
        var profile = pricing != null
            ? ModelProfile.CreateGeneric(modelId, "unknown", isLocal) with
            {
                CostPerMillionInputTokens = pricing.InputPricePerMillion,
                CostPerMillionOutputTokens = pricing.OutputPricePerMillion,
                ParametersBillions = pricing.ParametersBillions ?? (isLocal ? 7 : 100)
            }
            : ModelProfile.CreateGeneric(modelId, "unknown", isLocal);

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
            TotalCostUsd = totalCost,
            TotalInputTokens = totalPromptTokens,
            TotalOutputTokens = totalCompletionTokens
        };

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

    private async Task<(SingleTestResult test, BlockExecutionResult? block)> ExecuteTestAsync(
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

        BlockExecutionResult? lastBlockResult = null;

        try
        {
            // Determine if single-turn or multi-turn
            if (test.TryGetProperty("turns", out var turnsEl) && turnsEl.ValueKind == JsonValueKind.Array)
            {
                lastBlockResult = await ExecuteMultiTurnTestAsync(testResult, turnsEl, test, block, ct);
            }
            else if (test.TryGetProperty("prompt", out var promptEl))
            {
                var prompt = promptEl.GetString() ?? "";
                var check = test.TryGetProperty("check", out var checkEl) ? checkEl : (JsonElement?)null;
                var execResult = await SendPromptToBlockAsync(block, prompt, ct);
                lastBlockResult = execResult;
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
        return (testResult, lastBlockResult);
    }

    private async Task<BlockExecutionResult?> ExecuteMultiTurnTestAsync(
        SingleTestResult testResult, JsonElement turns, JsonElement test,
        BlockDefinition block, CancellationToken ct)
    {
        // For multi-turn, we send each turn sequentially and check the ones that have checks
        var conversationHistory = new List<(string role, string content)>();
        string lastResponse = "";
        bool allChecksPassed = true;
        string? lastCheckType = null;
        string? lastFailure = null;
        BlockExecutionResult? lastExecResult = null;

        foreach (var turn in turns.EnumerateArray())
        {
            var prompt = turn.TryGetProperty("prompt", out var p) ? p.GetString() ?? "" : "";

            // Build a combined prompt with conversation history for context
            var fullPrompt = BuildMultiTurnPrompt(conversationHistory, prompt);
            var execResult = await SendPromptToBlockAsync(block, fullPrompt, ct);
            lastExecResult = execResult;
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
        return lastExecResult;
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
    /// For agent blocks, creates a FRESH session per test to avoid state pollution
    /// (_agentDone, _agentResult, conversation history from previous test).
    /// </summary>
    private async Task<BlockExecutionResult> SendPromptToBlockAsync(BlockDefinition block, string prompt, CancellationToken ct)
    {
        var executor = _executorRegistry.Get(block.BlockType);
        if (executor == null)
            throw new InvalidOperationException($"No executor for block type '{block.BlockType}'");

        // For agent blocks, create a FRESH session per test to avoid state pollution
        string? perTestSessionId = null;
        string sessionIdForTest;
        if (string.Equals(block.BlockType, "agent", StringComparison.OrdinalIgnoreCase))
        {
            var perTestSession = ProjectSession.Create(
                "contract-test-" + Guid.NewGuid().ToString("N")[..8],
                Authority.Agent("contract-test-runner"),
                new ProjectSessionConfig(),
                Directory.GetCurrentDirectory());
            // Contract test sessions must not be blocked by session cost limits.
            // They run multiple LLM calls per test and the per-session limit is designed
            // for production workloads, not test infrastructure.
            perTestSession.SetVariable("_skipCostLimits", "true");

            // Phase 62-A: Set AllowedBlocks on the session for permission enforcement.
            // ToolDispatcherBlockExecutor.CheckToolPermission runs BEFORE _toolMapping redirect,
            // so these are the ORIGINAL tool names (not capture-* names).
            // Without this, fail-closed enforcement denies all tool calls in contract tests.
            perTestSession.UpdatePermissions(new ContextPermissions
            {
                AllowedBlocks = new List<string>
                {
                    "file-write",       // original name (before mapping to capture-file-write)
                    "file-read",        // original name (before mapping to capture-file-read)
                    "file-edit",        // original name (before mapping to capture-file-edit)
                    "shell-execute",    // original name (before mapping to capture-shell-execute)
                    "step-complete",    // agentic loop exit
                    "summary-validator", // validates step-complete summaries
                    // Maestro operation tools (mapped to capture-generic)
                    "session-create",
                    "workspace-list",
                    "workspace-create",
                    "block-list",
                    "session-stop",
                    "workspace-delete",
                    "contract-test"
                },
                AllowedCommands = new List<string> { "*" },
                AllowedTools = new List<string> { "*" },
                AllowedPaths = new List<string> { "*" },
                DataCollections = new List<string> { "*" }
            });

            // Phase 62-A: Set _toolMapping on the session so BuildExecutionContext propagates it
            // to nested tool-dispatcher nodes inside the agent's config.nodes.
            perTestSession.SetVariable("_toolMapping", JsonSerializer.Serialize(new Dictionary<string, string>
            {
                ["file-write"] = "capture-file-write",
                ["file-read"] = "capture-file-read",
                ["shell-execute"] = "capture-shell-execute",
                ["file-edit"] = "capture-file-edit",
                // Maestro operation tools → capture-generic
                ["session-create"] = "capture-generic",
                ["workspace-list"] = "capture-generic",
                ["workspace-create"] = "capture-generic",
                ["block-list"] = "capture-generic",
                ["session-stop"] = "capture-generic",
                ["workspace-delete"] = "capture-generic",
                ["contract-test"] = "capture-generic"
            }));

            await _sessionRepository.SaveAsync(perTestSession, ct);
            perTestSessionId = perTestSession.Id;
            sessionIdForTest = perTestSessionId;
        }
        else
        {
            sessionIdForTest = _tempSessionId!;
        }

        try
        {
            var context = new ExecutionContext();
            // Resolve project root (where content/system/ lives).
            // The API runs from apps/backend/src/Maestro.Api/ but content is at the repo root.
            var workingDir = Directory.GetCurrentDirectory();
            if (!Directory.Exists(Path.Combine(workingDir, "content", "system")))
            {
                var dir = new DirectoryInfo(workingDir);
                while (dir != null && !Directory.Exists(Path.Combine(dir.FullName, "content", "system")))
                    dir = dir.Parent;
                if (dir != null) workingDir = dir.FullName;
            }
            context.Variables["workingDir"] = workingDir;

            // Required by MultiNodeBlockExecutor (agent, workflow, tool blocks)
            context.Variables["sessionId"] = sessionIdForTest;

            // Phase 62-A: Inject _toolMapping on the context for the initial executor call.
            // The session already has _toolMapping set (above), which BuildExecutionContext
            // propagates to nested tool-dispatcher nodes inside the agent's config.nodes.
            if (string.Equals(block.BlockType, "agent", StringComparison.OrdinalIgnoreCase))
            {
                context.Variables["_toolMapping"] = JsonSerializer.Serialize(new Dictionary<string, string>
                {
                    ["file-write"] = "capture-file-write",
                    ["file-read"] = "capture-file-read",
                    ["shell-execute"] = "capture-shell-execute",
                    ["file-edit"] = "capture-file-edit",
                    // Maestro operation tools → capture-generic
                    ["session-create"] = "capture-generic",
                    ["workspace-list"] = "capture-generic",
                    ["workspace-create"] = "capture-generic",
                    ["block-list"] = "capture-generic",
                    ["session-stop"] = "capture-generic",
                    ["workspace-delete"] = "capture-generic",
                    ["contract-test"] = "capture-generic"
                });
            }

            // For agent/inference blocks, the prompt goes as "prompt" or "message" input
            // conversationHistory is required by AgentBlockExecutor (agents called through workflows
            // get it from the workflow; in contract tests we build it from the prompt)
            var conversationHistory = JsonSerializer.Serialize(new[]
            {
                new { role = "user", content = prompt }
            });

            var inputs = new Dictionary<string, object>
            {
                ["prompt"] = prompt,
                ["message"] = prompt,
                ["conversationHistory"] = conversationHistory
            };

            // For workflow blocks, also map the prompt to common workflow input names.
            // Workflows expect specific input names (description, contractId, etc.) not generic "prompt".
            if (string.Equals(block.BlockType, "workflow", StringComparison.OrdinalIgnoreCase))
            {
                inputs["description"] = prompt;
                inputs["contractId"] = prompt;
                inputs["outputDir"] = Path.Combine(workingDir, "content", "system", "contracts");
            }

            var execResult = await executor.ExecuteAsync(block, context, inputs, ct);

            // Phase 62-A: Copy _capturedToolCalls from context to outputs so EvaluateCheck can read them
            if (context.Variables.TryGetValue("_capturedToolCalls", out var capturedCalls) && capturedCalls != null)
            {
                execResult.Outputs["_capturedToolCalls"] = capturedCalls;
            }

            // Copy workflow output variables from context to outputs.
            // Workflows set results via set-variable nodes (stored in context.Variables),
            // but ExtractResponseText reads from execResult.Outputs.
            foreach (var key in new[] { "contractJson", "testSuiteJson", "blockJson",
                "contractId", "contractPath", "testSuitePath", "blockId", "blockPath",
                "fitness", "testResults", "plan" })
            {
                if (context.Variables.TryGetValue(key, out var val) && val != null
                    && !execResult.Outputs.ContainsKey(key))
                {
                    execResult.Outputs[key] = val;
                }
            }

            return execResult;
        }
        finally
        {
            // Clean up per-test session for agent blocks
            if (perTestSessionId != null)
            {
                try { await _sessionRepository.DeleteAsync(SessionId.From(perTestSessionId), ct); }
                catch { /* best-effort cleanup */ }
            }
        }
    }

    /// <summary>
    /// Extract response text from a BlockExecutionResult.
    /// </summary>
    private static string ExtractResponseText(BlockExecutionResult result)
    {
        // Priority 1: Named content outputs (from agents and workflows)
        // Workflow-specific keys FIRST (contractJson, testSuiteJson, blockJson) — these contain
        // the actual generated content. "content" and "result" may contain raw LLM output or paths.
        foreach (var key in new[] { "contractJson", "testSuiteJson", "blockJson", "response", "result", "content" })
        {
            if (result.Outputs.TryGetValue(key, out var val) && val != null)
            {
                var text = SerializeOutputValue(val);
                if (text.Length > 20) return text;
            }
        }

        // Priority 2: Single output
        if (result.Outputs.Count == 1)
            return SerializeOutputValue(result.Outputs.Values.First());

        // Priority 3: Find the longest non-underscore output (likely the content)
        var longest = result.Outputs
            .Where(kv => !kv.Key.StartsWith("_") && kv.Value != null)
            .OrderByDescending(kv => SerializeOutputValue(kv.Value).Length)
            .FirstOrDefault();
        if (longest.Value != null)
        {
            var text = SerializeOutputValue(longest.Value);
            if (text.Length > 50) return text;
        }

        // Priority 4: Concatenate all non-underscore outputs
        return string.Join("\n", result.Outputs
            .Where(kv => !kv.Key.StartsWith("_"))
            .Select(kv => SerializeOutputValue(kv.Value)));
    }

    /// <summary>
    /// Serialize a value to string. Lists and dicts get JSON-serialized instead of .ToString()
    /// which would return the C# type name (e.g. "System.Collections.Generic.List`1[...]").
    /// </summary>
    private static string SerializeOutputValue(object? value)
    {
        if (value == null) return "";
        if (value is string s) return s;
        // Newtonsoft JToken: use its own ToString() which produces proper JSON
        if (value is Newtonsoft.Json.Linq.JToken jt)
            return jt.ToString(Newtonsoft.Json.Formatting.None);
        if (value is System.Collections.IList || value is System.Collections.IDictionary)
        {
            try { return System.Text.Json.JsonSerializer.Serialize(value); }
            catch { /* fallthrough */ }
        }
        if (value is System.Text.Json.JsonElement je)
            return je.ValueKind == System.Text.Json.JsonValueKind.String ? je.GetString() ?? "" : je.GetRawText();
        return value.ToString() ?? "";
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
                var searchText = response + "\n" + GetCapturedContentText(blockOutputs);
                var passed = searchText.Contains(value, StringComparison.OrdinalIgnoreCase);
                return (passed, type,
                    passed ? null : $"Response does not contain '{value}'");
            }

            case "contains-all":
            {
                var values = GetStringArray(check, "values");
                var searchText = response + "\n" + GetCapturedContentText(blockOutputs);
                var missing = values.Where(v => !searchText.Contains(v, StringComparison.OrdinalIgnoreCase)).ToList();
                var passed = missing.Count == 0;
                return (passed, type,
                    passed ? null : $"Response missing: {string.Join(", ", missing.Select(m => $"'{m}'"))}");
            }

            case "contains-any":
            {
                var values = GetStringArray(check, "values");
                var searchText = response + "\n" + GetCapturedContentText(blockOutputs);
                var found = values.Any(v => searchText.Contains(v, StringComparison.OrdinalIgnoreCase));
                return (found, type,
                    found ? null : $"Response contains none of: {string.Join(", ", values.Select(v => $"'{v}'"))}");
            }

            case "does-not-contain":
            {
                var values = GetStringArray(check, "values");
                var searchText = response + "\n" + GetCapturedContentText(blockOutputs);
                var foundBad = values.Where(v => searchText.Contains(v, StringComparison.OrdinalIgnoreCase)).ToList();
                var passed = foundBad.Count == 0;
                return (passed, type,
                    passed ? null : $"Response contains forbidden: {string.Join(", ", foundBad.Select(f => $"'{f}'"))}");
            }

            case "tool-call":
            {
                var toolName = check.GetProperty("toolName").GetString() ?? "";
                // Check in the response text for tool call patterns
                var passed = response.Contains(toolName, StringComparison.OrdinalIgnoreCase);

                // Phase 62-A: Check captured tool calls from mock blocks (via _toolMapping)
                if (!passed && blockOutputs != null &&
                    blockOutputs.TryGetValue("_capturedToolCalls", out var captured))
                {
                    passed = captured?.ToString()?.Contains(toolName, StringComparison.OrdinalIgnoreCase) ?? false;
                }

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
                    if (TryFindValidJson(response))
                        return (true, type, null);

                    // Phase 64-C: Also check content from captured tool calls (via _toolMapping).
                    // The agent writes block.json via file-write (captured), so the JSON is in
                    // _capturedToolCalls content, not in the response summary.
                    foreach (var content in GetCapturedFileContents(blockOutputs))
                    {
                        if (TryFindValidJson(content))
                            return (true, type, null);
                    }

                    return (false, type, "No valid JSON found in response or captured tool calls");
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

    /// <summary>
    /// Get all captured tool call data as a single searchable string.
    /// Used by text-search checks (contains-all, contains, etc.) to also search
    /// in the content that agents wrote via capture blocks.
    /// </summary>
    private static string GetCapturedContentText(Dictionary<string, object>? blockOutputs)
    {
        if (blockOutputs == null) return "";
        if (!blockOutputs.TryGetValue("_capturedToolCalls", out var captured) || captured == null) return "";
        return captured.ToString() ?? "";
    }

    /// <summary>
    /// Extract individual file contents from captured tool calls.
    /// Used by json-parseable to validate that written file content is valid JSON.
    /// </summary>
    private static List<string> GetCapturedFileContents(Dictionary<string, object>? blockOutputs)
    {
        var results = new List<string>();
        if (blockOutputs == null) return results;
        if (!blockOutputs.TryGetValue("_capturedToolCalls", out var captured) || captured == null) return results;

        var capturedStr = captured.ToString() ?? "";
        if (string.IsNullOrEmpty(capturedStr)) return results;

        try
        {
            using var doc = JsonDocument.Parse(capturedStr);
            if (doc.RootElement.ValueKind == JsonValueKind.Array)
            {
                foreach (var entry in doc.RootElement.EnumerateArray())
                {
                    if (entry.TryGetProperty("content", out var contentEl))
                    {
                        var content = contentEl.GetString();
                        if (!string.IsNullOrEmpty(content))
                            results.Add(content);
                    }
                }
            }
        }
        catch { /* _capturedToolCalls not valid JSON — skip */ }

        return results;
    }

    /// <summary>
    /// Try to find and parse valid JSON (object or array) in a string.
    /// </summary>
    private static bool TryFindValidJson(string text)
    {
        if (string.IsNullOrEmpty(text)) return false;

        // Try object
        var jsonStart = text.IndexOf('{');
        var jsonEnd = text.LastIndexOf('}');
        if (jsonStart >= 0 && jsonEnd > jsonStart)
        {
            try
            {
                var jsonStr = text[jsonStart..(jsonEnd + 1)];
                JsonDocument.Parse(jsonStr);
                return true;
            }
            catch (JsonException) { /* try array next */ }
        }

        // Try array
        jsonStart = text.IndexOf('[');
        jsonEnd = text.LastIndexOf(']');
        if (jsonStart >= 0 && jsonEnd > jsonStart)
        {
            try
            {
                var jsonStr = text[jsonStart..(jsonEnd + 1)];
                JsonDocument.Parse(jsonStr);
                return true;
            }
            catch (JsonException) { return false; }
        }

        return false;
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
