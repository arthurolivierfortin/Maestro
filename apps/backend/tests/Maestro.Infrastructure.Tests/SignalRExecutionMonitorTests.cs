using System.Threading.Tasks;
using Maestro.Infrastructure.Monitoring;
using Maestro.Api.Hubs;
using Microsoft.AspNetCore.SignalR;
using Moq;
using Xunit;
using Maestro.Domain.ValueObjects;

namespace Maestro.Infrastructure.Tests
{
    public class SignalRExecutionMonitorTests
    {
        [Fact]
        public async Task PublishExecutionStarted_CallsHubClient()
        {
            var mockClient = new Mock<IExecutionClient>();
            var mockClients = new Mock<IHubClients<IExecutionClient>>();
            mockClients.Setup(c => c.All).Returns(mockClient.Object);

            var mockContext = new Mock<IHubContext<ExecutionHub, IExecutionClient>>();
            mockContext.SetupGet(c => c.Clients).Returns(mockClients.Object);

            var monitor = new SignalRExecutionMonitor(mockContext.Object);
            var execId = ExecutionId.NewId();
            await monitor.PublishExecutionStartedAsync(execId);

            mockClient.Verify(c => c.ExecutionStarted(execId.Value), Times.Once);
        }
    }
}
