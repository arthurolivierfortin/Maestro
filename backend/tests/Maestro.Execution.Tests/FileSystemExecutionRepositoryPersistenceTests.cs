using System.IO;
using System.Threading.Tasks;
using Maestro.Infrastructure.Persistence;
using Maestro.Domain.Entities;
using Xunit;

namespace Maestro.Execution.Tests
{
    public class FileSystemExecutionRepositoryPersistenceTests
    {
        [Fact]
        public async Task SaveAndLoadExecution_Works()
        {
            var tmp = Path.Combine(Path.GetTempPath(), "maestro_test_execs", System.Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(tmp);

            var repo = new FileSystemExecutionRepository(tmp);

            var ctx = ExecutionContext.Create("wf-test");
            ctx.LogInfo("start");

            await repo.SaveAsync(ctx);

            var loaded = await repo.GetByIdAsync(ctx.Id);
            Assert.NotNull(loaded);
            Assert.Equal(ctx.WorkflowId, loaded.WorkflowId);
            Assert.Contains(loaded.Logs, l => l.Message.Contains("start"));

            // cleanup
            try { Directory.Delete(tmp, true); } catch { }
        }
    }
}
