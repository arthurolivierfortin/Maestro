using Maestro.Domain.Enums;

namespace Maestro.Application.DTOs;

public class ApiKeyRecord
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string KeyHash { get; set; } = string.Empty;
    public string KeyPrefix { get; set; } = string.Empty;
    public ApiKeyScope Scope { get; set; } = ApiKeyScope.Human;
    public string? SessionId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ExpiresAt { get; set; }
    public DateTime? LastUsedAt { get; set; }
    public bool IsRevoked { get; set; }
}

public class CreateKeyRequest
{
    public string Name { get; set; } = string.Empty;
    public ApiKeyScope Scope { get; set; } = ApiKeyScope.Human;
    public string? SessionId { get; set; }
    public int? ExpiresInDays { get; set; }
}

public class CreateKeyResponse
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Key { get; set; } = string.Empty;
    public ApiKeyScope Scope { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? ExpiresAt { get; set; }
}

public class ValidateKeyResponse
{
    public bool Valid { get; set; }
    public string? Name { get; set; }
    public ApiKeyScope? Scope { get; set; }
    public string? SessionId { get; set; }
}

public class AuthStatusResponse
{
    public bool Enabled { get; set; }
    public bool HasKeys { get; set; }
    public bool NeedsSetup { get; set; }
}

public class SetupRequest
{
    public string Name { get; set; } = "admin";
}

public class SetupResponse
{
    public string Key { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
}
