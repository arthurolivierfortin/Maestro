using System.Threading.Tasks;
using Maestro.Application.Interfaces;
using Maestro.Api.Hubs;
using Microsoft.AspNetCore.SignalR;

namespace Maestro.Api.Services
{
    public class SignalRBlockChangePublisher : IBlockChangePublisher
    {
        private readonly IHubContext<BlockHub, IBlockClient> _hubContext;

        public SignalRBlockChangePublisher(IHubContext<BlockHub, IBlockClient> hubContext)
        {
            _hubContext = hubContext;
        }

        public Task PublishBlockAddedAsync(object block)
        {
            return _hubContext.Clients.All.BlockAdded(block);
        }

        public Task PublishBlockDeletedAsync(string id)
        {
            return _hubContext.Clients.All.BlockDeleted(id);
        }

        public Task PublishBlockUpdatedAsync(object block)
        {
            return _hubContext.Clients.All.BlockUpdated(block);
        }
    }
}
