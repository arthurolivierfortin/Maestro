using System.Text.Json;
using Newtonsoft.Json.Linq;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using Microsoft.Extensions.Logging;

namespace Maestro.Infrastructure.Sessions;

/// <summary>
/// Manages session state during workflow execution: execution tree, logs,
/// metrics, artifacts, and active block tracking.
///
/// ARCHITECTURE (Phase 53-A): Extracted from EntryPointExecutor to separate
/// state management from control flow orchestration. Every method here was
/// previously a private/static method in EntryPointExecutor.
///
/// WARNING: Do NOT add execution logic or control flow here.
/// This class manages STATE, not EXECUTION. If you need to add node dispatch,
/// condition evaluation, or template resolution, those belong in NodeExecutionEngine.
/// </summary>
public class SessionStateManager : ISessionStateManager
{
    private readonly ILogger<SessionStateManager> _logger;

    public SessionStateManager(ILogger<SessionStateManager> logger)
    {
        _logger = logger;
    }

    // ===== Initialization =====

    /// <inheritdoc/>
    public void InitializeRuntime(ProjectSession session)
    {
        if (!session.HasVariable("_phases"))
            _logger.LogWarning("Session {SessionId} missing _phases variable. TUI phase display will be empty.", session.Id);
        else
        {
            var beforeType = session.GetVariable("_phases")?.GetType().Name ?? "null";
            NormalizeJsonElementToList(session, "_phases");
            var afterType = session.GetVariable("_phases")?.GetType().Name ?? "null";
            _logger.LogInformation("_phases normalized: {Before} -> {After}", beforeType, afterType);
        }

        if (!session.HasVariable("_monitorDescriptor"))
            _logger.LogWarning("Session {SessionId} missing _monitorDescriptor variable. TUI will use default layout.", session.Id);

        // Runtime variables — safe to initialize if missing
        if (!session.HasVariable("_executionLog"))
            session.SetVariable("_executionLog", new List<object>());

        if (!session.HasVariable("_artifacts"))
            session.SetVariable("_artifacts", new List<object>());

        if (!session.HasVariable("_blockOutputs"))
            session.SetVariable("_blockOutputs", new Dictionary<string, object>());

        if (!session.HasVariable("_llmActivity"))
            session.SetVariable("_llmActivity", new List<object>());

        if (!session.HasVariable("_phaseMetrics"))
            session.SetVariable("_phaseMetrics", new Dictionary<string, object>());
    }

    // ===== Execution Tree Building =====

    /// <inheritdoc/>
    public List<object> BuildExecutionTree(BlockDefinition? workflowBlock)
    {
        if (workflowBlock?.Config == null || !workflowBlock.Config.ContainsKey("nodes"))
        {
            return new List<object> { CreateNode("execute", "Execute Workflow", "pending") };
        }

        var nodesObj = workflowBlock.Config["nodes"];

        if (nodesObj is JsonElement jsonEl && jsonEl.ValueKind == JsonValueKind.Array)
        {
            var tree = new List<object>();
            foreach (var node in jsonEl.EnumerateArray())
            {
                var treeNode = BuildTreeNode(node);
                if (treeNode != null) tree.Add(treeNode);
            }
            return tree.Count > 0 ? tree : new List<object> { CreateNode("execute", "Execute Workflow", "pending") };
        }

        return new List<object> { CreateNode("execute", "Execute Workflow", "pending") };
    }

    // ===== Active Block =====

    /// <inheritdoc/>
    public void SetActiveBlock(ProjectSession session, string id, string name, string type, string status, string? output = null)
    {
        var block = new Dictionary<string, object>
        {
            ["id"] = id,
            ["name"] = name,
            ["type"] = type,
            ["status"] = status,
            ["startedAt"] = DateTimeOffset.UtcNow.ToString("o"),
            ["logs"] = new List<object>(),
            ["metadata"] = new Dictionary<string, object>()
        };
        if (output != null) block["output"] = output;
        session.SetVariable("_activeBlock", block);
    }

    /// <inheritdoc/>
    public void UpdateActiveBlockOutput(ProjectSession session, string output)
    {
        var block = session.GetVariable("_activeBlock");
        if (block is Dictionary<string, object> dict)
        {
            dict["output"] = output;
            session.SetVariable("_activeBlock", dict);
        }
    }

    /// <inheritdoc/>
    public void UpdateActiveBlockStatus(ProjectSession session, string status)
    {
        var block = session.GetVariable("_activeBlock");
        if (block is Dictionary<string, object> dict)
        {
            dict["status"] = status;
            session.SetVariable("_activeBlock", dict);
        }
    }

    /// <inheritdoc/>
    public void ClearActiveBlock(ProjectSession session)
    {
        session.SetVariable("_activeBlock", null!);
    }

    // ===== Block Outputs =====

    /// <inheritdoc/>
    public void StoreBlockOutput(ProjectSession session, string nodeId, string blockType, string? rawOutput, Dictionary<string, object>? detailOverride = null)
    {
        var blockOutputs = session.GetVariable("_blockOutputs");
        Dictionary<string, object> outputs;

        if (blockOutputs is Dictionary<string, object> existing)
            outputs = new Dictionary<string, object>(existing);
        else
            outputs = new Dictionary<string, object>();

        var entry = detailOverride ?? new Dictionary<string, object>
        {
            ["type"] = blockType,
            ["output"] = rawOutput ?? "",
            ["timestamp"] = DateTimeOffset.UtcNow.ToString("HH:mm:ss")
        };

        if (!entry.ContainsKey("timestamp"))
            entry["timestamp"] = DateTimeOffset.UtcNow.ToString("HH:mm:ss");

        outputs[nodeId] = entry;
        session.SetVariable("_blockOutputs", outputs);
    }

    // ===== Phase Management =====

    /// <inheritdoc/>
    public bool UpdatePhaseStatus(ProjectSession session, string phaseId, string status, int? progress = null)
    {
        var phases = session.GetVariable("_phases");
        if (phases is List<object> phaseList)
        {
            foreach (var item in phaseList)
            {
                if (item is Dictionary<string, object> phase && phase.TryGetValue("id", out var id) && id?.ToString() == phaseId)
                {
                    phase["status"] = status;
                    if (progress.HasValue)
                        phase["progress"] = progress.Value;
                    else
                        phase.Remove("progress");
                    session.SetVariable("_phases", phaseList);
                    return true;
                }
            }
        }
        return false;
    }

    /// <inheritdoc/>
    public void StorePhaseSummary(ProjectSession session, string phaseId, int iterations, double fitness)
    {
        var phases = session.GetVariable("_phases");
        if (phases is List<object> phaseList)
        {
            foreach (var item in phaseList)
            {
                if (item is Dictionary<string, object> phase && phase.TryGetValue("id", out var id) && id?.ToString() == phaseId)
                {
                    var result = new Dictionary<string, object>
                    {
                        ["iterations"] = iterations,
                        ["fitness"] = Math.Round(fitness, 2)
                    };
                    // Include token count and quality score if available
                    var tokenCount = session.GetVariable<int>("_tokenCount", 0);
                    if (tokenCount > 0) result["tokenCount"] = tokenCount;
                    var qualityScore = session.GetVariable<double>("_qualityScore", 0);
                    if (qualityScore > 0) result["qualityScore"] = Math.Round(qualityScore, 2);

                    // Add timing aggregates from _phaseMetrics
                    var phaseMetrics = session.GetVariable("_phaseMetrics") as Dictionary<string, object>;
                    if (phaseMetrics?.TryGetValue(phaseId, out var pm) == true
                        && pm is Dictionary<string, object> phaseData
                        && phaseData.TryGetValue("iterations", out var iters)
                        && iters is List<object> iterList)
                    {
                        if (iterList.Count > 0 && iterList[0] is Dictionary<string, object> first)
                        {
                            if (first.TryGetValue("totalMs", out var cs)) result["coldStartMs"] = cs;
                            if (first.TryGetValue("model", out var m)) result["model"] = m;
                        }
                        if (iterList.Count > 1 && iterList[^1] is Dictionary<string, object> last)
                        {
                            if (last.TryGetValue("totalMs", out var ws)) result["warmStartMs"] = ws;
                        }

                        var totalPrompt = iterList.OfType<Dictionary<string, object>>()
                            .Sum(d => d.TryGetValue("promptTokens", out var v) && v is int i ? i : 0);
                        var totalCompletion = iterList.OfType<Dictionary<string, object>>()
                            .Sum(d => d.TryGetValue("completionTokens", out var v) && v is int i ? i : 0);
                        if (totalPrompt > 0) result["totalPromptTokens"] = totalPrompt;
                        if (totalCompletion > 0) result["totalCompletionTokens"] = totalCompletion;
                    }

                    phase["result"] = result;
                    break;
                }
            }
            session.SetVariable("_phases", phaseList);
        }
    }

    // ===== Metrics & Logging =====

    /// <inheritdoc/>
    public void StoreIterationMetrics(ProjectSession session, string? phaseId, int iteration, double fitness)
    {
        if (string.IsNullOrEmpty(phaseId)) return;

        var metrics = session.GetVariable("_phaseMetrics") as Dictionary<string, object>
            ?? new Dictionary<string, object>();

        // Get latest LLM activity entry for timing/token data
        var llmActivity = session.GetVariable("_llmActivity") as List<object>;
        var latestLlm = llmActivity?.LastOrDefault() as Dictionary<string, object>;

        // Get validation data from _blockOutputs
        var blockOutputs = session.GetVariable("_blockOutputs") as Dictionary<string, object>;
        var validation = blockOutputs?.GetValueOrDefault("validation") as Dictionary<string, object>;

        var iterationData = new Dictionary<string, object>
        {
            ["iteration"] = iteration,
            ["timestamp"] = DateTime.UtcNow.ToString("o"),
            ["fitness"] = Math.Round(fitness, 4),
            ["passed"] = fitness >= ReadDoubleVariable(session, "targetFitness", 0.85)
        };

        // Copy timing and token data from latest LLM activity
        if (latestLlm != null)
        {
            foreach (var key in new[] { "modelSwitchMs", "inferenceMs", "totalMs",
                "promptTokens", "completionTokens", "totalTokens",
                "systemPrompt", "userPrompt", "fullResponse", "model" })
            {
                if (latestLlm.TryGetValue(key, out var v)) iterationData[key] = v;
            }
        }

        // Copy criteria scores from validation
        if (validation?.TryGetValue("criteriaScores", out var scores) == true)
            iterationData["criteriaScores"] = scores;

        // Get or create phase entry
        Dictionary<string, object> phaseEntry;
        if (metrics.TryGetValue(phaseId, out var existing) && existing is Dictionary<string, object> pe)
        {
            phaseEntry = pe;
        }
        else
        {
            phaseEntry = new Dictionary<string, object>
            {
                ["model"] = latestLlm?.GetValueOrDefault("model") ?? "unknown",
                ["iterations"] = new List<object>()
            };
            metrics[phaseId] = phaseEntry;
        }

        // Update model name from latest data (may have been "unknown" initially)
        if (latestLlm?.TryGetValue("model", out var modelVal) == true)
            phaseEntry["model"] = modelVal;

        (phaseEntry["iterations"] as List<object>)?.Add(iterationData);
        session.SetVariable("_phaseMetrics", metrics);
    }

    /// <inheritdoc/>
    public void AppendToLLMActivity(ProjectSession session, Dictionary<string, object> activity)
    {
        var existing = session.GetVariable("_llmActivity");
        List<object> list;
        if (existing is List<object> l)
            list = new List<object>(l);
        else
            list = new List<object>();

        list.Add(activity);

        // Keep last 20 entries
        if (list.Count > 20)
            list = list.Skip(list.Count - 20).ToList();

        session.SetVariable("_llmActivity", list);
    }

    /// <inheritdoc/>
    public void AppendExecutionLog(ProjectSession session, string level, string message)
    {
        var log = session.GetVariable("_executionLog");
        List<object> logList;
        if (log is List<object> existing)
            logList = new List<object>(existing);
        else
            logList = new List<object>();

        logList.Add(new Dictionary<string, object>
        {
            ["time"] = DateTimeOffset.UtcNow.ToString("HH:mm:ss"),
            ["level"] = level,
            ["msg"] = message
        });

        // Keep last 200 entries (increased from 50 for better debugging of multi-step pipelines)
        if (logList.Count > 200)
            logList = logList.Skip(logList.Count - 200).ToList();

        session.SetVariable("_executionLog", logList);
    }

    /// <inheritdoc/>
    public void AddArtifact(ProjectSession session, string name, string type, string? size = null, string status = "new")
    {
        var artifacts = session.GetVariable("_artifacts");
        List<object> list;
        if (artifacts is List<object> existing)
            list = new List<object>(existing);
        else
            list = new List<object>();

        // Update existing or add new
        var found = false;
        foreach (var item in list)
        {
            if (item is Dictionary<string, object> dict && dict.TryGetValue("name", out var n) && n?.ToString() == name)
            {
                dict["status"] = "updated";
                if (size != null) dict["size"] = size;
                found = true;
                break;
            }
        }

        if (!found)
        {
            var artifact = new Dictionary<string, object>
            {
                ["name"] = name,
                ["type"] = type,
                ["status"] = status
            };
            if (size != null) artifact["size"] = size;
            list.Add(artifact);
        }

        session.SetVariable("_artifacts", list);
    }

    // ===== Tree Manipulation =====

    /// <inheritdoc/>
    public void UpdateNodeById(List<object> tree, string nodeId, string status, string? output = null)
    {
        var node = FindNodeById(tree, nodeId);
        if (node == null) return;
        node["status"] = status;
        if (output != null)
            node["output"] = output;
        else if (status == "pending")
            node.Remove("output");
    }

    /// <inheritdoc/>
    public void ResetNodeTree(List<object> nodes)
    {
        foreach (var item in nodes)
        {
            if (item is Dictionary<string, object> node)
            {
                node["status"] = "pending";
                node.Remove("output");
                if (node.TryGetValue("children", out var children) && children is List<object> childList)
                    ResetNodeTree(childList);
            }
        }
    }

    /// <inheritdoc/>
    public Dictionary<string, object>? FindNodeById(List<object> tree, string nodeId)
    {
        foreach (var item in tree)
        {
            if (item is Dictionary<string, object> node)
            {
                if (node.TryGetValue("id", out var id) && id?.ToString() == nodeId)
                    return node;
                if (node.TryGetValue("children", out var children) && children is List<object> childList)
                {
                    var found = FindNodeById(childList, nodeId);
                    if (found != null) return found;
                }
            }
        }
        return null;
    }

    // ===== Static Helpers (used by NodeExecutionEngine and EntryPointExecutor) =====

    /// <summary>
    /// Creates a display tree node dictionary.
    /// </summary>
    public static Dictionary<string, object> CreateNode(string id, string name, string status, string? output = null)
    {
        var node = new Dictionary<string, object>
        {
            ["id"] = id,
            ["name"] = name,
            ["status"] = status,
            ["children"] = new List<object>()
        };
        if (output != null)
            node["output"] = output;
        return node;
    }

    /// <summary>
    /// Reads a double from a session variable, handling JsonElement/JValue/etc.
    /// Public static so NodeExecutionEngine can use it too.
    /// </summary>
    public static double ReadDoubleVariable(ProjectSession session, string key, double defaultValue)
    {
        var value = session.GetVariable(key);
        if (value == null) return defaultValue;
        if (value is double d) return d;
        if (value is int i) return i;
        if (value is long l) return l;
        if (value is float f) return f;
        if (value is JsonElement je && je.ValueKind == JsonValueKind.Number) return je.GetDouble();
        if (value is JValue jv && jv.Value != null) return Convert.ToDouble(jv.Value);
        if (double.TryParse(value.ToString(), System.Globalization.CultureInfo.InvariantCulture, out var parsed)) return parsed;
        return defaultValue;
    }

    /// <summary>
    /// Reads an int from a session variable, handling JsonElement/JValue/etc.
    /// Public static so NodeExecutionEngine can use it too.
    /// </summary>
    public static int ReadIntVariable(ProjectSession session, string key, int defaultValue)
    {
        var value = session.GetVariable(key);
        if (value == null) return defaultValue;
        if (value is int i) return i;
        if (value is long l) return (int)l;
        if (value is double d) return (int)d;
        if (value is JsonElement je && je.ValueKind == JsonValueKind.Number) return je.GetInt32();
        if (value is JValue jv && jv.Value != null) return Convert.ToInt32(jv.Value);
        if (int.TryParse(value.ToString(), out var parsed)) return parsed;
        return defaultValue;
    }

    /// <summary>
    /// Converts "evaluate-current" → "Evaluate Current"
    /// </summary>
    public static string NodeIdToDisplayName(string nodeId)
    {
        return string.Join(" ", nodeId.Split('-').Select(w =>
            w.Length > 0 ? char.ToUpperInvariant(w[0]) + w[1..] : w));
    }

    /// <summary>
    /// Infers block type from a node ID pattern.
    /// </summary>
    public static string InferBlockType(string nodeId)
    {
        if (nodeId.Contains("evaluate") || nodeId.Contains("load") || nodeId.Contains("apply"))
            return "script";
        if (nodeId.Contains("generate") || nodeId.Contains("improvement"))
            return "inference";
        if (nodeId.Contains("check") || nodeId.Contains("fitness") || nodeId.Contains("validate") || nodeId.Contains("metrics"))
            return "validator";
        return "task";
    }

    // ===== Private Helpers =====

    /// <summary>
    /// Recursively builds a tree node, preserving hierarchy.
    /// </summary>
    private static Dictionary<string, object>? BuildTreeNode(JsonElement node)
    {
        if (node.ValueKind != JsonValueKind.Object) return null;

        var id = node.TryGetProperty("id", out var idProp) ? idProp.GetString() ?? "unknown" : "unknown";
        var displayName = NodeIdToDisplayName(id);
        var treeNode = CreateNode(id, displayName, "pending");

        // Nest children for while/conditional/sequence/parallel nodes
        if (node.TryGetProperty("children", out var childNodes) && childNodes.ValueKind == JsonValueKind.Array)
        {
            var children = new List<object>();
            foreach (var child in childNodes.EnumerateArray())
            {
                var childNode = BuildTreeNode(child);
                if (childNode != null) children.Add(childNode);
            }
            treeNode["children"] = children;
        }
        else if (node.TryGetProperty("nodes", out var nestedNodes) && nestedNodes.ValueKind == JsonValueKind.Array)
        {
            var children = new List<object>();
            foreach (var child in nestedNodes.EnumerateArray())
            {
                var childNode = BuildTreeNode(child);
                if (childNode != null) children.Add(childNode);
            }
            treeNode["children"] = children;
        }

        return treeNode;
    }

    /// <summary>
    /// Converts a session variable from JsonElement (from API) to a mutable List.
    /// Public static because NodeExecutionEngine needs it for for-each normalization.
    /// </summary>
    public static void NormalizeJsonElementToList(ProjectSession session, string key)
    {
        var value = session.GetVariable(key);

        // Handle Newtonsoft.Json JArray (from API deserialization)
        if (value is JArray jArray)
        {
            var list = new List<object>();
            foreach (var item in jArray)
            {
                if (item is JObject jObj)
                {
                    var dict = new Dictionary<string, object>();
                    foreach (var prop in jObj.Properties())
                    {
                        dict[prop.Name] = prop.Value.Type switch
                        {
                            JTokenType.String => prop.Value.Value<string>()!,
                            JTokenType.Integer => prop.Value.Value<long>(),
                            JTokenType.Float => prop.Value.Value<double>(),
                            JTokenType.Boolean => prop.Value.Value<bool>(),
                            _ => prop.Value.ToString()
                        };
                    }
                    list.Add(dict);
                }
                else
                {
                    list.Add(item.ToString());
                }
            }
            session.SetVariable(key, list);
            return;
        }

        // Handle System.Text.Json JsonElement (from block config)
        if (value is JsonElement jsonEl && jsonEl.ValueKind == JsonValueKind.Array)
        {
            var list = new List<object>();
            foreach (var item in jsonEl.EnumerateArray())
            {
                if (item.ValueKind == JsonValueKind.Object)
                {
                    var dict = new Dictionary<string, object>();
                    foreach (var prop in item.EnumerateObject())
                    {
                        dict[prop.Name] = prop.Value.ValueKind switch
                        {
                            JsonValueKind.String => prop.Value.GetString()!,
                            JsonValueKind.Number => prop.Value.GetDouble(),
                            JsonValueKind.True => true,
                            JsonValueKind.False => false,
                            _ => prop.Value.ToString()!
                        };
                    }
                    list.Add(dict);
                }
                else
                {
                    list.Add(item.ToString()!);
                }
            }
            session.SetVariable(key, list);
            return;
        }

        // Handle string containing a JSON array (from LLM output stored as _nodeResult_xxx)
        if (value is string strValue)
        {
            var trimmed = strValue.Trim();
            if (trimmed.StartsWith("["))
            {
                try
                {
                    var parsed = JsonSerializer.Deserialize<JsonElement>(trimmed);
                    if (parsed.ValueKind == JsonValueKind.Array)
                    {
                        var list = new List<object>();
                        foreach (var item in parsed.EnumerateArray())
                        {
                            if (item.ValueKind == JsonValueKind.Object)
                            {
                                var dict = new Dictionary<string, object>();
                                foreach (var prop in item.EnumerateObject())
                                {
                                    dict[prop.Name] = prop.Value.ValueKind switch
                                    {
                                        JsonValueKind.String => prop.Value.GetString()!,
                                        JsonValueKind.Number => prop.Value.TryGetInt32(out var i) ? (object)i : prop.Value.GetDouble(),
                                        JsonValueKind.True => true,
                                        JsonValueKind.False => false,
                                        JsonValueKind.Array => prop.Value.ToString()!,
                                        JsonValueKind.Object => prop.Value.ToString()!,
                                        _ => prop.Value.ToString()!
                                    };
                                }
                                list.Add(dict);
                            }
                            else
                            {
                                list.Add(item.ToString()!);
                            }
                        }
                        session.SetVariable(key, list);
                    }
                }
                catch (JsonException)
                {
                    // Not valid JSON — leave as string
                }
            }
        }
    }
}
