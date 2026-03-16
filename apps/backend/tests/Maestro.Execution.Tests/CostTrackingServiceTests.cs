#nullable enable

using System;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;
using Maestro.Application.DTOs;
using Maestro.Infrastructure.Pricing;
using Maestro.Infrastructure.Sessions.NodeHandlers;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Maestro.Execution.Tests;

/// <summary>
/// Tests for CostTrackingService: CheckLimitAsync (enforcement, limit types, priorities),
/// backward-compatible config parsing, and period reset detection.
/// Phase 59-PRE-2-T — Tests #1-15.
/// </summary>
public class CostTrackingServiceTests : IDisposable
{
    private readonly string _tempDir;
    private readonly string _maestroDir;
    private readonly string _originalMaestroRoot;

    public CostTrackingServiceTests()
    {
        _tempDir = Path.Combine(Path.GetTempPath(), "maestro-cost-tests-" + Guid.NewGuid().ToString("N")[..8]);
        _maestroDir = Path.Combine(_tempDir, ".maestro");
        Directory.CreateDirectory(_maestroDir);

        // Save original env var
        _originalMaestroRoot = Environment.GetEnvironmentVariable("MAESTRO_ROOT") ?? "";
        Environment.SetEnvironmentVariable("MAESTRO_ROOT", _tempDir);
    }

    public void Dispose()
    {
        // Restore original env var
        Environment.SetEnvironmentVariable("MAESTRO_ROOT", _originalMaestroRoot);

        try { Directory.Delete(_tempDir, recursive: true); }
        catch { /* best-effort cleanup */ }
    }

    private CostTrackingService CreateService()
    {
        return new CostTrackingService(NullLogger<CostTrackingService>.Instance);
    }

    private void WriteConfig(CostLimitsDto limits)
    {
        var config = new { limits };
        var json = JsonSerializer.Serialize(config, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            WriteIndented = true
        });
        File.WriteAllText(Path.Combine(_maestroDir, "cost-config.json"), json);
    }

    private void WriteHistoryEntry(CostEntryDto entry)
    {
        var line = JsonSerializer.Serialize(entry, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        });
        File.AppendAllText(Path.Combine(_maestroDir, "cost-history.jsonl"), line + "\n");
    }

    private void WriteRawConfig(string json)
    {
        File.WriteAllText(Path.Combine(_maestroDir, "cost-config.json"), json);
    }

    // ════════════════════════════════════════════════════════════════
    // #1 — CheckLimit block: session limit exceeded
    // ════════════════════════════════════════════════════════════════

    [Fact]
    public async Task CheckLimit_SessionLimitExceeded_Block()
    {
        var svc = CreateService();
        WriteConfig(new CostLimitsDto
        {
            MaxPerSession = new CostLimitConfigDto { Value = 0.01m, Enforcement = "block" }
        });

        var result = await svc.CheckLimitAsync("session-1", 0.02m);

        Assert.True(result.Exceeded);
        Assert.Equal("block", result.Enforcement);
        Assert.Equal("session", result.LimitType);
    }

    // ════════════════════════════════════════════════════════════════
    // #2 — CheckLimit block: daily limit exceeded
    // ════════════════════════════════════════════════════════════════

    [Fact]
    public async Task CheckLimit_DayLimitExceeded_Block()
    {
        var svc = CreateService();
        WriteConfig(new CostLimitsDto
        {
            MaxPerDay = new CostLimitConfigDto { Value = 0.01m, Enforcement = "block" }
        });

        // Write a cost entry for today
        WriteHistoryEntry(new CostEntryDto
        {
            SessionId = "other-session",
            BlockId = "block-1",
            ModelId = "model-1",
            ProviderId = "provider-1",
            CostUsd = 0.02m,
            Timestamp = DateTime.UtcNow
        });

        var result = await svc.CheckLimitAsync("session-1", 0m);

        Assert.True(result.Exceeded);
        Assert.Equal("block", result.Enforcement);
        Assert.Equal("daily", result.LimitType);
    }

    // ════════════════════════════════════════════════════════════════
    // #3 — CheckLimit block: weekly limit exceeded
    // ════════════════════════════════════════════════════════════════

    [Fact]
    public async Task CheckLimit_WeekLimitExceeded_Block()
    {
        var svc = CreateService();
        WriteConfig(new CostLimitsDto
        {
            MaxPerWeek = new CostLimitConfigDto { Value = 0.05m, Enforcement = "block" }
        });

        WriteHistoryEntry(new CostEntryDto
        {
            SessionId = "other-session",
            BlockId = "block-1",
            ModelId = "model-1",
            ProviderId = "provider-1",
            CostUsd = 0.06m,
            Timestamp = DateTime.UtcNow
        });

        var result = await svc.CheckLimitAsync("session-1", 0m);

        Assert.True(result.Exceeded);
        Assert.Equal("block", result.Enforcement);
        Assert.Equal("weekly", result.LimitType);
    }

    // ════════════════════════════════════════════════════════════════
    // #4 — CheckLimit block: monthly limit exceeded
    // ════════════════════════════════════════════════════════════════

    [Fact]
    public async Task CheckLimit_MonthLimitExceeded_Block()
    {
        var svc = CreateService();
        WriteConfig(new CostLimitsDto
        {
            MaxPerMonth = new CostLimitConfigDto { Value = 1.00m, Enforcement = "block" }
        });

        WriteHistoryEntry(new CostEntryDto
        {
            SessionId = "other-session",
            BlockId = "block-1",
            ModelId = "model-1",
            ProviderId = "provider-1",
            CostUsd = 1.05m,
            Timestamp = DateTime.UtcNow
        });

        var result = await svc.CheckLimitAsync("session-1", 0m);

        Assert.True(result.Exceeded);
        Assert.Equal("block", result.Enforcement);
        Assert.Equal("monthly", result.LimitType);
    }

    // ════════════════════════════════════════════════════════════════
    // #5 — CheckLimit warn: exceeded but warn enforcement
    // ════════════════════════════════════════════════════════════════

    [Fact]
    public async Task CheckLimit_DayLimitExceeded_Warn()
    {
        var svc = CreateService();
        WriteConfig(new CostLimitsDto
        {
            MaxPerDay = new CostLimitConfigDto { Value = 0.01m, Enforcement = "warn" }
        });

        WriteHistoryEntry(new CostEntryDto
        {
            SessionId = "other-session",
            BlockId = "block-1",
            ModelId = "model-1",
            ProviderId = "provider-1",
            CostUsd = 0.02m,
            Timestamp = DateTime.UtcNow
        });

        var result = await svc.CheckLimitAsync("session-1", 0m);

        Assert.True(result.Exceeded);
        Assert.Equal("warn", result.Enforcement);
    }

    // ════════════════════════════════════════════════════════════════
    // #6 — CheckLimit: under the limit
    // ════════════════════════════════════════════════════════════════

    [Fact]
    public async Task CheckLimit_UnderLimit_NotExceeded()
    {
        var svc = CreateService();
        WriteConfig(new CostLimitsDto
        {
            MaxPerDay = new CostLimitConfigDto { Value = 1.00m, Enforcement = "block" }
        });

        WriteHistoryEntry(new CostEntryDto
        {
            SessionId = "session-1",
            BlockId = "block-1",
            ModelId = "model-1",
            ProviderId = "provider-1",
            CostUsd = 0.01m,
            Timestamp = DateTime.UtcNow
        });

        var result = await svc.CheckLimitAsync("session-1", 0.01m);

        Assert.False(result.Exceeded);
    }

    // ════════════════════════════════════════════════════════════════
    // #7 — CheckLimit: no limits configured
    // ════════════════════════════════════════════════════════════════

    [Fact]
    public async Task CheckLimit_NoLimitsConfigured_NotExceeded()
    {
        var svc = CreateService();
        // No config file at all

        var result = await svc.CheckLimitAsync("session-1", 10m);

        Assert.False(result.Exceeded);
    }

    // ════════════════════════════════════════════════════════════════
    // #8 — CheckLimit: multiple limits, one exceeded block
    // ════════════════════════════════════════════════════════════════

    [Fact]
    public async Task CheckLimit_MultipleLimits_OneBlockExceeded_ReturnsBlock()
    {
        var svc = CreateService();
        WriteConfig(new CostLimitsDto
        {
            MaxPerSession = new CostLimitConfigDto { Value = 10m, Enforcement = "block" }, // NOT exceeded
            MaxPerDay = new CostLimitConfigDto { Value = 0.01m, Enforcement = "block" } // Exceeded
        });

        WriteHistoryEntry(new CostEntryDto
        {
            SessionId = "session-1",
            BlockId = "block-1",
            ModelId = "model-1",
            ProviderId = "provider-1",
            CostUsd = 0.02m,
            Timestamp = DateTime.UtcNow
        });

        var result = await svc.CheckLimitAsync("session-1", 0.005m);

        Assert.True(result.Exceeded);
        Assert.Equal("block", result.Enforcement);
        Assert.Equal("daily", result.LimitType);
    }

    // ════════════════════════════════════════════════════════════════
    // #9 — CheckLimit: block priority over warn when multiple exceeded
    // ════════════════════════════════════════════════════════════════

    [Fact]
    public async Task CheckLimit_MultipleLimits_BlockPriorityOverWarn()
    {
        var svc = CreateService();
        WriteConfig(new CostLimitsDto
        {
            MaxPerSession = new CostLimitConfigDto { Value = 0.01m, Enforcement = "warn" }, // exceeded warn
            MaxPerDay = new CostLimitConfigDto { Value = 0.01m, Enforcement = "block" } // exceeded block
        });

        WriteHistoryEntry(new CostEntryDto
        {
            SessionId = "session-1",
            BlockId = "block-1",
            ModelId = "model-1",
            ProviderId = "provider-1",
            CostUsd = 0.02m,
            Timestamp = DateTime.UtcNow
        });

        var result = await svc.CheckLimitAsync("session-1", 0.02m);

        Assert.True(result.Exceeded);
        Assert.Equal("block", result.Enforcement);
        Assert.Equal("daily", result.LimitType);
    }

    // ════════════════════════════════════════════════════════════════
    // #10 — Backward compat: old format (plain number)
    // ════════════════════════════════════════════════════════════════

    [Fact]
    public async Task BackwardCompat_OldFormatNumber_ParsesAsBlock()
    {
        var svc = CreateService();
        // Write raw JSON with old format: "maxPerDay": 5.0
        WriteRawConfig("""
        {
            "limits": {
                "maxPerDay": 5.0
            }
        }
        """);

        // Should parse as block enforcement with value 5.0
        var limits = await svc.GetLimitsAsync();

        Assert.NotNull(limits.MaxPerDay);
        Assert.Equal(5.0m, limits.MaxPerDay!.Value);
        Assert.Equal("block", limits.MaxPerDay.Enforcement);
        Assert.False(limits.MaxPerDay.AutoResume);
    }

    // ════════════════════════════════════════════════════════════════
    // #11 — Backward compat: new format (object)
    // ════════════════════════════════════════════════════════════════

    [Fact]
    public async Task BackwardCompat_NewFormatObject_ParsesCorrectly()
    {
        var svc = CreateService();
        WriteRawConfig("""
        {
            "limits": {
                "maxPerDay": { "value": 5.0, "enforcement": "warn", "autoResume": true }
            }
        }
        """);

        var limits = await svc.GetLimitsAsync();

        Assert.NotNull(limits.MaxPerDay);
        Assert.Equal(5.0m, limits.MaxPerDay!.Value);
        Assert.Equal("warn", limits.MaxPerDay.Enforcement);
        Assert.True(limits.MaxPerDay.AutoResume);
    }

    // ════════════════════════════════════════════════════════════════
    // #12 — Reset detection: new day
    // ════════════════════════════════════════════════════════════════

    [Fact]
    public void ResetDetection_NewDay_PeriodReset()
    {
        var now = new DateTime(2026, 3, 16, 10, 0, 0, DateTimeKind.Utc);
        var stoppedAt = now.AddDays(-1); // Yesterday

        Assert.True(BlockRefHandler.HasPeriodReset("daily", stoppedAt, now));
    }

    // ════════════════════════════════════════════════════════════════
    // #13 — Reset detection: same day — no reset
    // ════════════════════════════════════════════════════════════════

    [Fact]
    public void ResetDetection_SameDay_NoPeriodReset()
    {
        var now = new DateTime(2026, 3, 16, 10, 0, 0, DateTimeKind.Utc);
        var stoppedAt = new DateTime(2026, 3, 16, 3, 0, 0, DateTimeKind.Utc); // Earlier today

        Assert.False(BlockRefHandler.HasPeriodReset("daily", stoppedAt, now));
    }

    // ════════════════════════════════════════════════════════════════
    // #14 — Reset detection: new week
    // ════════════════════════════════════════════════════════════════

    [Fact]
    public void ResetDetection_NewWeek_PeriodReset()
    {
        // 2026-03-16 is a Monday. If stoppedAt is the previous Sunday, period has reset.
        var now = new DateTime(2026, 3, 16, 10, 0, 0, DateTimeKind.Utc); // Monday
        var stoppedAt = new DateTime(2026, 3, 15, 23, 0, 0, DateTimeKind.Utc); // Sunday (last week)

        Assert.True(BlockRefHandler.HasPeriodReset("weekly", stoppedAt, now));
    }

    // ════════════════════════════════════════════════════════════════
    // #15 — Reset detection: new month
    // ════════════════════════════════════════════════════════════════

    [Fact]
    public void ResetDetection_NewMonth_PeriodReset()
    {
        var now = new DateTime(2026, 4, 1, 10, 0, 0, DateTimeKind.Utc);
        var stoppedAt = new DateTime(2026, 3, 31, 23, 0, 0, DateTimeKind.Utc);

        Assert.True(BlockRefHandler.HasPeriodReset("monthly", stoppedAt, now));
    }
}
