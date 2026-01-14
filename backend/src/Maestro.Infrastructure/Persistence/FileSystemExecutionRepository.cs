using System;
using System.IO;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using ExecutionContext = Maestro.Domain.Entities.ExecutionContext;
using Maestro.Domain.ValueObjects;

namespace Maestro.Infrastructure.Persistence;

public class FileSystemExecutionRepository : IExecutionRepository
{
    private readonly string _folder;
    private readonly string _logFolder;

    public FileSystemExecutionRepository(string folder)
    {
        _folder = folder;
        Directory.CreateDirectory(_folder);
        _logFolder = Path.Combine(_folder, "logs");
        Directory.CreateDirectory(_logFolder);
    }

    public async Task SaveAsync(ExecutionContext context, CancellationToken ct = default)
    {
        var file = Path.Combine(_folder, context.Id.ToString() + ".json");
        var options = new JsonSerializerOptions { WriteIndented = true };
        var text = JsonSerializer.Serialize(context, options);
        await File.WriteAllTextAsync(file, text, ct);
    }

    public async Task<ExecutionContext?> GetByIdAsync(ExecutionId id, CancellationToken ct = default)
    {
        var file = Path.Combine(_folder, id.ToString() + ".json");
        if (!File.Exists(file)) return null;
        var text = await File.ReadAllTextAsync(file, ct);
        return JsonSerializer.Deserialize<ExecutionContext>(text);
    }

    public async Task<IEnumerable<ExecutionContext>> QueryAsync(string? workflowId = null, string? status = null, DateTimeOffset? from = null, DateTimeOffset? to = null, CancellationToken ct = default)
    {
        var results = new List<ExecutionContext>();
        foreach (var f in Directory.EnumerateFiles(_folder, "*.json"))
        {
            try
            {
                var text = await File.ReadAllTextAsync(f, ct);
                var ctx = JsonSerializer.Deserialize<ExecutionContext>(text);
                if (ctx == null) continue;
                if (workflowId != null && ctx.WorkflowId != workflowId) continue;
                if (status != null && ctx.Status != status) continue;
                if (from != null && ctx.StartedAt < from) continue;
                if (to != null && ctx.StartedAt > to) continue;
                results.Add(ctx);
            }
            catch { /* ignore corrupt files */ }
        }

        return results;
    }

    public async Task SaveLogAsync(ExecutionId id, string logLine, CancellationToken ct = default)
    {
        var file = Path.Combine(_logFolder, id.ToString() + ".log");
        await File.AppendAllTextAsync(file, logLine + Environment.NewLine, ct);
    }
}
