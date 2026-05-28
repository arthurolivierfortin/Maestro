using System.Collections.Generic;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using Maestro.Infrastructure.BlockExecutors;
using Moq;

namespace Maestro.Infrastructure.Tests.BlockExecutors;

public class MemoryBlockExecutorTests
{
    private static MemoryBlockExecutor Build(out Mock<IMemoryProvider> mock)
    {
        mock = new Mock<IMemoryProvider>();
        return new MemoryBlockExecutor(mock.Object);
    }

    private static BlockDefinition Block() =>
        BlockDefinition.Create("memory-test", "Memory Test", "memory");

    private static ExecutionContext Ctx() => new();

    [Fact]
    public async Task CreateStore_RoutesToCreateStoreAsync()
    {
        var executor = Build(out var mock);
        mock.Setup(m => m.CreateStoreAsync("s1", "Store 1", "general", null, null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new MemoryStore { Id = "s1", Name = "Store 1", Category = "general" });

        var inputs = new Dictionary<string, object>
        {
            ["operation"] = "create-store",
            ["storeId"] = "s1",
            ["name"] = "Store 1",
            ["category"] = "general"
        };

        var result = await executor.ExecuteAsync(Block(), Ctx(), inputs);

        Assert.True(result.Success);
        mock.Verify(m => m.CreateStoreAsync("s1", "Store 1", "general", null, null, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task AddEntry_RoutesToAddEntryAsync()
    {
        var executor = Build(out var mock);
        mock.Setup(m => m.AddEntryAsync("s1", It.IsAny<MemoryEntry>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var inputs = new Dictionary<string, object>
        {
            ["operation"] = "add-entry",
            ["storeId"] = "s1",
            ["key"] = "k1",
            ["content"] = "value"
        };

        var result = await executor.ExecuteAsync(Block(), Ctx(), inputs);

        Assert.True(result.Success);
        mock.Verify(m => m.AddEntryAsync("s1", It.Is<MemoryEntry>(e => e.Key == "k1" && e.Content == "value"),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Search_RoutesToSearchAsync()
    {
        var executor = Build(out var mock);
        mock.Setup(m => m.SearchAsync("hello", null, 20, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<(string, MemoryEntry)>());

        var inputs = new Dictionary<string, object>
        {
            ["operation"] = "search",
            ["query"] = "hello"
        };

        var result = await executor.ExecuteAsync(Block(), Ctx(), inputs);

        Assert.True(result.Success);
        mock.Verify(m => m.SearchAsync("hello", null, 20, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task GetRelevant_RoutesToGetRelevantEntriesAsync()
    {
        var executor = Build(out var mock);
        mock.Setup(m => m.GetRelevantEntriesAsync(null, null, null, 10, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<MemoryEntry>());

        var inputs = new Dictionary<string, object>
        {
            ["operation"] = "get-relevant"
        };

        var result = await executor.ExecuteAsync(Block(), Ctx(), inputs);

        Assert.True(result.Success);
        mock.Verify(m => m.GetRelevantEntriesAsync(null, null, null, 10, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task RemoveEntry_RoutesToRemoveEntryAsync()
    {
        var executor = Build(out var mock);
        mock.Setup(m => m.RemoveEntryAsync("s1", "k1", It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

        var inputs = new Dictionary<string, object>
        {
            ["operation"] = "remove-entry",
            ["storeId"] = "s1",
            ["key"] = "k1"
        };

        var result = await executor.ExecuteAsync(Block(), Ctx(), inputs);

        Assert.True(result.Success);
        mock.Verify(m => m.RemoveEntryAsync("s1", "k1", It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task DeleteStore_RoutesToDeleteStoreAsync()
    {
        var executor = Build(out var mock);
        mock.Setup(m => m.DeleteStoreAsync("s1", It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

        var inputs = new Dictionary<string, object>
        {
            ["operation"] = "delete-store",
            ["storeId"] = "s1"
        };

        var result = await executor.ExecuteAsync(Block(), Ctx(), inputs);

        Assert.True(result.Success);
        mock.Verify(m => m.DeleteStoreAsync("s1", It.IsAny<CancellationToken>()), Times.Once);
    }
}
