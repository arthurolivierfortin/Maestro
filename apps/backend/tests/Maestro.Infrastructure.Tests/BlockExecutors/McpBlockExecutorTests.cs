using System;
using System.Collections.Generic;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using Maestro.Infrastructure.BlockExecutors;
using Maestro.Infrastructure.Mcp;
using Moq;

namespace Maestro.Infrastructure.Tests.BlockExecutors;

public class McpBlockExecutorTests
{
    private static McpBlockExecutor Build(out Mock<IMcpClientFactory> mockFactory, IMcpClientWrapper? wrapper = null)
    {
        mockFactory = new Mock<IMcpClientFactory>();
        if (wrapper != null)
        {
            mockFactory
                .Setup(f => f.GetOrCreateClientAsync(
                    It.IsAny<string>(), It.IsAny<string[]>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(wrapper);
        }
        return new McpBlockExecutor(mockFactory.Object);
    }

    private static BlockDefinition McpBlock(string command = "npx", string[]? args = null)
    {
        var block = BlockDefinition.Create("mcp-test", "MCP Test", "mcp-server");
        var config = new Dictionary<string, object>
        {
            ["command"] = command,
            ["args"] = args ?? new[] { "-y", "@modelcontextprotocol/server-filesystem", "/data" },
            ["transport"] = "stdio"
        };
        block.UpdateConfig(config);
        return block;
    }

    private static ExecutionContext Ctx() => new();

    [Fact]
    public void SupportedType_IsMcpServer()
    {
        var executor = Build(out _);
        Assert.Equal("mcp-server", executor.SupportedType);
    }

    [Fact]
    public async Task ListTools_ReturnsToolsFromMcpClient()
    {
        var mockWrapper = new Mock<IMcpClientWrapper>();
        mockWrapper.Setup(w => w.ListToolsAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<McpToolInfo>
            {
                new("read_file", "Read a file"),
                new("write_file", "Write a file")
            });

        var executor = Build(out _, mockWrapper.Object);

        var inputs = new Dictionary<string, object>
        {
            ["operation"] = "list-tools"
        };

        var result = await executor.ExecuteAsync(McpBlock(), Ctx(), inputs);

        Assert.True(result.Success);
        Assert.True(result.Outputs.ContainsKey("tools"));
        var tools = result.Outputs["tools"] as IList<Dictionary<string, object?>>;
        Assert.NotNull(tools);
        Assert.Equal(2, tools.Count);
        Assert.Equal("read_file", tools[0]["name"]);
        Assert.Equal("Read a file", tools[0]["description"]);
        Assert.Equal(2, result.Outputs["count"]);
    }
}
