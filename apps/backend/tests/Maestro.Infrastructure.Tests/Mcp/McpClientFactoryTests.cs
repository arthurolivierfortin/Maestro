using System;
using Maestro.Infrastructure.Mcp;

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
}
