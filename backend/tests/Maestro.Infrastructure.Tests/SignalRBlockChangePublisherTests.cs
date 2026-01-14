using System.Threading.Tasks;
using Maestro.Api.Hubs;
using Maestro.Api.Services;
using Maestro.Application.Interfaces;
using Microsoft.AspNetCore.SignalR;
using Moq;
using Xunit;

namespace Maestro.Infrastructure.Tests
{
    public class SignalRBlockChangePublisherTests
    {
        [Fact]
        public async Task PublishBlockAddedAsync_CallsHubClient()
        {
            var mockClients = new Mock<IHubClients<IBlockClient>>();
            var mockClientProxy = new Mock<IBlockClient>();
            mockClients.Setup(c => c.All).Returns(mockClientProxy.Object);

            var mockContext = new Mock<IHubContext<BlockHub, IBlockClient>>();
            mockContext.SetupGet(c => c.Clients).Returns(mockClients.Object);

            var publisher = new SignalRBlockChangePublisher(mockContext.Object);

            var payload = new { id = "x" };

            await publisher.PublishBlockAddedAsync(payload);

            mockClientProxy.Verify(c => c.BlockAdded(It.Is<object>(o => o == payload)), Times.Once);
        }

        [Fact]
        public async Task PublishBlockDeletedAsync_CallsHubClient()
        {
            var mockClients = new Mock<IHubClients<IBlockClient>>();
            var mockClientProxy = new Mock<IBlockClient>();
            mockClients.Setup(c => c.All).Returns(mockClientProxy.Object);

            var mockContext = new Mock<IHubContext<BlockHub, IBlockClient>>();
            mockContext.SetupGet(c => c.Clients).Returns(mockClients.Object);

            var publisher = new SignalRBlockChangePublisher(mockContext.Object);

            await publisher.PublishBlockDeletedAsync("id-1");

            mockClientProxy.Verify(c => c.BlockDeleted("id-1"), Times.Once);
        }
    }
}
