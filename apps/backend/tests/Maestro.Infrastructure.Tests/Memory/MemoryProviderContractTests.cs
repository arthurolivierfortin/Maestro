using System.Linq;
using System.Reflection;
using Maestro.Application.Interfaces;

namespace Maestro.Infrastructure.Tests.Memory;

public class MemoryProviderContractTests
{
    [Fact]
    public void IMemoryProvider_ExposesTenMethods()
    {
        var iface = typeof(IMemoryProvider);
        var expected = new[]
        {
            "CreateStoreAsync", "GetStoreAsync", "ListStoresAsync",
            "AddEntryAsync", "GetEntriesAsync", "SearchAsync",
            "RemoveEntryAsync", "DeleteStoreAsync", "TouchEntryAsync",
            "GetRelevantEntriesAsync"
        };
        var actual = iface.GetMethods(BindingFlags.Public | BindingFlags.Instance)
            .Select(m => m.Name).OrderBy(n => n).ToArray();
        Assert.Equal(expected.OrderBy(n => n).ToArray(), actual);
    }
}
