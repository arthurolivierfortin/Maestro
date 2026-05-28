using System;
using System.IO;
using Maestro.Domain.Entities;
using Maestro.Infrastructure.Memory;

namespace Maestro.Infrastructure.Tests.Memory;

public class FileSystemMemoryProviderTests : IDisposable
{
    private readonly string _tempDir;

    public FileSystemMemoryProviderTests()
    {
        _tempDir = Path.Combine(Path.GetTempPath(), $"memprov-{Guid.NewGuid()}");
        Directory.CreateDirectory(_tempDir);
    }

    public void Dispose()
    {
        if (Directory.Exists(_tempDir)) Directory.Delete(_tempDir, true);
    }

    [Fact]
    public async Task FileSystemMemoryProvider_RoundTrip_PreservesBehavior()
    {
        var provider = new FileSystemMemoryProvider(_tempDir);
        var store = await provider.CreateStoreAsync("s1", "Store 1", "general");
        Assert.Equal("s1", store.Id);

        var entry = new MemoryEntry
        {
            Key = "k1",
            Content = "hello world",
            Confidence = 0.9,
            Tags = new() { "test" },
            CreatedAt = DateTimeOffset.UtcNow,
            LastUsedAt = DateTimeOffset.UtcNow
        };
        await provider.AddEntryAsync("s1", entry);

        // Reload via fresh instance — verifies on-disk JSON round-trip
        var fresh = new FileSystemMemoryProvider(_tempDir);
        var entries = await fresh.GetEntriesAsync("s1");
        Assert.Single(entries);
        Assert.Equal("k1", entries[0].Key);
        Assert.Equal("hello world", entries[0].Content);

        // Touch + relevance
        await fresh.TouchEntryAsync("s1", "k1");
        var relevant = await fresh.GetRelevantEntriesAsync(maxEntries: 5);
        Assert.Single(relevant);
        Assert.Equal("k1", relevant[0].Key);

        await fresh.RemoveEntryAsync("s1", "k1");
        var afterRemove = await fresh.GetEntriesAsync("s1");
        Assert.Empty(afterRemove);

        await fresh.DeleteStoreAsync("s1");
        var afterDelete = await fresh.GetStoreAsync("s1");
        Assert.Null(afterDelete);
    }
}
