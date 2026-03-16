using System.Globalization;
using System.Text.Json;
using Maestro.Application.DTOs;
using Maestro.Application.Interfaces;
using Microsoft.Extensions.Logging;

namespace Maestro.Infrastructure.Pricing;

/// <summary>
/// Tracks LLM costs via append-only JSONL file and JSON config for limits/overrides.
/// Thread-safe for concurrent appends via lock.
/// </summary>
public class CostTrackingService : ICostTrackingService
{
    private readonly string _maestroDir;
    private readonly ILogger<CostTrackingService>? _logger;
    private readonly object _writeLock = new();

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false
    };

    private static readonly JsonSerializerOptions JsonOptsPretty = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true
    };

    private string HistoryPath => Path.Combine(_maestroDir, "cost-history.jsonl");
    private string ConfigPath => Path.Combine(_maestroDir, "cost-config.json");

    public CostTrackingService(ILogger<CostTrackingService>? logger = null)
    {
        var root = Environment.GetEnvironmentVariable("MAESTRO_ROOT")
                   ?? Directory.GetCurrentDirectory();
        _maestroDir = Path.Combine(root, ".maestro");
        _logger = logger;
    }

    public Task RecordCostAsync(CostEntryDto entry)
    {
        try
        {
            EnsureDirectory();
            var line = JsonSerializer.Serialize(entry, JsonOpts);
            lock (_writeLock)
            {
                File.AppendAllText(HistoryPath, line + "\n");
            }
        }
        catch (Exception ex)
        {
            _logger?.LogWarning(ex, "Failed to record cost entry");
        }
        return Task.CompletedTask;
    }

    public Task<CostSummaryDto> GetSummaryAsync()
    {
        var entries = ReadAllEntries();
        var now = DateTime.UtcNow;
        var startOfDay = now.Date;
        var startOfWeek = now.Date.AddDays(-(int)now.DayOfWeek);
        var startOfMonth = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);

        var summary = new CostSummaryDto
        {
            Today = Aggregate(entries, startOfDay),
            ThisWeek = Aggregate(entries, startOfWeek),
            ThisMonth = Aggregate(entries, startOfMonth),
            AllTime = Aggregate(entries, DateTime.MinValue),
            ByProvider = GroupBy(entries, e => e.ProviderId),
            ByModel = GroupBy(entries, e => e.ModelId)
        };

        var limits = ReadLimitsFromConfig();
        summary.Limits = limits;

        return Task.FromResult(summary);
    }

    public Task<List<CostEntryDto>> GetSessionCostsAsync(string sessionId)
    {
        var entries = ReadAllEntries()
            .Where(e => string.Equals(e.SessionId, sessionId, StringComparison.OrdinalIgnoreCase))
            .OrderBy(e => e.Timestamp)
            .ToList();
        return Task.FromResult(entries);
    }

    public Task<CostLimitsDto> GetLimitsAsync()
    {
        var limits = ReadLimitsFromConfig();
        return Task.FromResult(limits);
    }

    public Task SetLimitsAsync(CostLimitsDto limits)
    {
        var config = ReadConfig();
        config.Limits = limits;
        WriteConfig(config);
        return Task.CompletedTask;
    }

    public Task<CostLimitCheckResult> CheckLimitAsync(string sessionId, decimal currentSessionCost)
    {
        var limits = ReadLimitsFromConfig();

        // Check session limit
        if (limits.MaxPerSession.HasValue && currentSessionCost > limits.MaxPerSession.Value)
        {
            return Task.FromResult(new CostLimitCheckResult
            {
                Exceeded = true,
                LimitType = "session",
                CurrentValue = currentSessionCost,
                MaxValue = limits.MaxPerSession.Value
            });
        }

        // For day/week/month limits, read history
        var entries = ReadAllEntries();
        var now = DateTime.UtcNow;

        // Daily limit
        if (limits.MaxPerDay.HasValue)
        {
            var dayCost = entries.Where(e => e.Timestamp >= now.Date).Sum(e => e.CostUsd);
            if (dayCost > limits.MaxPerDay.Value)
            {
                return Task.FromResult(new CostLimitCheckResult
                {
                    Exceeded = true,
                    LimitType = "daily",
                    CurrentValue = dayCost,
                    MaxValue = limits.MaxPerDay.Value
                });
            }
        }

        // Weekly limit
        if (limits.MaxPerWeek.HasValue)
        {
            var startOfWeek = now.Date.AddDays(-(int)now.DayOfWeek);
            var weekCost = entries.Where(e => e.Timestamp >= startOfWeek).Sum(e => e.CostUsd);
            if (weekCost > limits.MaxPerWeek.Value)
            {
                return Task.FromResult(new CostLimitCheckResult
                {
                    Exceeded = true,
                    LimitType = "weekly",
                    CurrentValue = weekCost,
                    MaxValue = limits.MaxPerWeek.Value
                });
            }
        }

        // Monthly limit
        if (limits.MaxPerMonth.HasValue)
        {
            var startOfMonth = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
            var monthCost = entries.Where(e => e.Timestamp >= startOfMonth).Sum(e => e.CostUsd);
            if (monthCost > limits.MaxPerMonth.Value)
            {
                return Task.FromResult(new CostLimitCheckResult
                {
                    Exceeded = true,
                    LimitType = "monthly",
                    CurrentValue = monthCost,
                    MaxValue = limits.MaxPerMonth.Value
                });
            }
        }

        return Task.FromResult(CostLimitCheckResult.Ok());
    }

    // ===== Pricing overrides (used by ModelPricingService) =====

    /// <summary>
    /// Read pricing overrides from cost-config.json.
    /// Returns empty dict if no overrides configured.
    /// </summary>
    public Dictionary<string, CostOverrideEntry> GetPricingOverrides()
    {
        var config = ReadConfig();
        return config.CostOverrides ?? new Dictionary<string, CostOverrideEntry>();
    }

    // ===== Private helpers =====

    private List<CostEntryDto> ReadAllEntries()
    {
        var result = new List<CostEntryDto>();
        if (!File.Exists(HistoryPath))
            return result;

        try
        {
            string[] lines;
            lock (_writeLock)
            {
                lines = File.ReadAllLines(HistoryPath);
            }
            foreach (var line in lines)
            {
                if (string.IsNullOrWhiteSpace(line)) continue;
                try
                {
                    var entry = JsonSerializer.Deserialize<CostEntryDto>(line, JsonOpts);
                    if (entry != null)
                        result.Add(entry);
                }
                catch
                {
                    // Skip malformed lines
                }
            }
        }
        catch (Exception ex)
        {
            _logger?.LogWarning(ex, "Failed to read cost history from {Path}", HistoryPath);
        }
        return result;
    }

    private static CostPeriodDto Aggregate(List<CostEntryDto> entries, DateTime since)
    {
        var filtered = entries.Where(e => e.Timestamp >= since).ToList();
        return new CostPeriodDto
        {
            TotalCost = filtered.Sum(e => e.CostUsd),
            TotalTokens = filtered.Sum(e => e.PromptTokens + e.CompletionTokens),
            RequestCount = filtered.Count
        };
    }

    private static Dictionary<string, CostBreakdownDto> GroupBy(
        List<CostEntryDto> entries,
        Func<CostEntryDto, string> keySelector)
    {
        return entries
            .GroupBy(keySelector)
            .Where(g => !string.IsNullOrEmpty(g.Key))
            .ToDictionary(
                g => g.Key,
                g => new CostBreakdownDto
                {
                    TotalCost = g.Sum(e => e.CostUsd),
                    TotalTokens = g.Sum(e => e.PromptTokens + e.CompletionTokens)
                });
    }

    private CostLimitsDto ReadLimitsFromConfig()
    {
        var config = ReadConfig();
        return config.Limits ?? new CostLimitsDto();
    }

    private CostConfigFile ReadConfig()
    {
        if (!File.Exists(ConfigPath))
            return new CostConfigFile();
        try
        {
            var json = File.ReadAllText(ConfigPath);
            return JsonSerializer.Deserialize<CostConfigFile>(json, JsonOpts) ?? new CostConfigFile();
        }
        catch (Exception ex)
        {
            _logger?.LogWarning(ex, "Failed to read cost config from {Path}", ConfigPath);
            return new CostConfigFile();
        }
    }

    private void WriteConfig(CostConfigFile config)
    {
        try
        {
            EnsureDirectory();
            var json = JsonSerializer.Serialize(config, JsonOptsPretty);
            File.WriteAllText(ConfigPath, json);
        }
        catch (Exception ex)
        {
            _logger?.LogWarning(ex, "Failed to write cost config to {Path}", ConfigPath);
        }
    }

    private void EnsureDirectory()
    {
        if (!Directory.Exists(_maestroDir))
            Directory.CreateDirectory(_maestroDir);
    }
}

/// <summary>
/// Internal model for .maestro/cost-config.json file.
/// </summary>
internal class CostConfigFile
{
    public CostLimitsDto? Limits { get; set; }
    public Dictionary<string, CostOverrideEntry>? CostOverrides { get; set; }
}

/// <summary>
/// A pricing override entry for a specific model.
/// </summary>
public class CostOverrideEntry
{
    public decimal InputPricePerMillion { get; set; }
    public decimal OutputPricePerMillion { get; set; }
}
