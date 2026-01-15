using System;
using System.IO;
using System.Threading.Tasks;
using Xunit;

namespace Maestro.Infrastructure.LocalTests
{
    public class RepositoryDiscoveryProjectConfigTests
    {
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
