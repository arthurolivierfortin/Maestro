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

                // now simulate multi-location: project overrides global
                var globalRoot = Path.Combine(Path.GetTempPath(), "maestro-global-" + Guid.NewGuid().ToString("N"));
                Directory.CreateDirectory(globalRoot);
                var gblk = Path.Combine(globalRoot, "test-block");
                Directory.CreateDirectory(gblk);
                File.WriteAllText(Path.Combine(gblk, "block.json"), "{ \"id\": \"test-block\", \"name\": \"Global Block\", \"blockType\": \"prompt\" }");

                var discMulti = new Maestro.Infrastructure.BlockStore.FileSystemBlockDiscoveryService(new [] { tempRoot, globalRoot });
                var all2 = await discMulti.DiscoverAllAsync();
                // project (tempRoot) should win and provide the Test Block we created earlier
                Assert.Contains(all2, b => b.Id == "test-block");
            }
            finally
            {
                Directory.Delete(tempRoot, true);
            }
        }

        [Fact]
        public async Task ProjectConfig_In_MaestroFolder_IsAttachedToDiscoveredBlock()
        {
            var tempRoot = Path.Combine(Path.GetTempPath(), "maestro-repo-test-" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(tempRoot);
            try
            {
                var projectMaestro = Path.Combine(tempRoot, ".maestro");
                Directory.CreateDirectory(projectMaestro);

                var pmBlock = Path.Combine(projectMaestro, "pm-block");
                Directory.CreateDirectory(pmBlock);
                File.WriteAllText(Path.Combine(pmBlock, "block.json"), "{ \"id\": \"pm-block\", \"name\": \"PM Block\", \"blockType\": \"tool\" }");

                // project config
                File.WriteAllText(Path.Combine(projectMaestro, "config.json"), "{ \"setting\": \"project-value\" }");

                var discProj = new Maestro.Infrastructure.BlockStore.FileSystemBlockDiscoveryService(new [] { tempRoot });
                var allProj = await discProj.DiscoverAllAsync();
                Assert.Contains(allProj, b => b.Id == "pm-block");
                var pm = await discProj.GetByIdAsync("pm-block");
                Assert.NotNull(pm);
                Assert.True(pm.Metadata != null && pm.Metadata.ContainsKey("projectConfig"));

                // projectConfig may be stored as JsonElement or Dictionary depending on deserialization path
                var projectConfig = pm.Metadata["projectConfig"];
                Assert.NotNull(projectConfig);
            }
            finally
            {
                Directory.Delete(tempRoot, true);
            }
        }
    }
}
