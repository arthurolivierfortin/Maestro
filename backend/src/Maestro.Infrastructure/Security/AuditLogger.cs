using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace Maestro.Infrastructure.Security;

public interface IAuditLogger
{
    Task LogAsync(string action, string? userId = null, string? detail = null, string? ipAddress = null);
}

public class AuditLogger : IAuditLogger
{
    private readonly string _logFilePath;
    private readonly ILogger<AuditLogger> _logger;
    private readonly SemaphoreSlim _lock = new(1, 1);

    public AuditLogger(ILogger<AuditLogger> logger)
    {
        var logsDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
            ".maestro", "logs");
        Directory.CreateDirectory(logsDir);
        _logFilePath = Path.Combine(logsDir, "audit.jsonl");
        _logger = logger;
    }

    public async Task LogAsync(string action, string? userId = null, string? detail = null, string? ipAddress = null)
    {
        var entry = new
        {
            timestamp = DateTime.UtcNow.ToString("o"),
            action,
            userId = userId ?? "anonymous",
            detail,
            ip = ipAddress
        };

        var line = JsonSerializer.Serialize(entry) + Environment.NewLine;

        await _lock.WaitAsync();
        try
        {
            await File.AppendAllTextAsync(_logFilePath, line);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to write audit log entry");
        }
        finally
        {
            _lock.Release();
        }
    }
}
