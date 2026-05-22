using Maestro.Application.Interfaces;
using Maestro.Infrastructure.Memory;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace Maestro.Infrastructure.Tests.Api;

public class MemoryProviderDIRegistrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public MemoryProviderDIRegistrationTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact]
    public void MemoryProvider_DI_ResolvesAsFileSystemProvider()
    {
        using var scope = _factory.Services.CreateScope();
        var provider = scope.ServiceProvider.GetRequiredService<IMemoryProvider>();
        Assert.NotNull(provider);
        Assert.IsType<FileSystemMemoryProvider>(provider);
    }
}
