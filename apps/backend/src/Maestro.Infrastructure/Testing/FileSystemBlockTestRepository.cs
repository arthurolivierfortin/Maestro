using System.Collections.Concurrent;
using System.Text.Json;
using Maestro.Domain.Entities;
using Microsoft.Extensions.Logging;

namespace Maestro.Infrastructure.Testing;

/// <summary>
/// File system-based repository for block test runs with in-memory caching.
/// </summary>
public class FileSystemBlockTestRepository
{
    private readonly string _testsPath;
    private readonly ILogger<FileSystemBlockTestRepository>? _logger;
    private readonly JsonSerializerOptions _jsonOptions;
    private readonly ConcurrentDictionary<string, BlockTestRun> _cache = new();
    private bool _loaded = false;

    public FileSystemBlockTestRepository(string basePath, ILogger<FileSystemBlockTestRepository>? logger = null)
    {
        _testsPath = Path.Combine(basePath, "tests");
        _logger = logger;
        _jsonOptions = new JsonSerializerOptions
        {
            WriteIndented = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };

        Directory.CreateDirectory(_testsPath);
        LoadAllSync();
    }

    private void LoadAllSync()
    {
        if (_loaded) return;

        try
        {
            if (Directory.Exists(_testsPath))
            {
                foreach (var file in Directory.GetFiles(_testsPath, "*.test.json"))
                {
                    try
                    {
                        var json = File.ReadAllText(file);
                        var run = JsonSerializer.Deserialize<BlockTestRun>(json, _jsonOptions);
                        if (run != null)
                        {
                            _cache[run.Id] = run;
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger?.LogWarning(ex, "Failed to load test run from {File}", file);
                    }
                }
                _logger?.LogInformation("Loaded {Count} test runs from disk", _cache.Count);
            }
        }
        catch (Exception ex)
        {
            _logger?.LogError(ex, "Failed to load test runs");
        }

        _loaded = true;
    }

    public ConcurrentDictionary<string, BlockTestRun> GetAll() => _cache;

    public BlockTestRun? GetById(string id)
    {
        _cache.TryGetValue(id, out var run);
        return run;
    }

    public void Save(BlockTestRun run)
    {
        _cache[run.Id] = run;

        try
        {
            var filePath = GetFilePath(run.Id);
            var json = JsonSerializer.Serialize(run, _jsonOptions);
            File.WriteAllText(filePath, json);
            _logger?.LogDebug("Saved test run {Id} to {Path}", run.Id, filePath);
        }
        catch (Exception ex)
        {
            _logger?.LogError(ex, "Failed to save test run {Id}", run.Id);
        }
    }

    public bool Delete(string id)
    {
        var removed = _cache.TryRemove(id, out _);

        if (removed)
        {
            try
            {
                var filePath = GetFilePath(id);
                if (File.Exists(filePath))
                {
                    File.Delete(filePath);
                    _logger?.LogDebug("Deleted test run {Id}", id);
                }
            }
            catch (Exception ex)
            {
                _logger?.LogError(ex, "Failed to delete test run file {Id}", id);
            }
        }

        return removed;
    }

    private string GetFilePath(string id)
    {
        return Path.Combine(_testsPath, $"{id}.test.json");
    }
}
