using System.Collections.Concurrent;
using System.Text.Json;
using System.Text.Json.Serialization;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using Maestro.Domain.Enums;
using Maestro.Infrastructure.Data;
using Microsoft.Extensions.Logging;

namespace Maestro.Infrastructure.SandboxImages;

/// <summary>
/// Filesystem-based implementation of ISandboxImageRepository.
/// Combines built-in images with user-defined images stored in the data folder.
/// </summary>
public class FileSystemSandboxImageRepository : ISandboxImageRepository
{
    private readonly ConcurrentDictionary<string, SandboxImage> _userImageCache = new();
    private readonly string _dataPath;
    private readonly ILogger<FileSystemSandboxImageRepository>? _logger;
    private bool _initialized;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true,
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) }
    };

    public FileSystemSandboxImageRepository(
        string dataPath,
        ILogger<FileSystemSandboxImageRepository>? logger = null)
    {
        _dataPath = Path.Combine(dataPath, "sandbox-images", "user");
        _logger = logger;
    }

    public async Task<SandboxImage?> GetByIdAsync(string id, CancellationToken ct = default)
    {
        await EnsureInitializedAsync(ct);

        // Check built-in first
        var builtIn = BuiltInSandboxImages.GetById(id);
        if (builtIn != null) return builtIn;

        // Check user-defined
        _userImageCache.TryGetValue(id, out var userImage);
        return userImage;
    }

    public async Task<IEnumerable<SandboxImage>> GetAllAsync(
        ImageSource? source = null,
        bool? verified = null,
        IEnumerable<string>? tags = null,
        CancellationToken ct = default)
    {
        await EnsureInitializedAsync(ct);

        IEnumerable<SandboxImage> images = source switch
        {
            ImageSource.BuiltIn => BuiltInSandboxImages.GetAll(),
            ImageSource.UserDefined => _userImageCache.Values,
            _ => BuiltInSandboxImages.GetAll().Concat(_userImageCache.Values)
        };

        if (verified.HasValue)
        {
            images = images.Where(i => i.Verified == verified.Value);
        }

        if (tags != null && tags.Any())
        {
            var tagSet = new HashSet<string>(tags, StringComparer.OrdinalIgnoreCase);
            images = images.Where(i => i.Tags.Any(t => tagSet.Contains(t)));
        }

        return images.OrderBy(i => i.Source).ThenBy(i => i.Name).ToList();
    }

    public Task<IEnumerable<SandboxImage>> GetBuiltInAsync(CancellationToken ct = default)
    {
        return Task.FromResult<IEnumerable<SandboxImage>>(BuiltInSandboxImages.GetAll());
    }

    public async Task<IEnumerable<SandboxImage>> GetUserDefinedAsync(CancellationToken ct = default)
    {
        await EnsureInitializedAsync(ct);
        return _userImageCache.Values.OrderBy(i => i.Name).ToList();
    }

    public async Task SaveAsync(SandboxImage image, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(image);

        if (BuiltInSandboxImages.IsBuiltIn(image.Id))
        {
            throw new InvalidOperationException($"Cannot modify built-in sandbox image: {image.Id}");
        }

        Directory.CreateDirectory(_dataPath);
        var filePath = GetFilePath(image.Id);

        image.UpdatedAt = DateTime.UtcNow;
        var json = JsonSerializer.Serialize(image, JsonOptions);
        await File.WriteAllTextAsync(filePath, json, ct);

        _userImageCache[image.Id] = image;
        _logger?.LogInformation("Saved sandbox image: {ImageId}", image.Id);
    }

    public async Task DeleteAsync(string id, CancellationToken ct = default)
    {
        if (BuiltInSandboxImages.IsBuiltIn(id))
        {
            throw new InvalidOperationException($"Cannot delete built-in sandbox image: {id}");
        }

        var filePath = GetFilePath(id);
        if (File.Exists(filePath))
        {
            File.Delete(filePath);
        }

        _userImageCache.TryRemove(id, out _);
        _logger?.LogInformation("Deleted sandbox image: {ImageId}", id);
        await Task.CompletedTask;
    }

    public async Task<bool> ExistsAsync(string id, CancellationToken ct = default)
    {
        await EnsureInitializedAsync(ct);
        return BuiltInSandboxImages.IsBuiltIn(id) || _userImageCache.ContainsKey(id);
    }

    private async Task EnsureInitializedAsync(CancellationToken ct)
    {
        if (_initialized) return;

        if (Directory.Exists(_dataPath))
        {
            var files = Directory.GetFiles(_dataPath, "*.json");
            foreach (var file in files)
            {
                try
                {
                    var json = await File.ReadAllTextAsync(file, ct);
                    var image = JsonSerializer.Deserialize<SandboxImage>(json, JsonOptions);
                    if (image != null)
                    {
                        _userImageCache[image.Id] = image;
                    }
                }
                catch (Exception ex)
                {
                    _logger?.LogWarning(ex, "Failed to load sandbox image from {Path}", file);
                }
            }
        }

        _initialized = true;
        _logger?.LogInformation("Initialized sandbox image repository with {BuiltIn} built-in and {UserDefined} user-defined images",
            BuiltInSandboxImages.GetAll().Count, _userImageCache.Count);
    }

    private string GetFilePath(string id)
    {
        return Path.Combine(_dataPath, $"{id}.json");
    }
}
