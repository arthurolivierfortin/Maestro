#nullable enable

using System;
using System.Collections.Generic;
using Maestro.Domain.Configuration;
using Maestro.Domain.Entities;
using Maestro.Domain.ValueObjects;
using Maestro.Infrastructure.BlockExecutors;
using Xunit;
using ExecutionContext = Maestro.Domain.Entities.ExecutionContext;

namespace Maestro.Execution.Tests;

/// <summary>
/// Tests for ToolDispatcherBlockExecutor.CheckToolPermission().
/// Phase 62-C: Validates container isolation model — tool dispatch is filtered
/// by session permissions before any block is resolved or executed.
///
/// Two permission layers:
///   Layer 1: BlockPermissions rules (explicit Allow/Deny/RequiresApproval per pattern)
///   Layer 2: AllowedBlocks whitelist (from ContextPermissions.GetEffectivePermissions)
/// </summary>
public class ToolDispatcherPermissionTests
{
    // ═══════════════════════════════════════════════════════════
    // Helpers
    // ═══════════════════════════════════════════════════════════

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

    // ═══════════════════════════════════════════════════════════
    // Fail-closed: no permissions in context = DENY
    // (Every context MUST have _permissions_allowedBlocks set.
    //  Sessions default to ContextPermissions.Full with AllowedBlocks=["*"].
    //  Missing permissions = bug in BuildExecutionContext.)
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public void NoPermissions_DeniesTool_FailClosed()
    {
        var ctx = new ExecutionContext();

        var result = ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "file-write");

        Assert.False(result.Allowed);
        Assert.Contains("no permissions configured", result.Error!);
    }

    [Fact]
    public void EmptyContext_DeniesTool_FailClosed()
    {
        var ctx = CreateContext();

        var result = ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "json-validator");

        Assert.False(result.Allowed);
        Assert.Contains("no permissions configured", result.Error!);
    }

    [Fact]
    public void DefaultSession_HasWildcardPermissions_AllowsAll()
    {
        // A default ProjectSession has ContextPermissions.Full → AllowedBlocks = ["*"]
        // This is the "all permissions" default — not a backwards compat hack.
        var session = ProjectSession.Create(
            "test", Authority.Human("tester"), new ProjectSessionConfig());
        var permissions = session.GetEffectivePermissions();
        var ctx = CreateContext(allowedBlocks: permissions.AllowedBlocks);

        Assert.True(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "file-write").Allowed);
        Assert.True(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "shell-execute").Allowed);
        Assert.True(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "anything").Allowed);
    }

    // ═══════════════════════════════════════════════════════════
    // Layer 2: AllowedBlocks whitelist
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public void AllowedBlocks_Wildcard_AllowsEverything()
    {
        var ctx = CreateContext(allowedBlocks: new List<string> { "*" });

        Assert.True(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "file-write").Allowed);
        Assert.True(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "shell-execute").Allowed);
        Assert.True(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "anything").Allowed);
    }

    [Fact]
    public void AllowedBlocks_ExactMatch_Allows()
    {
        var ctx = CreateContext(allowedBlocks: new List<string> { "file-write", "file-read" });

        Assert.True(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "file-write").Allowed);
        Assert.True(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "file-read").Allowed);
    }

    [Fact]
    public void AllowedBlocks_NotInList_Denied()
    {
        var ctx = CreateContext(allowedBlocks: new List<string> { "file-write", "file-read" });

        var result = ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "shell-execute");

        Assert.False(result.Allowed);
        Assert.Contains("shell-execute", result.Error!);
        Assert.Contains("not available", result.Error!);
    }

    [Fact]
    public void AllowedBlocks_PatternMatch_SlashWildcard()
    {
        // Pattern "tools/*" matches "tools/git-diff" (hierarchical IDs)
        var ctx = CreateContext(allowedBlocks: new List<string> { "tools/*" });

        Assert.True(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "tools/git-diff").Allowed);
        Assert.True(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "tools/file-read").Allowed);
        // Non-matching prefix
        Assert.False(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "shell-execute").Allowed);
        Assert.False(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "agents/code-reviewer").Allowed);
    }

    [Fact]
    public void AllowedBlocks_PatternMatch_ColonWildcard()
    {
        var ctx = CreateContext(allowedBlocks: new List<string> { "system:*" });

        Assert.True(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "system:fitness-calculator").Allowed);
        Assert.True(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "system:contract-test").Allowed);
        Assert.False(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "file-write").Allowed);
    }

    [Fact]
    public void AllowedBlocks_EmptyList_DeniesEverything()
    {
        // Empty list = ContextPermissions.None → no blocks allowed
        var ctx = CreateContext(allowedBlocks: new List<string>());

        var result = ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "file-write");
        Assert.False(result.Allowed);
        Assert.Contains("no allowed blocks", result.Error!);
    }

    [Fact]
    public void AllowedBlocks_CaseInsensitive()
    {
        var ctx = CreateContext(allowedBlocks: new List<string> { "File-Write" });

        Assert.True(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "File-Write").Allowed);
    }

    [Fact]
    public void AllowedBlocks_ErrorMessage_ListsAllowed()
    {
        var ctx = CreateContext(allowedBlocks: new List<string> { "file-read", "step-complete" });

        var result = ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "shell-execute");

        Assert.False(result.Allowed);
        Assert.Contains("file-read", result.Error!);
        Assert.Contains("step-complete", result.Error!);
    }

    // ═══════════════════════════════════════════════════════════
    // Layer 1: BlockPermission rules (explicit deny/allow)
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public void BlockRules_ExplicitDeny_Blocks()
    {
        var rules = new List<BlockPermission>
        {
            BlockPermission.Deny("shell-execute", "security risk")
        };
        var ctx = CreateContext(blockRules: rules);

        var result = ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "shell-execute");

        Assert.False(result.Allowed);
        Assert.Contains("denied", result.Error!);
        Assert.Contains("security risk", result.Error!);
    }

    [Fact]
    public void BlockRules_ExplicitAllow_Passes()
    {
        var rules = new List<BlockPermission>
        {
            BlockPermission.Allow("file-write")
        };
        var ctx = CreateContext(
            allowedBlocks: new List<string> { "*" },
            blockRules: rules);

        Assert.True(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "file-write").Allowed);
    }

    [Fact]
    public void BlockRules_RequiresApproval_Blocks()
    {
        var rules = new List<BlockPermission>
        {
            BlockPermission.RequiresApproval("shell-execute")
        };
        var ctx = CreateContext(blockRules: rules);

        var result = ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "shell-execute");

        Assert.False(result.Allowed);
        Assert.Contains("requires approval", result.Error!);
    }

    [Fact]
    public void BlockRules_WildcardDeny_BlocksAll()
    {
        var rules = new List<BlockPermission>
        {
            BlockPermission.Deny("*", "sandbox mode")
        };
        var ctx = CreateContext(blockRules: rules);

        Assert.False(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "file-write").Allowed);
        Assert.False(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "shell-execute").Allowed);
        Assert.False(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "json-validator").Allowed);
    }

    [Fact]
    public void BlockRules_PatternDeny_MatchesPrefix()
    {
        var rules = new List<BlockPermission>
        {
            BlockPermission.Deny("tools/*", "no tool access")
        };
        var ctx = CreateContext(
            allowedBlocks: new List<string> { "*" },
            blockRules: rules);

        Assert.False(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "tools/git-diff").Allowed);
        Assert.False(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "tools/file-read").Allowed);
        Assert.True(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "agents/code-reviewer").Allowed);
    }

    [Fact]
    public void BlockRules_FirstMatchWins_AllowBeforeDeny()
    {
        var rules = new List<BlockPermission>
        {
            BlockPermission.Allow("file-write"),
            BlockPermission.Deny("*")
        };
        // Layer 2 needs allowedBlocks present (fail-closed). Layer 1 Allow breaks to Layer 2.
        var ctx = CreateContext(
            allowedBlocks: new List<string> { "*" },
            blockRules: rules);

        // file-write matches Allow first → falls to layer 2 → wildcard passes
        Assert.True(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "file-write").Allowed);
        // anything else matches Deny(*)
        Assert.False(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "shell-execute").Allowed);
    }

    [Fact]
    public void BlockRules_FirstMatchWins_DenyBeforeAllow()
    {
        var rules = new List<BlockPermission>
        {
            BlockPermission.Deny("file-write"),
            BlockPermission.Allow("*")
        };
        // Layer 2 needs allowedBlocks present (fail-closed). Layer 1 Allow(*) breaks to Layer 2.
        var ctx = CreateContext(
            allowedBlocks: new List<string> { "*" },
            blockRules: rules);

        // file-write matches Deny first
        Assert.False(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "file-write").Allowed);
        // everything else matches Allow(*) → falls to layer 2 → wildcard passes
        Assert.True(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "shell-execute").Allowed);
    }

    [Fact]
    public void BlockRules_NoMatchingRule_FallsToLayer2()
    {
        // Rules only deny shell-execute. file-write has no matching rule → falls to layer 2.
        // With AllowedBlocks=["*"], file-write passes.
        var rules = new List<BlockPermission>
        {
            BlockPermission.Deny("shell-execute")
        };
        var ctx = CreateContext(
            allowedBlocks: new List<string> { "*" },
            blockRules: rules);

        Assert.True(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "file-write").Allowed);
        Assert.False(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "shell-execute").Allowed);
    }

    [Fact]
    public void BlockRules_NoMatchingRule_WithoutAllowedBlocks_FailClosed()
    {
        // Rules only deny shell-execute. file-write has no matching rule → falls to layer 2.
        // Without AllowedBlocks set → fail-closed.
        var rules = new List<BlockPermission>
        {
            BlockPermission.Deny("shell-execute")
        };
        var ctx = CreateContext(blockRules: rules);

        Assert.False(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "file-write").Allowed);
    }

    [Fact]
    public void BlockRules_DenyReason_IncludedInError()
    {
        var rules = new List<BlockPermission>
        {
            BlockPermission.Deny("shell-execute", "disabled for contract testing")
        };
        var ctx = CreateContext(blockRules: rules);

        var result = ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "shell-execute");

        Assert.Contains("disabled for contract testing", result.Error!);
    }

    [Fact]
    public void BlockRules_DenyWithoutReason_DefaultMessage()
    {
        var rules = new List<BlockPermission>
        {
            BlockPermission.Deny("shell-execute")
        };
        var ctx = CreateContext(blockRules: rules);

        var result = ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "shell-execute");

        Assert.Contains("blocked by session permissions", result.Error!);
    }

    // ═══════════════════════════════════════════════════════════
    // Both layers combined — Layer 1 (rules) takes precedence
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public void BothLayers_RuleDeny_OverridesWhitelistAllow()
    {
        var rules = new List<BlockPermission>
        {
            BlockPermission.Deny("shell-execute", "explicitly blocked")
        };
        var ctx = CreateContext(
            allowedBlocks: new List<string> { "*" },  // whitelist allows all
            blockRules: rules);                        // but explicit deny on shell-execute

        var result = ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "shell-execute");

        Assert.False(result.Allowed);
        Assert.Contains("denied", result.Error!);
    }

    [Fact]
    public void BothLayers_RuleAllow_StillCheckedAgainstWhitelist()
    {
        // Rule allows file-write explicitly, but whitelist only has file-read
        var rules = new List<BlockPermission>
        {
            BlockPermission.Allow("file-write")
        };
        var ctx = CreateContext(
            allowedBlocks: new List<string> { "file-read" },  // whitelist doesn't include file-write
            blockRules: rules);

        // Rule allows → breaks out of layer 1 → layer 2 checks whitelist → denied
        var result = ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "file-write");

        Assert.False(result.Allowed);
    }

    [Fact]
    public void BothLayers_RuleAllowAndInWhitelist_Passes()
    {
        var rules = new List<BlockPermission>
        {
            BlockPermission.Allow("file-write")
        };
        var ctx = CreateContext(
            allowedBlocks: new List<string> { "file-write", "file-read" },
            blockRules: rules);

        Assert.True(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "file-write").Allowed);
    }

    // ═══════════════════════════════════════════════════════════
    // Container model: contract test scenario
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public void ContractTestScenario_OnlyMappedToolsAllowed()
    {
        // Simulates what ContractTestRunner should set:
        // Only the tools that are in _toolMapping should be in AllowedBlocks
        var ctx = CreateContext(
            allowedBlocks: new List<string>
            {
                "file-write", "file-read", "file-edit", "shell-execute", "step-complete"
            });

        // Mapped tools are allowed
        Assert.True(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "file-write").Allowed);
        Assert.True(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "file-read").Allowed);
        Assert.True(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "step-complete").Allowed);

        // Non-mapped tools are denied — this is the fix for the json-validator bug
        var jsonResult = ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "json-validator");
        Assert.False(jsonResult.Allowed);
        Assert.Contains("json-validator", jsonResult.Error!);
        Assert.Contains("not available", jsonResult.Error!);
    }

    [Fact]
    public void ContractTestScenario_DenyAllExceptMapped()
    {
        // Alternative: explicit deny-all + allow specific via block rules
        var rules = new List<BlockPermission>
        {
            BlockPermission.Allow("file-write"),
            BlockPermission.Allow("file-read"),
            BlockPermission.Allow("step-complete"),
            BlockPermission.Deny("*", "contract test sandbox")
        };
        // Layer 2 needs allowedBlocks present (fail-closed). Layer 1 Allow breaks to Layer 2.
        var ctx = CreateContext(
            allowedBlocks: new List<string> { "*" },
            blockRules: rules);

        Assert.True(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "file-write").Allowed);
        Assert.True(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "file-read").Allowed);
        Assert.True(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "step-complete").Allowed);

        var result = ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "json-validator");
        Assert.False(result.Allowed);
        Assert.Contains("contract test sandbox", result.Error!);
    }

    // ═══════════════════════════════════════════════════════════
    // Container model: child session isolation
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public void ChildSession_ReducedPermissions_EnforcedInContext()
    {
        // Parent allows all tools
        var parentCtx = CreateContext(allowedBlocks: new List<string> { "*" });
        Assert.True(ToolDispatcherBlockExecutor.CheckToolPermission(parentCtx, "shell-execute").Allowed);

        // Child has restricted set (intersection of parent)
        var childCtx = CreateContext(allowedBlocks: new List<string> { "file-read", "file-write" });
        Assert.True(ToolDispatcherBlockExecutor.CheckToolPermission(childCtx, "file-read").Allowed);
        Assert.False(ToolDispatcherBlockExecutor.CheckToolPermission(childCtx, "shell-execute").Allowed);
    }

    [Fact]
    public void ChildSession_CannotEscalatePermissions()
    {
        // Even if child context somehow has more blocks, effective permissions
        // should be the intersection (computed by GetEffectivePermissions before
        // being placed in context). This test validates the enforcement point.
        var restrictedCtx = CreateContext(allowedBlocks: new List<string> { "file-read" });

        Assert.True(ToolDispatcherBlockExecutor.CheckToolPermission(restrictedCtx, "file-read").Allowed);
        Assert.False(ToolDispatcherBlockExecutor.CheckToolPermission(restrictedCtx, "file-write").Allowed);
        Assert.False(ToolDispatcherBlockExecutor.CheckToolPermission(restrictedCtx, "shell-execute").Allowed);
    }

    // ═══════════════════════════════════════════════════════════
    // Edge cases
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public void EmptyToolId_HandleGracefully()
    {
        var ctx = CreateContext(allowedBlocks: new List<string> { "file-read" });

        // Empty string won't match any pattern
        var result = ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "");

        Assert.False(result.Allowed);
    }

    [Fact]
    public void NullBlockRules_NotCastable_SkipsRulesLayer_FailsOnMissingAllowedBlocks()
    {
        // If _permissions_blockRules is wrong type, layer 1 is skipped.
        // But layer 2 still requires _permissions_allowedBlocks → fail-closed.
        var ctx = new ExecutionContext();
        ctx.Variables["_permissions_blockRules"] = "not a list";

        var result = ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "file-write");
        Assert.False(result.Allowed);
    }

    [Fact]
    public void NullAllowedBlocks_NotCastable_FailClosed()
    {
        // If _permissions_allowedBlocks is set but wrong type → fail-closed
        var ctx = new ExecutionContext();
        ctx.Variables["_permissions_allowedBlocks"] = "not a list";

        var result = ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "file-write");
        Assert.False(result.Allowed);
        Assert.Contains("no permissions configured", result.Error!);
    }

    [Fact]
    public void NullBlockRules_WithValidAllowedBlocks_Works()
    {
        // Invalid block rules are skipped, but valid allowed blocks still work
        var ctx = new ExecutionContext();
        ctx.Variables["_permissions_blockRules"] = "not a list";
        ctx.Variables["_permissions_allowedBlocks"] = new List<string> { "file-write" };

        Assert.True(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "file-write").Allowed);
        Assert.False(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "shell-execute").Allowed);
    }

    [Fact]
    public void MultiplePatterns_MixedPermissions()
    {
        var ctx = CreateContext(allowedBlocks: new List<string>
        {
            "file-read", "file-write", "file-edit",    // individual tools
            "capture/*",                                // pattern for capture blocks
            "step-complete"
        });

        Assert.True(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "file-read").Allowed);
        Assert.True(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "capture/file-write").Allowed);
        Assert.True(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "step-complete").Allowed);
        Assert.False(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "shell-execute").Allowed);
        Assert.False(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "json-validator").Allowed);
    }

    // ═══════════════════════════════════════════════════════════
    // Integration: BuildExecutionContext propagation
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public void BuildExecutionContext_PropagatesAllowedBlocks()
    {
        // Verify that a session with ContextPermissions creates
        // a context that CheckToolPermission can enforce
        var session = ProjectSession.Create(
            "test-session",
            Authority.Human("tester"),
            new ProjectSessionConfig());

        // Standard permissions have AllowedBlocks = ["*"]
        var permissions = session.GetEffectivePermissions();
        var ctx = new ExecutionContext();
        ctx.Variables["_permissions_allowedBlocks"] = permissions.AllowedBlocks;

        // With wildcard, everything passes
        Assert.True(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "file-write").Allowed);
        Assert.True(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "shell-execute").Allowed);
    }

    [Fact]
    public void BuildExecutionContext_PropagatesBlockRules()
    {
        var session = ProjectSession.Create(
            "test-session",
            Authority.Human("tester"),
            new ProjectSessionConfig());
        session.SetBlockPermissions(new[]
        {
            BlockPermission.Deny("shell-execute", "no shell in this session"),
            BlockPermission.Allow("*")
        });

        // Simulate what BuildExecutionContext does: propagate both block rules AND allowedBlocks
        var permissions = session.GetEffectivePermissions();
        var ctx = new ExecutionContext();
        ctx.Variables["_permissions_blockRules"] = session.BlockPermissions;
        ctx.Variables["_permissions_allowedBlocks"] = permissions.AllowedBlocks;

        Assert.False(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "shell-execute").Allowed);
        Assert.True(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "file-write").Allowed);
    }

    [Fact]
    public void ChildSession_EffectivePermissions_Intersection()
    {
        // Parent: allows everything
        var parent = ProjectSession.Create(
            "parent",
            Authority.Human("tester"),
            new ProjectSessionConfig());
        // Parent has ContextPermissions.Standard which has AllowedBlocks = ["*"]

        // Child: restrict to specific tools
        var child = ProjectSession.CreateAsChild("child", parent);
        child.UpdatePermissions(new ContextPermissions
        {
            AllowedBlocks = new List<string> { "file-read", "file-write" },
            AllowedCommands = new List<string> { "*" },
            AllowedTools = new List<string> { "*" },
            AllowedPaths = new List<string> { "*" },
            DataCollections = new List<string> { "*" }
        });

        var effective = child.GetEffectivePermissions();
        var ctx = new ExecutionContext();
        ctx.Variables["_permissions_allowedBlocks"] = effective.AllowedBlocks;

        // Intersection: parent(*) ∩ child(file-read, file-write) = file-read, file-write
        Assert.True(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "file-read").Allowed);
        Assert.True(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "file-write").Allowed);
        Assert.False(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "shell-execute").Allowed);
    }
}
