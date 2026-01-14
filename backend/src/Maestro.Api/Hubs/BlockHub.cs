using Microsoft.AspNetCore.SignalR;

namespace Maestro.Api.Hubs
{
    public class BlockHub : Hub<IBlockClient>
    {
        // Methods/Groups can be added later. For now, hub acts as a channel for block events.
    }
}
