namespace Maestro.Domain.Entities;

/// <summary>
/// Per-session registry of available blocks.
/// Controls which blocks are available to the authority and sub-agents.
/// </summary>
public class SessionBlockRegistry
{
    private readonly HashSet<string> _availableBlocks = new();
    private readonly Dictionary<string, HashSet<string>> _agentRestrictedBlocks = new();

    /// <summary>
    /// All blocks available in this session.
    /// </summary>
    public IReadOnlySet<string> AvailableBlocks => _availableBlocks;

    /// <summary>
    /// Blocks restricted to specific agents (agent ID -> allowed block IDs).
    /// </summary>
    public IReadOnlyDictionary<string, IReadOnlySet<string>> AgentRestrictedBlocks =>
        _agentRestrictedBlocks.ToDictionary(
            kvp => kvp.Key,
            kvp => (IReadOnlySet<string>)kvp.Value);

    /// <summary>
    /// Creates a new empty registry.
    /// </summary>
    public static SessionBlockRegistry Empty() => new();

    /// <summary>
    /// Creates a registry from a list of block IDs.
    /// </summary>
    public static SessionBlockRegistry From(IEnumerable<string> blockIds)
    {
        var registry = new SessionBlockRegistry();
        foreach (var id in blockIds)
        {
            registry.Add(id);
        }
        return registry;
    }

    /// <summary>
    /// Adds a block to the available blocks.
    /// </summary>
    public void Add(string blockId)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(blockId);
        _availableBlocks.Add(blockId);
    }

    /// <summary>
    /// Adds multiple blocks to the available blocks.
    /// </summary>
    public void AddRange(IEnumerable<string> blockIds)
    {
        foreach (var id in blockIds)
        {
            Add(id);
        }
    }

    /// <summary>
    /// Removes a block from the available blocks.
    /// Also removes it from any agent restrictions.
    /// </summary>
    public bool Remove(string blockId)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(blockId);

        // Remove from agent restrictions as well
        foreach (var agentBlocks in _agentRestrictedBlocks.Values)
        {
            agentBlocks.Remove(blockId);
        }

        return _availableBlocks.Remove(blockId);
    }

    /// <summary>
    /// Checks if a block is available in this session.
    /// </summary>
    public bool Contains(string blockId) => _availableBlocks.Contains(blockId);

    /// <summary>
    /// Sets the blocks that a specific agent can use.
    /// </summary>
    public void SetAgentBlocks(string agentId, IEnumerable<string> blockIds)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(agentId);

        var allowedBlocks = new HashSet<string>();
        foreach (var blockId in blockIds)
        {
            if (_availableBlocks.Contains(blockId))
            {
                allowedBlocks.Add(blockId);
            }
        }

        _agentRestrictedBlocks[agentId] = allowedBlocks;
    }

    /// <summary>
    /// Adds blocks to an agent's allowed list.
    /// </summary>
    public void AddAgentBlocks(string agentId, IEnumerable<string> blockIds)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(agentId);

        if (!_agentRestrictedBlocks.TryGetValue(agentId, out var allowedBlocks))
        {
            allowedBlocks = new HashSet<string>();
            _agentRestrictedBlocks[agentId] = allowedBlocks;
        }

        foreach (var blockId in blockIds)
        {
            if (_availableBlocks.Contains(blockId))
            {
                allowedBlocks.Add(blockId);
            }
        }
    }

    /// <summary>
    /// Removes blocks from an agent's allowed list.
    /// </summary>
    public void RemoveAgentBlocks(string agentId, IEnumerable<string> blockIds)
    {
        if (!_agentRestrictedBlocks.TryGetValue(agentId, out var allowedBlocks))
            return;

        foreach (var blockId in blockIds)
        {
            allowedBlocks.Remove(blockId);
        }
    }

    /// <summary>
    /// Clears all restrictions for an agent (gives them access to all available blocks).
    /// </summary>
    public void ClearAgentRestrictions(string agentId)
    {
        _agentRestrictedBlocks.Remove(agentId);
    }

    /// <summary>
    /// Gets the blocks available to a specific agent.
    /// If no restrictions are set, returns all available blocks.
    /// </summary>
    public IReadOnlySet<string> GetBlocksForAgent(string agentId)
    {
        if (_agentRestrictedBlocks.TryGetValue(agentId, out var restrictedBlocks))
        {
            return restrictedBlocks;
        }

        // No restrictions - agent has access to all available blocks
        return _availableBlocks;
    }

    /// <summary>
    /// Checks if an agent can use a specific block.
    /// </summary>
    public bool CanAgentUseBlock(string agentId, string blockId)
    {
        if (!_availableBlocks.Contains(blockId))
            return false;

        if (_agentRestrictedBlocks.TryGetValue(agentId, out var restrictedBlocks))
        {
            return restrictedBlocks.Contains(blockId);
        }

        // No restrictions - agent can use any available block
        return true;
    }

    /// <summary>
    /// Returns the count of available blocks.
    /// </summary>
    public int Count => _availableBlocks.Count;
}
