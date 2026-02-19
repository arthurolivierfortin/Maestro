using System;
using System.IO;
using System.Threading.Tasks;
using Maestro.Application.Interfaces;
using Maestro.Infrastructure.BlockStore;
using Moq;
using Xunit;

namespace Maestro.Infrastructure.Tests
{
    public class FileSystemBlockRepositoryPublisherTests : IDisposable
    {
        private readonly string _tempDir;

        public FileSystemBlockRepositoryPublisherTests()
        {
            _tempDir = Path.Combine(Path.GetTempPath(), "maestro-tests-" + Guid.NewGuid().ToString("n"));
            Directory.CreateDirectory(_tempDir);
        }

        public void Dispose()
        {
            try
            {
                if (Directory.Exists(_tempDir)) Directory.Delete(_tempDir, true);
            }
            catch { }
        }

        [Fact]
        public async Task SaveAsync_PublishesBlockUpdated()
        {
            var mockPublisher = new Mock<IBlockChangePublisher>();
            var repo = new FileSystemBlockRepository(_tempDir, mockPublisher.Object);

            var block = Maestro.Domain.Entities.BlockDefinition.Create("test-block", "Test Block", "prompt");

            await repo.SaveAsync(block);

            mockPublisher.Verify(p => p.PublishBlockUpdatedAsync(It.Is<object>(o => o != null)), Times.Once);
        }

        [Fact]
        public async Task DeleteAsync_PublishesBlockDeleted()
        {
            var mockPublisher = new Mock<IBlockChangePublisher>();
            var repo = new FileSystemBlockRepository(_tempDir, mockPublisher.Object);

            var block = Maestro.Domain.Entities.BlockDefinition.Create("test-block-delete", "Test Block", "tool");

            await repo.SaveAsync(block);
            await repo.DeleteAsync(block.Id);

            mockPublisher.Verify(p => p.PublishBlockDeletedAsync(block.Id), Times.Once);
        }
    }
}
