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

    public FileSystemExecutionRepository(string folder)
    {
        _folder = folder;
        Directory.CreateDirectory(_folder);
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
}
