using Maestro.Application.DTOs;
using Maestro.Domain.Enums;

namespace Maestro.Application.Interfaces;

public interface IApiKeyService
{
    Task<CreateKeyResponse> GenerateKeyAsync(CreateKeyRequest request);
    Task<ValidateKeyResponse> ValidateKeyAsync(string key);
    Task<IReadOnlyList<ApiKeyRecord>> ListKeysAsync();
    Task<bool> RevokeKeyAsync(string id);
    Task<bool> HasAnyKeysAsync();
}
