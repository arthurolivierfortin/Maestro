using System;
using System.IO;
using System.Threading.Tasks;
using Xunit;

namespace Maestro.Infrastructure.Tests
{
    public class RepositoryDiscoveryIntegrationTests
    {
        [Fact]
        public async Task SaveAndDiscover_Block_IsDiscoverable()
        {
            var tempRoot = Path.Combine(Path.GetTempPath(), "maestro-repo-test-" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(tempRoot);
            try
            {
                // create a block folder
                var blk = Path.Combine(tempRoot, "test-block");
                Directory.CreateDirectory(blk);
                File.WriteAllText(Path.Combine(blk, "block.json"), "{ \"id\": \"test-block\", \"name\": \"Test Block\", \"blockType\": \"prompt\" }");

                var repo = new Maestro.Infrastructure.BlockStore.FileSystemBlockRepository(tempRoot);
                var disc = new Maestro.Infrastructure.BlockStore.FileSystemBlockDiscoveryService(new [] { tempRoot });

                // discovery
                var all = await disc.DiscoverAllAsync();
                Assert.Contains(all, b => b.Id == "test-block");

                // repository get
                var byId = await repo.GetByIdAsync("test-block");
                Assert.NotNull(byId);
            }
            finally
            {
                Directory.Delete(tempRoot, true);
            }
        }
    }
}
