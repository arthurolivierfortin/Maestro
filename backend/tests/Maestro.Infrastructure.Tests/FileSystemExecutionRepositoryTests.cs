using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Maestro.Infrastructure.Persistence;
using Maestro.Domain.ValueObjects;
using Xunit;

namespace Maestro.Infrastructure.Tests
{
    public class FileSystemExecutionRepositoryTests : IDisposable
    {
        private readonly string _temp;
        public FileSystemExecutionRepositoryTests()
        {
            _temp = Path.Combine(Path.GetTempPath(), "maestro_test_execrepo", Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(_temp);
        }

        public void Dispose()
        {
            try { Directory.Delete(_temp, true); } catch { }
        }

        [Fact]
        public async Task Save_and_Query_and_Log_workflow()
        {
            var repo = new FileSystemExecutionRepository(_temp);

            var id = Maestro.Domain.ValueObjects.ExecutionId.New();
            var ctx = Maestro.Domain.Entities.ExecutionContext.Create("wf1");
            ctx.Id = id;
            ctx.LogInfo("start");
            await repo.SaveAsync(ctx);

            // query by workflow
            var results = await repo.QueryAsync(workflowId: "wf1");
            Assert.True(results.Any());

            // append a log line
            await repo.SaveLogAsync(id, "line1");
            var logFile = Path.Combine(_temp, "logs", id.ToString() + ".log");
            Assert.True(File.Exists(logFile));
            var lines = await File.ReadAllLinesAsync(logFile);
            Assert.Contains("line1", lines);
        }
    }
}
