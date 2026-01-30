using System.Collections.Concurrent;
using System.Threading.Channels;
using Maestro.Domain.ValueObjects;

namespace Maestro.Infrastructure.Sessions;

/// <summary>
/// Singleton storage for session contexts and event channels.
/// This allows the Scoped ProjectSessionServer to persist context across requests.
/// </summary>
public class SessionContextStorage
{
    private readonly ConcurrentDictionary<string, ProjectSessionContext> _sessionContexts = new();
    private readonly ConcurrentDictionary<string, Channel<SessionEvent>> _eventChannels = new();

    public bool TryGetContext(string sessionId, out ProjectSessionContext? context)
    {
        return _sessionContexts.TryGetValue(sessionId, out context);
    }

    public void SetContext(string sessionId, ProjectSessionContext context)
    {
        _sessionContexts[sessionId] = context;
    }

    public bool RemoveContext(string sessionId)
    {
        return _sessionContexts.TryRemove(sessionId, out _);
    }

    public Channel<SessionEvent> GetOrCreateEventChannel(string sessionId)
    {
        return _eventChannels.GetOrAdd(sessionId, _ => Channel.CreateUnbounded<SessionEvent>());
    }

    public bool TryGetEventChannel(string sessionId, out Channel<SessionEvent>? channel)
    {
        return _eventChannels.TryGetValue(sessionId, out channel);
    }

    public bool RemoveEventChannel(string sessionId)
    {
        return _eventChannels.TryRemove(sessionId, out _);
    }
}
