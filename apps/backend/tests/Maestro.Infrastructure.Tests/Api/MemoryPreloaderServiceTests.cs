using System.Collections.Generic;
using Maestro.Api.Configuration;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace Maestro.Infrastructure.Tests.Api;

public class MemoryPreloaderServiceTests
{
    [Fact]
    public async Task MemoryPreloaderService_StartAsync_ListsStores()
    {
        var prov = new Mock<IMemoryProvider>();
        prov.Setup(p => p.ListStoresAsync(null, null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<MemoryStore> { new() { Id = "s1", Name = "Store", Category = "general" } });

        var svc = new MemoryPreloaderService(prov.Object, NullLogger<MemoryPreloaderService>.Instance);
        await svc.StartAsync(CancellationToken.None);

        prov.Verify(p => p.ListStoresAsync(null, null, It.IsAny<CancellationToken>()), Times.Once);
    }
}
