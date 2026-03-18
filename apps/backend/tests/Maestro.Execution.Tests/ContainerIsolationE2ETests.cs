#nullable enable

using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using Maestro.Application.DTOs;
using Maestro.Domain.Configuration;
using Maestro.Domain.Entities;
using Maestro.Domain.ValueObjects;
using Maestro.Infrastructure.BlockExecutors;
using Maestro.Infrastructure.Sessions.NodeHandlers;
using Xunit;
using ExecutionContext = Maestro.Domain.Entities.ExecutionContext;

namespace Maestro.Execution.Tests;

/// <summary>
/// E2E tests for the container isolation model: permission propagation through the
/// Workspace -> Session -> Child Session tree, cost accumulation upward,
/// _toolMapping + permissions interaction, and agent child session isolation.
/// Phase 62-B: Validates that the container model works as a whole, not just in isolation.
/// </summary>
public class ContainerIsolationE2ETests
{
    // ═══════════════════════════════════════════════════════════
    // Helpers
    // ═══════════════════════════════════════════════════════════

    private static ProjectSession CreateSession(
        string name = "test-session",
        ContextPermissions? permissions = null)
    {
        return ProjectSession.Create(
            name,
            Authority.Human("tester"),
            new ProjectSessionConfig(),
            permissions: permissions);
    }

    private static ExecutionContext CreateContext(
        List<string>? allowedBlocks = null,
        IReadOnlyList<BlockPermission>? blockRules = null)
    {
        var ctx = new ExecutionContext();
        if (allowedBlocks != null)
            ctx.Variables["_permissions_allowedBlocks"] = allowedBlocks;
        if (blockRules != null)
            ctx.Variables["_permissions_blockRules"] = blockRules;
        return ctx;
    }

    /// <summary>
    /// Simulates BlockRefHandler.AccumulateCosts() which is private static.
    /// This matches the exact logic: parse current value, add result cost, store back.
    /// </summary>
    private static void SimulateAccumulateCosts(ProjectSession session, BlockExecutionResult result)
    {
        var currentCost = decimal.TryParse(
            session.GetVariable("_accumulatedCost")?.ToString(), out var c) ? c : 0m;
        session.SetVariable("_accumulatedCost",
            (currentCost + result.EstimatedCostUsd).ToString(CultureInfo.InvariantCulture));

        var currentPromptTokens = int.TryParse(
            session.GetVariable("_accumulatedPromptTokens")?.ToString(), out var pt) ? pt : 0;
        session.SetVariable("_accumulatedPromptTokens",
            (currentPromptTokens + result.PromptTokens).ToString());

        var currentCompletionTokens = int.TryParse(
            session.GetVariable("_accumulatedCompletionTokens")?.ToString(), out var cpt) ? cpt : 0;
        session.SetVariable("_accumulatedCompletionTokens",
            (currentCompletionTokens + result.CompletionTokens).ToString());
    }

    // ═══════════════════════════════════════════════════════════
    // Group 1: Permission propagation
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public void Group1_SessionInheritsWorkspacePermissions()
    {
        // Workspace with restricted AllowedBlocks
        var workspace = Workspace.Create("test-workspace", WorkspaceType.Research);
        workspace.UpdatePermissions(new ContextPermissions
        {
            AllowedBlocks = new List<string> { "file-read", "file-write", "step-complete" },
            AllowedCommands = new() { "*" },
            AllowedTools = new() { "*" },
            AllowedPaths = new() { "*" },
            DataCollections = new() { "*" }
        });

        // Session created in this workspace
        var session = CreateSession("child-session");
        session.SetParentSession(workspace);

        var effective = session.GetEffectivePermissions();

        // Session inherits workspace permissions
        Assert.Contains("file-read", effective.AllowedBlocks);
        Assert.Contains("file-write", effective.AllowedBlocks);
        Assert.Contains("step-complete", effective.AllowedBlocks);
        Assert.DoesNotContain("shell-execute", effective.AllowedBlocks);
        Assert.DoesNotContain("*", effective.AllowedBlocks);

        // HasBlockPermission uses effective permissions
        Assert.True(session.HasBlockPermission("file-read"));
        Assert.False(session.HasBlockPermission("shell-execute"));
    }

    [Fact]
    public void Group1_ChildSessionIsIntersectionWithParent()
    {
        // Parent: allows 4 tools
        var parent = CreateSession("parent", permissions: new ContextPermissions
        {
            AllowedBlocks = new List<string> { "file-read", "file-write", "shell-execute", "step-complete" },
            AllowedCommands = new() { "*" },
            AllowedTools = new() { "*" },
            AllowedPaths = new() { "*" },
            DataCollections = new() { "*" }
        });

        // Child: requests only 2 of the 4
        var child = ProjectSession.CreateAsChild("child", parent);
        child.UpdatePermissions(new ContextPermissions
        {
            AllowedBlocks = new List<string> { "file-read", "step-complete" },
            AllowedCommands = new() { "*" },
            AllowedTools = new() { "*" },
            AllowedPaths = new() { "*" },
            DataCollections = new() { "*" }
        });

        var effective = child.GetEffectivePermissions();

        // Intersection: only file-read and step-complete
        Assert.Contains("file-read", effective.AllowedBlocks);
        Assert.Contains("step-complete", effective.AllowedBlocks);
        Assert.DoesNotContain("file-write", effective.AllowedBlocks);
        Assert.DoesNotContain("shell-execute", effective.AllowedBlocks);

        // Verify via CheckToolPermission
        var ctx = CreateContext(allowedBlocks: effective.AllowedBlocks);
        Assert.True(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "file-read").Allowed);
        Assert.True(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "step-complete").Allowed);
        Assert.False(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "file-write").Allowed);
        Assert.False(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "shell-execute").Allowed);
    }

    [Fact]
    public void Group1_ChildCannotEscalatePermissions()
    {
        // Parent: only allows file-read
        var parent = CreateSession("parent", permissions: new ContextPermissions
        {
            AllowedBlocks = new List<string> { "file-read" },
            AllowedCommands = new() { "*" },
            AllowedTools = new() { "*" },
            AllowedPaths = new() { "*" },
            DataCollections = new() { "*" }
        });

        // Child attempts to escalate by requesting file-read + shell-execute
        var child = ProjectSession.CreateAsChild("child", parent);
        child.UpdatePermissions(new ContextPermissions
        {
            AllowedBlocks = new List<string> { "file-read", "shell-execute" },
            AllowedCommands = new() { "*" },
            AllowedTools = new() { "*" },
            AllowedPaths = new() { "*" },
            DataCollections = new() { "*" }
        });

        var effective = child.GetEffectivePermissions();

        // Intersection: only file-read (shell-execute was not in parent)
        Assert.Contains("file-read", effective.AllowedBlocks);
        Assert.DoesNotContain("shell-execute", effective.AllowedBlocks);

        // Enforce via CheckToolPermission
        var ctx = CreateContext(allowedBlocks: effective.AllowedBlocks);
        Assert.True(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "file-read").Allowed);
        Assert.False(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "shell-execute").Allowed);
    }

    [Fact]
    public void Group1_ThreeLevelsDeep_PermissionsNarrow()
    {
        // Level 1: Workspace with wildcard
        var workspace = Workspace.Create("ws", WorkspaceType.Research);
        // workspace default = ContextPermissions.Full → AllowedBlocks = ["*"]

        // Level 2: Session restricts to 4 tools
        var session = CreateSession("session");
        session.SetParentSession(workspace);
        session.UpdatePermissions(new ContextPermissions
        {
            AllowedBlocks = new List<string> { "file-read", "file-write", "shell-execute", "step-complete" },
            AllowedCommands = new() { "*" },
            AllowedTools = new() { "*" },
            AllowedPaths = new() { "*" },
            DataCollections = new() { "*" }
        });

        // Level 3: Child restricts further to 2 tools
        var child = ProjectSession.CreateAsChild("child", session);
        child.UpdatePermissions(new ContextPermissions
        {
            AllowedBlocks = new List<string> { "file-read", "step-complete" },
            AllowedCommands = new() { "*" },
            AllowedTools = new() { "*" },
            AllowedPaths = new() { "*" },
            DataCollections = new() { "*" }
        });

        var effective = child.GetEffectivePermissions();

        // Only file-read and step-complete survive 3 levels of intersection
        Assert.Contains("file-read", effective.AllowedBlocks);
        Assert.Contains("step-complete", effective.AllowedBlocks);
        Assert.DoesNotContain("file-write", effective.AllowedBlocks);
        Assert.DoesNotContain("shell-execute", effective.AllowedBlocks);

        // Full enforcement check
        var ctx = CreateContext(allowedBlocks: effective.AllowedBlocks);
        Assert.True(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "file-read").Allowed);
        Assert.True(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "step-complete").Allowed);
        Assert.False(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "file-write").Allowed);
        Assert.False(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "shell-execute").Allowed);
    }

    [Fact]
    public void Group1_BlockPermissionRulesAndAllowedBlocksCombined()
    {
        // Parent: AllowedBlocks=["*"], but Deny("shell-execute")
        var parent = CreateSession("parent");
        // Default ContextPermissions.Full has AllowedBlocks = ["*"]
        parent.SetBlockPermissions(new[]
        {
            BlockPermission.Deny("shell-execute", "security policy")
        });

        // Child inherits both AllowedBlocks and BlockPermission rules
        var child = ProjectSession.CreateAsChild("child", parent);

        // Child inherits BlockPermissions
        Assert.Single(child.BlockPermissions);
        Assert.Equal("shell-execute", child.BlockPermissions[0].BlockPattern);
        Assert.Equal(BlockPermissionLevel.Denied, child.BlockPermissions[0].Permission);

        // Build execution context from child's effective state
        var effective = child.GetEffectivePermissions();
        var ctx = CreateContext(
            allowedBlocks: effective.AllowedBlocks,
            blockRules: child.BlockPermissions);

        // file-read: no deny rule matches, AllowedBlocks=["*"] passes → allowed
        Assert.True(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "file-read").Allowed);

        // shell-execute: deny rule matches → denied with reason
        var result = ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "shell-execute");
        Assert.False(result.Allowed);
        Assert.Contains("security policy", result.Error!);
    }

    // ═══════════════════════════════════════════════════════════
    // Group 2: Permissions in execution context
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public void Group2_BuildExecutionContext_PropagatesAllowedBlocks()
    {
        // Session with restricted AllowedBlocks
        var session = CreateSession("session", permissions: new ContextPermissions
        {
            AllowedBlocks = new List<string> { "file-read", "step-complete" },
            AllowedCommands = new() { "*" },
            AllowedTools = new() { "*" },
            AllowedPaths = new() { "*" },
            DataCollections = new() { "*" }
        });

        // Simulate BuildExecutionContext: propagate effective permissions
        var effective = session.GetEffectivePermissions();
        var ctx = new ExecutionContext();
        ctx.Variables["_permissions_allowedBlocks"] = effective.AllowedBlocks;

        // Verify propagation
        Assert.True(ctx.Variables.ContainsKey("_permissions_allowedBlocks"));
        var propagated = ctx.Variables["_permissions_allowedBlocks"] as List<string>;
        Assert.NotNull(propagated);
        Assert.Contains("file-read", propagated);
        Assert.Contains("step-complete", propagated);

        // Verify enforcement
        Assert.True(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "file-read").Allowed);
        Assert.False(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "file-write").Allowed);
    }

    [Fact]
    public void Group2_BuildExecutionContext_PropagatesBlockPermissions()
    {
        // Session with BlockPermission deny rules
        var session = CreateSession("session");
        session.SetBlockPermissions(new[]
        {
            BlockPermission.Deny("shell-execute", "security")
        });

        // Simulate BuildExecutionContext
        var effective = session.GetEffectivePermissions();
        var ctx = new ExecutionContext();
        ctx.Variables["_permissions_allowedBlocks"] = effective.AllowedBlocks;
        if (session.BlockPermissions.Count > 0)
            ctx.Variables["_permissions_blockRules"] = session.BlockPermissions;

        // Verify propagation
        Assert.True(ctx.Variables.ContainsKey("_permissions_blockRules"));

        // Verify enforcement: shell-execute denied with reason
        var result = ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "shell-execute");
        Assert.False(result.Allowed);
        Assert.Contains("security", result.Error!);

        // Other tools still allowed (wildcard AllowedBlocks)
        Assert.True(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "file-read").Allowed);
    }

    // ═══════════════════════════════════════════════════════════
    // Group 3: Costs flow up the tree
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public void Group3_BlockExecution_ParentAccumulatesCost()
    {
        // Parent session starts with no cost
        var parent = CreateSession("parent");
        parent.Start();

        // Child session for agent execution
        var child = ProjectSession.CreateAsChild("child / agent", parent);

        // Simulate block execution result with cost
        var result = new BlockExecutionResult
        {
            Success = true,
            EstimatedCostUsd = 0.05m,
            PromptTokens = 1000,
            CompletionTokens = 500
        };

        // AccumulateCosts is called on the PARENT (this is the contract)
        SimulateAccumulateCosts(parent, result);

        // Verify parent accumulated the cost
        Assert.Equal("0.05",
            parent.GetVariable("_accumulatedCost")?.ToString());
        Assert.Equal("1000",
            parent.GetVariable("_accumulatedPromptTokens")?.ToString());
        Assert.Equal("500",
            parent.GetVariable("_accumulatedCompletionTokens")?.ToString());

        // Child session should NOT have cost variables (isolation)
        Assert.Null(child.GetVariable("_accumulatedCost"));
        Assert.Null(child.GetVariable("_accumulatedPromptTokens"));
    }

    [Fact]
    public void Group3_CostsThroughMultipleLevels()
    {
        // Level 1: Root session (the one that accumulates costs)
        var root = CreateSession("root-session");
        root.Start();

        // Level 2: Child session
        var child = ProjectSession.CreateAsChild("child / agent-1", root);

        // Simulate 3 block executions with different costs
        var results = new[]
        {
            new BlockExecutionResult { Success = true, EstimatedCostUsd = 0.01m, PromptTokens = 100, CompletionTokens = 50 },
            new BlockExecutionResult { Success = true, EstimatedCostUsd = 0.02m, PromptTokens = 200, CompletionTokens = 100 },
            new BlockExecutionResult { Success = true, EstimatedCostUsd = 0.03m, PromptTokens = 300, CompletionTokens = 150 },
        };

        // All costs accumulate on root (the parent session passed to AccumulateCosts)
        foreach (var r in results)
            SimulateAccumulateCosts(root, r);

        // Verify total cost on root: 0.01 + 0.02 + 0.03 = 0.06
        Assert.Equal("0.06",
            root.GetVariable("_accumulatedCost")?.ToString());
        Assert.Equal("600",
            root.GetVariable("_accumulatedPromptTokens")?.ToString());
        Assert.Equal("300",
            root.GetVariable("_accumulatedCompletionTokens")?.ToString());

        // Child has no cost variables
        Assert.Null(child.GetVariable("_accumulatedCost"));
    }

    // ═══════════════════════════════════════════════════════════
    // Group 4: _toolMapping + permissions
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public void Group4_MappingRedirects_PermissionsFilter()
    {
        // Session with AllowedBlocks for original tool names + _toolMapping
        var session = CreateSession("session");
        session.UpdatePermissions(new ContextPermissions
        {
            AllowedBlocks = new List<string> { "file-write", "step-complete" },
            AllowedCommands = new() { "*" },
            AllowedTools = new() { "*" },
            AllowedPaths = new() { "*" },
            DataCollections = new() { "*" }
        });
        session.SetVariable("_toolMapping", new Dictionary<string, string>
        {
            ["file-write"] = "capture-file-write"
        });

        // Simulate BuildExecutionContext
        var effective = session.GetEffectivePermissions();
        var ctx = new ExecutionContext();
        ctx.Variables["_permissions_allowedBlocks"] = effective.AllowedBlocks;
        var toolMapping = session.GetVariable("_toolMapping");
        if (toolMapping != null)
            ctx.Variables["_toolMapping"] = toolMapping;

        // Permission check is on ORIGINAL name (before mapping)
        // file-write: in AllowedBlocks → allowed → then mapping redirects to capture-file-write
        Assert.True(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "file-write").Allowed);

        // shell-execute: NOT in AllowedBlocks → denied → mapping never consulted
        var denied = ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "shell-execute");
        Assert.False(denied.Allowed);
        Assert.Contains("not available", denied.Error!);

        // Verify mapping is in context for later use by ToolDispatcherBlockExecutor
        Assert.True(ctx.Variables.ContainsKey("_toolMapping"));
    }

    [Fact]
    public void Group4_ContractTestRunner_RestrictedPermissions()
    {
        // Simulate ContractTestRunner scenario:
        // AllowedBlocks = the tools agents are allowed to call (original names)
        // _toolMapping = redirects to capture blocks
        var session = CreateSession("contract-test-session");
        session.UpdatePermissions(new ContextPermissions
        {
            AllowedBlocks = new List<string>
            {
                "file-read", "file-write", "file-edit", "shell-execute", "step-complete"
            },
            AllowedCommands = new() { "*" },
            AllowedTools = new() { "*" },
            AllowedPaths = new() { "*" },
            DataCollections = new() { "*" }
        });
        session.SetVariable("_toolMapping", new Dictionary<string, string>
        {
            ["file-write"] = "capture-file-write",
            ["file-read"] = "capture-file-read",
            ["file-edit"] = "capture-file-edit",
            ["shell-execute"] = "capture-shell-execute"
        });

        var effective = session.GetEffectivePermissions();
        var ctx = CreateContext(allowedBlocks: effective.AllowedBlocks);

        // Allowed: tools in the AllowedBlocks list
        Assert.True(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "file-write").Allowed);
        Assert.True(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "file-read").Allowed);
        Assert.True(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "step-complete").Allowed);

        // Denied: tools NOT in AllowedBlocks (the json-validator bug scenario)
        var jsonResult = ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "json-validator");
        Assert.False(jsonResult.Allowed);
        Assert.Contains("json-validator", jsonResult.Error!);
        Assert.Contains("not available", jsonResult.Error!);
    }

    // ═══════════════════════════════════════════════════════════
    // Group 5: Agent always in child session
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public void Group5_AgentWithWildcard_GetsIsolatedChildSession()
    {
        // Parent session with AllowedBlocks=["*"]
        var parent = CreateSession("parent-session");
        parent.Start();
        parent.SetVariable("existingVar", "parent value");
        parent.SetVariable("_workflowCheckpoint", "node-1,node-2");

        // Create child session for agent (simulates BlockRefHandler.ExecuteAsync)
        var child = ProjectSession.CreateAsChild("child / agents/code-reviewer", parent);

        // Child has its own variables (initially empty)
        Assert.Empty(child.Variables);

        // Parent variables are not visible in child
        Assert.Null(child.GetVariable("existingVar"));
        Assert.Null(child.GetVariable("_workflowCheckpoint"));

        // Child can set its own agent variables
        child.SetVariable("_agentDone", "true");
        child.SetVariable("_conversationId", "conv-123");

        // Parent does NOT have the child's variables
        Assert.Null(parent.GetVariable("_agentDone"));
        Assert.Null(parent.GetVariable("_conversationId"));

        // Parent sees the original values
        Assert.Equal("parent value", parent.GetVariable("existingVar")?.ToString());
        Assert.Equal("node-1,node-2", parent.GetVariable("_workflowCheckpoint")?.ToString());

        // Simulate storing result on parent (what BlockRefHandler does)
        parent.SetVariable("_nodeResult_call-agent", "Agent completed successfully");
        Assert.Equal("Agent completed successfully",
            parent.GetVariable("_nodeResult_call-agent")?.ToString());
    }

    [Fact]
    public void Group5_ChildSessionVariablesDontLeakToParent()
    {
        var parent = CreateSession("parent");
        parent.Start();

        // Create two child sessions for different agents
        var child1 = ProjectSession.CreateAsChild("child / agent-1", parent);
        var child2 = ProjectSession.CreateAsChild("child / agent-2", parent);

        // Each child sets its own state
        child1.SetVariable("_agentDone", "true");
        child1.SetVariable("_agentResult", "result from agent 1");
        child1.SetVariable("_conversationId", "conv-1");

        child2.SetVariable("_agentDone", "false");
        child2.SetVariable("_conversationId", "conv-2");

        // Variables are isolated between children
        Assert.Equal("result from agent 1", child1.GetVariable("_agentResult")?.ToString());
        Assert.Null(child2.GetVariable("_agentResult"));

        Assert.Equal("conv-1", child1.GetVariable("_conversationId")?.ToString());
        Assert.Equal("conv-2", child2.GetVariable("_conversationId")?.ToString());

        // Parent has none of the child variables
        Assert.Null(parent.GetVariable("_agentDone"));
        Assert.Null(parent.GetVariable("_agentResult"));
        Assert.Null(parent.GetVariable("_conversationId"));
    }

    // ═══════════════════════════════════════════════════════════
    // Additional: Full tree scenario (workspace → session → child → permissions + costs)
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public void FullTree_WorkspaceToChildSession_PermissionsAndCosts()
    {
        // Workspace with restricted permissions
        var workspace = Workspace.Create("prod-workspace", WorkspaceType.Production);
        workspace.UpdatePermissions(new ContextPermissions
        {
            AllowedBlocks = new List<string> { "file-read", "file-write", "step-complete" },
            AllowedCommands = new() { "*" },
            AllowedTools = new() { "*" },
            AllowedPaths = new() { "*" },
            DataCollections = new() { "*" }
        });

        // Session in workspace
        var session = CreateSession("dev-session");
        session.SetParentSession(workspace);
        session.Start();

        // Verify session inherits workspace restrictions
        var sessionEffective = session.GetEffectivePermissions();
        Assert.Contains("file-read", sessionEffective.AllowedBlocks);
        Assert.DoesNotContain("shell-execute", sessionEffective.AllowedBlocks);

        // Child session for agent execution
        var child = ProjectSession.CreateAsChild("child / agents/test-designer", session);

        // Child inherits intersection of workspace + session
        var childEffective = child.GetEffectivePermissions();
        Assert.Contains("file-read", childEffective.AllowedBlocks);
        Assert.DoesNotContain("shell-execute", childEffective.AllowedBlocks);

        // Cost accumulates on session (parent of child)
        var result = new BlockExecutionResult
        {
            Success = true,
            EstimatedCostUsd = 0.10m,
            PromptTokens = 2000,
            CompletionTokens = 1000
        };
        SimulateAccumulateCosts(session, result);

        var accumulatedCost = decimal.Parse(
            session.GetVariable("_accumulatedCost")!.ToString()!,
            CultureInfo.InvariantCulture);
        Assert.Equal(0.10m, accumulatedCost);
        Assert.Null(child.GetVariable("_accumulatedCost"));

        // Permission enforcement in context
        var ctx = CreateContext(allowedBlocks: childEffective.AllowedBlocks);
        Assert.True(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "file-read").Allowed);
        Assert.False(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "shell-execute").Allowed);
    }

    [Fact]
    public void ChildSession_InheritsToolMapping_FromParent()
    {
        // Parent with _toolMapping set
        var parent = CreateSession("parent");
        parent.Start();
        parent.SetVariable("_toolMapping", new Dictionary<string, string>
        {
            ["file-write"] = "capture-file-write",
            ["file-read"] = "capture-file-read"
        });

        // CreateAsChild starts with empty variables (isolation)
        var child = ProjectSession.CreateAsChild("child / agent", parent);
        Assert.Null(child.GetVariable("_toolMapping"));

        // But in the real flow, BlockRefHandler propagates _toolMapping
        // from parent to child (parentPropagate array).
        // Simulate that propagation:
        var toolMapping = parent.GetVariable("_toolMapping");
        if (toolMapping != null)
            child.SetVariable("_toolMapping", toolMapping);

        // Verify child now has the mapping
        Assert.NotNull(child.GetVariable("_toolMapping"));
        var mapping = child.GetVariable("_toolMapping") as Dictionary<string, string>;
        Assert.NotNull(mapping);
        Assert.Equal("capture-file-write", mapping["file-write"]);
    }

    // ═══════════════════════════════════════════════════════════
    // Group 6: API-level permission management (Phase 62-D)
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public void Group6_GetEffectivePermissions_ReturnsIntersectedPermissions()
    {
        // Workspace with restricted blocks
        var workspace = Workspace.Create("test-ws", WorkspaceType.Research);
        workspace.UpdatePermissions(new ContextPermissions
        {
            AllowedBlocks = new() { "file-read", "file-write", "step-complete" },
            AllowedCommands = new() { "*" },
            AllowedTools = new() { "*" },
            CanCreateBlocks = true,
            CanCreateSessions = true,
            DataCollections = new() { "*" },
            AllowedPaths = new() { "*" }
        });

        // Child session with own permissions (subset of workspace)
        var session = CreateSession("child-session", new ContextPermissions
        {
            AllowedBlocks = new() { "file-read", "file-write", "step-complete", "shell-execute" },
            AllowedCommands = new() { "*" },
            AllowedTools = new() { "*" },
            CanCreateBlocks = true,
            CanCreateSessions = true,
            DataCollections = new() { "*" },
            AllowedPaths = new() { "*" }
        });
        session.SetParentSession(workspace);

        // Effective should be the intersection
        var effective = session.GetEffectivePermissions();

        // shell-execute is in session but NOT in workspace → should NOT be in effective
        Assert.DoesNotContain("shell-execute", effective.AllowedBlocks);

        // These are in both → should be in effective
        Assert.Contains("file-read", effective.AllowedBlocks);
        Assert.Contains("file-write", effective.AllowedBlocks);
        Assert.Contains("step-complete", effective.AllowedBlocks);
    }

    [Fact]
    public void Group6_UpdatePermissions_EscalationPrevented()
    {
        // Parent workspace allows only file-read and step-complete
        var workspace = Workspace.Create("secure-ws", WorkspaceType.Production);
        workspace.UpdatePermissions(new ContextPermissions
        {
            AllowedBlocks = new() { "file-read", "step-complete" },
            AllowedCommands = new() { "*" },
            AllowedTools = new() { "*" },
            CanCreateBlocks = false,
            CanCreateSessions = false,
            DataCollections = new() { "*" },
            AllowedPaths = new() { "*" }
        });

        // Child session starts with the same as parent (via intersection)
        var session = CreateSession("child-session");
        session.SetParentSession(workspace);

        // Try to ESCALATE: request shell-execute and file-write (not in parent)
        session.UpdatePermissions(new ContextPermissions
        {
            AllowedBlocks = new() { "file-read", "file-write", "shell-execute", "step-complete" },
            AllowedCommands = new() { "*" },
            AllowedTools = new() { "*" },
            CanCreateBlocks = true,
            CanCreateSessions = true,
            DataCollections = new() { "*" },
            AllowedPaths = new() { "*" }
        });

        // GetEffectivePermissions should NOT contain the escalated blocks
        var effective = session.GetEffectivePermissions();
        Assert.DoesNotContain("shell-execute", effective.AllowedBlocks);
        Assert.DoesNotContain("file-write", effective.AllowedBlocks);

        // Only the blocks that are in BOTH parent and request should be present
        Assert.Contains("file-read", effective.AllowedBlocks);
        Assert.Contains("step-complete", effective.AllowedBlocks);

        // CanCreateBlocks/Sessions should also be intersected (parent says false)
        Assert.False(effective.CanCreateBlocks);
        Assert.False(effective.CanCreateSessions);
    }

    [Fact]
    public void Group6_SetBlockPermissions_SavesRules()
    {
        var session = CreateSession("test-session");

        // Set block permission rules
        session.SetBlockPermissions(new[]
        {
            BlockPermission.Deny("shell-execute", "no shell access in this session"),
            BlockPermission.Allow("agents/*"),
            BlockPermission.RequiresApproval("file-write", "dangerous operation")
        });

        // Verify rules are saved
        Assert.Equal(3, session.BlockPermissions.Count);

        var denyRule = session.BlockPermissions.First(r => r.BlockPattern == "shell-execute");
        Assert.Equal(BlockPermissionLevel.Denied, denyRule.Permission);
        Assert.Equal("no shell access in this session", denyRule.Reason);

        var allowRule = session.BlockPermissions.First(r => r.BlockPattern == "agents/*");
        Assert.Equal(BlockPermissionLevel.Allowed, allowRule.Permission);

        var approvalRule = session.BlockPermissions.First(r => r.BlockPattern == "file-write");
        Assert.Equal(BlockPermissionLevel.RequiresApproval, approvalRule.Permission);
    }

    [Fact]
    public void Group6_UpdatePermissions_ThenGetEffective_RoundTrip()
    {
        // Workspace with full access
        var workspace = Workspace.Create("ws", WorkspaceType.Research);

        // Session as child of workspace
        var session = CreateSession("session");
        session.SetParentSession(workspace);

        // Update with specific blocks
        session.UpdatePermissions(new ContextPermissions
        {
            AllowedBlocks = new() { "file-read", "file-write" },
            AllowedCommands = new() { "run" },
            AllowedTools = new() { "git-diff" },
            CanCreateBlocks = false,
            CanCreateSessions = true,
            DataCollections = new() { "experiments" },
            AllowedPaths = new() { "src/" }
        });

        // Get effective
        var effective = session.GetEffectivePermissions();

        // Verify round-trip: what we set is what we get (since workspace has full access)
        Assert.Equal(2, effective.AllowedBlocks.Count);
        Assert.Contains("file-read", effective.AllowedBlocks);
        Assert.Contains("file-write", effective.AllowedBlocks);
        Assert.Single(effective.AllowedCommands);
        Assert.Contains("run", effective.AllowedCommands);
        Assert.Single(effective.AllowedTools);
        Assert.Contains("git-diff", effective.AllowedTools);
        Assert.False(effective.CanCreateBlocks);
        Assert.True(effective.CanCreateSessions);
    }

    [Fact]
    public void Group6_EffectivePermissions_OwnVsParent()
    {
        // Workspace with limited blocks
        var workspace = Workspace.Create("ws", WorkspaceType.Staging);
        workspace.UpdatePermissions(new ContextPermissions
        {
            AllowedBlocks = new() { "file-read", "file-write", "step-complete" },
            AllowedCommands = new() { "*" },
            AllowedTools = new() { "*" },
            CanCreateBlocks = true,
            CanCreateSessions = true,
            DataCollections = new() { "*" },
            AllowedPaths = new() { "*" }
        });

        // Session with its own (broader) permissions
        var session = CreateSession("session", new ContextPermissions
        {
            AllowedBlocks = new() { "*" },
            AllowedCommands = new() { "*" },
            AllowedTools = new() { "*" },
            CanCreateBlocks = true,
            CanCreateSessions = true,
            DataCollections = new() { "*" },
            AllowedPaths = new() { "*" }
        });
        session.SetParentSession(workspace);

        // Own permissions = wildcard (broad)
        var own = session.Permissions;
        Assert.Contains("*", own.AllowedBlocks);

        // Effective = intersection with parent (restricted to parent's blocks)
        var effective = session.GetEffectivePermissions();
        Assert.DoesNotContain("*", effective.AllowedBlocks);
        Assert.Equal(3, effective.AllowedBlocks.Count);

        // Parent effective = workspace's own permissions (root has no parent)
        var parentEffective = workspace.GetEffectivePermissions();
        Assert.Equal(3, parentEffective.AllowedBlocks.Count);
    }

    [Fact]
    public void Group6_WorkspaceTreeStructure_CostAccumulation()
    {
        // Workspace
        var workspace = Workspace.Create("test-ws", WorkspaceType.Research);

        // Root session
        var rootSession = CreateSession("Dev Session");
        rootSession.Start();
        rootSession.SetVariable("_accumulatedCost", "0.52");

        // Child session
        var child = ProjectSession.CreateAsChild("child / agent-creator", rootSession);
        child.SetVariable("_accumulatedCost", "0.12");

        // Verify tree data can be extracted
        Assert.Equal("0.52", rootSession.GetVariable("_accumulatedCost")?.ToString());
        Assert.Equal("0.12", child.GetVariable("_accumulatedCost")?.ToString());
        Assert.Equal(rootSession.Id, child.ParentSessionId);

        // Verify workspace tracks sessions
        workspace.AddSession(rootSession.Id);
        Assert.Contains(rootSession.Id, workspace.SessionIds);
    }
}
