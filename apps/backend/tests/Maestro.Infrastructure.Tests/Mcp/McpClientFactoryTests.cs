using System;
using System.Collections.Generic;
using Maestro.Infrastructure.Mcp;
using Moq;

namespace Maestro.Infrastructure.Tests.Mcp;

public class McpClientFactoryTests
{
    [Fact]
    public void IMcpClientFactory_InterfaceExists_AndIsIAsyncDisposable()
    {
        var factoryType = typeof(IMcpClientFactory);
        Assert.True(factoryType.IsInterface);
        Assert.True(typeof(IAsyncDisposable).IsAssignableFrom(factoryType));
    }

    [Fact]
    public void IMcpClientWrapper_InterfaceExists_AndIsIAsyncDisposable()
    {
        var wrapperType = typeof(IMcpClientWrapper);
        Assert.True(wrapperType.IsInterface);
        Assert.True(typeof(IAsyncDisposable).IsAssignableFrom(wrapperType));
    }

    [Fact]
    public void McpToolInfo_HasExpectedProperties()
    {
        var info = new McpToolInfo("test-tool", "A test tool");
        Assert.Equal("test-tool", info.Name);
        Assert.Equal("A test tool", info.Description);
    }

    [Fact]
    public void McpToolCallResult_HasExpectedProperties()
    {
        var result = new McpToolCallResult(false, "success content");
        Assert.False(result.IsError);
        Assert.Equal("success content", result.Content);
    }

    [Fact]
    public async Task GetOrCreateClientAsync_SameConfig_ReturnsCachedClient()
    {
        var mockWrapper = new Mock<IMcpClientWrapper>();
        int callCount = 0;
        var factory = new McpClientFactory((cmd, args, wd, ct) =>
        {
            callCount++;
            return Task.FromResult(mockWrapper.Object);
        });

        var client1 = await factory.GetOrCreateClientAsync("node", new[] { "server.js" });
        var client2 = await factory.GetOrCreateClientAsync("node", new[] { "server.js" });

        Assert.Same(client1, client2);
        Assert.Equal(1, callCount);
    }

    [Fact]
    public async Task GetOrCreateClientAsync_DifferentConfig_ReturnsDifferentClients()
    {
        var wrapper1 = new Mock<IMcpClientWrapper>();
        var wrapper2 = new Mock<IMcpClientWrapper>();
        int callCount = 0;
        var factory = new McpClientFactory((cmd, args, wd, ct) =>
        {
            callCount++;
            return Task.FromResult(callCount == 1 ? wrapper1.Object : wrapper2.Object);
        });

        var client1 = await factory.GetOrCreateClientAsync("node", new[] { "server1.js" });
        var client2 = await factory.GetOrCreateClientAsync("python", new[] { "server2.py" });

        Assert.NotSame(client1, client2);
        Assert.Equal(2, callCount);
    }

    [Fact]
    public async Task DisposeAsync_DisposesAllCachedClients()
    {
        var wrapper1 = new Mock<IMcpClientWrapper>();
        var wrapper2 = new Mock<IMcpClientWrapper>();
        wrapper1.Setup(w => w.DisposeAsync()).Returns(ValueTask.CompletedTask);
        wrapper2.Setup(w => w.DisposeAsync()).Returns(ValueTask.CompletedTask);

        int callCount = 0;
        var factory = new McpClientFactory((cmd, args, wd, ct) =>
        {
            callCount++;
            return Task.FromResult(callCount == 1 ? wrapper1.Object : wrapper2.Object);
        });

        await factory.GetOrCreateClientAsync("cmd1", new[] { "a" });
        await factory.GetOrCreateClientAsync("cmd2", new[] { "b" });

        await factory.DisposeAsync();

        wrapper1.Verify(w => w.DisposeAsync(), Times.Once);
        wrapper2.Verify(w => w.DisposeAsync(), Times.Once);
    }
}
