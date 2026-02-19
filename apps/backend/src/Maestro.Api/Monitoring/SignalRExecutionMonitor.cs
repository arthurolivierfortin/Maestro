using Maestro.Application.Interfaces;
using Maestro.Domain.ValueObjects;
using Maestro.Api.Hubs;
using Microsoft.AspNetCore.SignalR;
using System.Threading;
using System.Threading.Tasks;

namespace Maestro.Api.Monitoring
{
    public class SignalRExecutionMonitor : IExecutionMonitor
    {
        private readonly IHubContext<ExecutionHub, IExecutionClient> _hub;

        public SignalRExecutionMonitor(IHubContext<ExecutionHub, IExecutionClient> hub)
        {
            _hub = hub;
        }

        public Task PublishExecutionStartedAsync(ExecutionId executionId, CancellationToken cancellationToken = default)
            => _hub.Clients.All.ExecutionStarted(executionId.Value.ToString());

        public Task PublishNodeStartedAsync(NodeId nodeId, CancellationToken cancellationToken = default)
            => _hub.Clients.All.BlockStarted("unknown", nodeId.Value.ToString());

        public Task PublishNodeCompletedAsync(NodeId nodeId, CancellationToken cancellationToken = default)
            => _hub.Clients.All.BlockCompleted("unknown", nodeId.Value.ToString());

        public Task PublishNodeFailedAsync(NodeId nodeId, string error, CancellationToken cancellationToken = default)
            => _hub.Clients.All.BlockFailed("unknown", nodeId.Value.ToString(), error);

        public Task PublishExecutionCompletedAsync(ExecutionId executionId, CancellationToken cancellationToken = default)
            => _hub.Clients.All.ExecutionCompleted(executionId.Value.ToString());

        public Task PublishExecutionFailedAsync(ExecutionId executionId, string error, CancellationToken cancellationToken = default)
            => _hub.Clients.All.ExecutionFailed(executionId.Value.ToString(), error);

        public Task PublishLogAddedAsync(ExecutionId executionId, string logLine, CancellationToken cancellationToken = default)
            => _hub.Clients.All.LogAdded(executionId.Value.ToString(), logLine);

        public Task PublishTerminalOutputAsync(string output, CancellationToken cancellationToken = default)
            => _hub.Clients.All.LogAdded("unknown", output);
    }
}
