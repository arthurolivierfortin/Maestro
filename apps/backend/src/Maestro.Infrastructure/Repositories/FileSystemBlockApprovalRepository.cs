using System.Collections.Concurrent;
using System.Text.Json;
using System.Text.Json.Serialization;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using Maestro.Infrastructure.Configuration;
using Microsoft.Extensions.Logging;

namespace Maestro.Infrastructure.Repositories;

/// <summary>
/// Filesystem-based repository for pending block approvals.
/// Approvals are stored in {data-path}/pending-approvals/{approval-id}.json
/// </summary>
public class FileSystemBlockApprovalRepository : IBlockApprovalRepository
{
    private readonly ConcurrentDictionary<string, PendingBlockApproval> _cache = new();
    private readonly string _approvalsPath;
    private readonly ILogger<FileSystemBlockApprovalRepository>? _logger;
    private bool _loaded = false;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true,
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) }
    };

    public FileSystemBlockApprovalRepository(
        MaestroConfiguration config,
        ILogger<FileSystemBlockApprovalRepository>? logger = null)
    {
        _approvalsPath = Path.Combine(config.DataPath, "pending-approvals");
        _logger = logger;
        Directory.CreateDirectory(_approvalsPath);
    }

    public async Task<PendingBlockApproval?> GetByIdAsync(string id, CancellationToken ct = default)
    {
        await EnsureLoadedAsync(ct);

        if (_cache.TryGetValue(id, out var cached))
        {
            return cached;
        }

        return null;
    }

    public async Task<IEnumerable<PendingBlockApproval>> GetPendingAsync(CancellationToken ct = default)
    {
        await EnsureLoadedAsync(ct);

        return _cache.Values
            .Where(a => a.Status == ApprovalStatus.Pending)
            .OrderByDescending(a => a.SubmittedAt)
            .ToList();
    }

    public async Task<IEnumerable<PendingBlockApproval>> GetAllAsync(
        ApprovalStatus? status = null,
        string? sessionId = null,
        int? limit = null,
        CancellationToken ct = default)
    {
        await EnsureLoadedAsync(ct);

        var query = _cache.Values.AsEnumerable();

        if (status.HasValue)
        {
            query = query.Where(a => a.Status == status.Value);
        }

        if (!string.IsNullOrEmpty(sessionId))
        {
            query = query.Where(a => a.SourceSessionId == sessionId);
        }

        query = query.OrderByDescending(a => a.SubmittedAt);

        if (limit.HasValue)
        {
            query = query.Take(limit.Value);
        }

        return query.ToList();
    }

    public async Task SaveAsync(PendingBlockApproval approval, CancellationToken ct = default)
    {
        var path = GetApprovalPath(approval.Id);
        var json = SerializeApproval(approval);
        await File.WriteAllTextAsync(path, json, ct);

        _cache[approval.Id] = approval;
        _logger?.LogDebug("Saved approval {ApprovalId}", approval.Id);
    }

    public async Task DeleteAsync(string id, CancellationToken ct = default)
    {
        var path = GetApprovalPath(id);
        if (File.Exists(path))
        {
            File.Delete(path);
        }

        _cache.TryRemove(id, out _);
        _logger?.LogDebug("Deleted approval {ApprovalId}", id);
        await Task.CompletedTask;
    }

    private async Task EnsureLoadedAsync(CancellationToken ct)
    {
        if (_loaded) return;

        var files = Directory.GetFiles(_approvalsPath, "*.json");
        foreach (var file in files)
        {
            try
            {
                var json = await File.ReadAllTextAsync(file, ct);
                var approval = DeserializeApproval(json);
                if (approval != null)
                {
                    _cache[approval.Id] = approval;
                }
            }
            catch (Exception ex)
            {
                _logger?.LogWarning(ex, "Failed to load approval from {Path}", file);
            }
        }

        _loaded = true;
        _logger?.LogInformation("Loaded {Count} pending approvals", _cache.Count);
    }

    private string GetApprovalPath(string id) => Path.Combine(_approvalsPath, $"{id}.json");

    private static string SerializeApproval(PendingBlockApproval approval)
    {
        var dto = new ApprovalJsonDto
        {
            Id = approval.Id,
            BlockId = approval.BlockId,
            BlockName = approval.BlockName,
            BlockType = approval.BlockType,
            SourceSessionId = approval.SourceSessionId,
            Status = approval.Status.ToString().ToLowerInvariant(),
            RejectionReason = approval.RejectionReason,
            Metadata = approval.Metadata.Count > 0 ? new Dictionary<string, object>(approval.Metadata) : null,
            SubmittedAt = approval.SubmittedAt,
            SubmittedBy = approval.SubmittedBy,
            ReviewedAt = approval.ReviewedAt,
            ReviewedBy = approval.ReviewedBy
            // Note: BlockDefinition is not serialized to keep files small
        };

        return JsonSerializer.Serialize(dto, JsonOptions);
    }

    private static PendingBlockApproval? DeserializeApproval(string json)
    {
        var dto = JsonSerializer.Deserialize<ApprovalJsonDto>(json, JsonOptions);
        if (dto == null) return null;

        var status = Enum.Parse<ApprovalStatus>(dto.Status, ignoreCase: true);

        return PendingBlockApproval.Reconstitute(
            id: dto.Id,
            blockId: dto.BlockId,
            blockName: dto.BlockName,
            blockType: dto.BlockType,
            blockDefinition: null, // Not stored
            sourceSessionId: dto.SourceSessionId,
            status: status,
            rejectionReason: dto.RejectionReason,
            metadata: dto.Metadata ?? new Dictionary<string, object>(),
            submittedAt: dto.SubmittedAt,
            submittedBy: dto.SubmittedBy,
            reviewedAt: dto.ReviewedAt,
            reviewedBy: dto.ReviewedBy);
    }

    private class ApprovalJsonDto
    {
        public string Id { get; set; } = string.Empty;
        public string BlockId { get; set; } = string.Empty;
        public string BlockName { get; set; } = string.Empty;
        public string BlockType { get; set; } = string.Empty;
        public string? SourceSessionId { get; set; }
        public string Status { get; set; } = "pending";
        public string? RejectionReason { get; set; }
        public Dictionary<string, object>? Metadata { get; set; }
        public DateTimeOffset SubmittedAt { get; set; }
        public string? SubmittedBy { get; set; }
        public DateTimeOffset? ReviewedAt { get; set; }
        public string? ReviewedBy { get; set; }
    }
}
