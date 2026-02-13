using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Maestro.Application.DTOs;
using Maestro.Application.Interfaces;
using Maestro.Domain.Enums;
using Microsoft.Extensions.Logging;

namespace Maestro.Infrastructure.Security;

public class ApiKeyService : IApiKeyService
{
    private readonly string _keysFilePath;
    private readonly ILogger<ApiKeyService> _logger;
    private readonly SemaphoreSlim _lock = new(1, 1);

    public ApiKeyService(ILogger<ApiKeyService> logger)
    {
        var maestroDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
            ".maestro");
        Directory.CreateDirectory(maestroDir);
        _keysFilePath = Path.Combine(maestroDir, "keys.json");
        _logger = logger;
    }

    public async Task<CreateKeyResponse> GenerateKeyAsync(CreateKeyRequest request)
    {
        await _lock.WaitAsync();
        try
        {
            var keys = await LoadKeysAsync();

            var rawKey = GenerateRawKey();
            var record = new ApiKeyRecord
            {
                Id = Guid.NewGuid().ToString("N")[..12],
                Name = request.Name,
                KeyHash = HashKey(rawKey),
                KeyPrefix = rawKey[..12],
                Scope = request.Scope,
                SessionId = request.Scope == ApiKeyScope.SessionScoped ? request.SessionId : null,
                CreatedAt = DateTime.UtcNow,
                ExpiresAt = request.ExpiresInDays.HasValue
                    ? DateTime.UtcNow.AddDays(request.ExpiresInDays.Value)
                    : null
            };

            keys.Add(record);
            await SaveKeysAsync(keys);

            _logger.LogInformation("API key created: {Name} ({Scope})", record.Name, record.Scope);

            return new CreateKeyResponse
            {
                Id = record.Id,
                Name = record.Name,
                Key = rawKey,
                Scope = record.Scope,
                CreatedAt = record.CreatedAt,
                ExpiresAt = record.ExpiresAt
            };
        }
        finally
        {
            _lock.Release();
        }
    }

    public async Task<ValidateKeyResponse> ValidateKeyAsync(string key)
    {
        if (string.IsNullOrWhiteSpace(key))
            return new ValidateKeyResponse { Valid = false };

        var hash = HashKey(key);
        var keys = await LoadKeysAsync();
        var record = keys.FirstOrDefault(k =>
            k.KeyHash == hash && !k.IsRevoked);

        if (record == null)
            return new ValidateKeyResponse { Valid = false };

        if (record.ExpiresAt.HasValue && record.ExpiresAt.Value < DateTime.UtcNow)
            return new ValidateKeyResponse { Valid = false };

        // Update last used (fire and forget, best effort)
        _ = Task.Run(async () =>
        {
            await _lock.WaitAsync();
            try
            {
                var allKeys = await LoadKeysAsync();
                var k = allKeys.FirstOrDefault(x => x.Id == record.Id);
                if (k != null)
                {
                    k.LastUsedAt = DateTime.UtcNow;
                    await SaveKeysAsync(allKeys);
                }
            }
            finally { _lock.Release(); }
        });

        return new ValidateKeyResponse
        {
            Valid = true,
            Name = record.Name,
            Scope = record.Scope,
            SessionId = record.SessionId
        };
    }

    public async Task<IReadOnlyList<ApiKeyRecord>> ListKeysAsync()
    {
        var keys = await LoadKeysAsync();
        // Return records without hashes
        return keys.Where(k => !k.IsRevoked).Select(k => new ApiKeyRecord
        {
            Id = k.Id,
            Name = k.Name,
            KeyPrefix = k.KeyPrefix,
            Scope = k.Scope,
            SessionId = k.SessionId,
            CreatedAt = k.CreatedAt,
            ExpiresAt = k.ExpiresAt,
            LastUsedAt = k.LastUsedAt,
            IsRevoked = k.IsRevoked
        }).ToList().AsReadOnly();
    }

    public async Task<bool> RevokeKeyAsync(string id)
    {
        await _lock.WaitAsync();
        try
        {
            var keys = await LoadKeysAsync();
            var key = keys.FirstOrDefault(k => k.Id == id);
            if (key == null) return false;

            key.IsRevoked = true;
            await SaveKeysAsync(keys);

            _logger.LogInformation("API key revoked: {Name} ({Id})", key.Name, key.Id);
            return true;
        }
        finally
        {
            _lock.Release();
        }
    }

    public async Task<bool> HasAnyKeysAsync()
    {
        var keys = await LoadKeysAsync();
        return keys.Any(k => !k.IsRevoked);
    }

    private static string GenerateRawKey()
    {
        var bytes = RandomNumberGenerator.GetBytes(16);
        return "mst_" + Convert.ToHexString(bytes).ToLowerInvariant();
    }

    private static string HashKey(string key)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(key));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    private async Task<List<ApiKeyRecord>> LoadKeysAsync()
    {
        if (!File.Exists(_keysFilePath))
            return new List<ApiKeyRecord>();

        var json = await File.ReadAllTextAsync(_keysFilePath);
        return JsonSerializer.Deserialize<List<ApiKeyRecord>>(json,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
            ?? new List<ApiKeyRecord>();
    }

    private async Task SaveKeysAsync(List<ApiKeyRecord> keys)
    {
        var json = JsonSerializer.Serialize(keys, new JsonSerializerOptions
        {
            WriteIndented = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        });
        await File.WriteAllTextAsync(_keysFilePath, json);
    }
}
