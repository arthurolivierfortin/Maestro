using Maestro.Domain.Enums;

namespace Maestro.Domain.ValueObjects;

/// <summary>
/// Represents the authority controlling a session.
/// </summary>
public sealed class Authority : IEquatable<Authority>
{
    /// <summary>
    /// Type of authority (Human, Agent, AI).
    /// </summary>
    public AuthorityType Type { get; }

    /// <summary>
    /// Identifier for the authority.
    /// For Human: username or "anonymous"
    /// For Agent: agent ID (e.g., "orchestrator-agent")
    /// For AI: AI system name (e.g., "claude-code", "cursor")
    /// </summary>
    public string Identifier { get; }

    /// <summary>
    /// Display name for the authority.
    /// </summary>
    public string DisplayName { get; }

    /// <summary>
    /// Additional metadata about the authority.
    /// </summary>
    public IReadOnlyDictionary<string, object> Metadata { get; }

    private Authority(AuthorityType type, string identifier, string? displayName = null, IDictionary<string, object>? metadata = null)
    {
        Type = type;
        Identifier = identifier ?? throw new ArgumentNullException(nameof(identifier));
        DisplayName = displayName ?? identifier;
        Metadata = metadata != null
            ? new Dictionary<string, object>(metadata)
            : new Dictionary<string, object>();
    }

    /// <summary>
    /// Creates a human authority.
    /// </summary>
    public static Authority Human(string? username = null)
    {
        return new Authority(AuthorityType.Human, username ?? "anonymous", username ?? "Human");
    }

    /// <summary>
    /// Creates an agent authority.
    /// </summary>
    public static Authority Agent(string agentId, string? displayName = null)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(agentId);
        return new Authority(AuthorityType.Agent, agentId, displayName ?? agentId);
    }

    /// <summary>
    /// Creates an AI authority.
    /// </summary>
    public static Authority AI(string aiName, string? displayName = null, IDictionary<string, object>? metadata = null)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(aiName);
        return new Authority(AuthorityType.AI, aiName, displayName ?? aiName, metadata);
    }

    /// <summary>
    /// Parses an authority string like "human", "agent:orchestrator", "ai:claude-code".
    /// </summary>
    public static Authority Parse(string authorityString)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(authorityString);

        var parts = authorityString.Split(':', 2);
        var type = parts[0].ToLowerInvariant();
        var identifier = parts.Length > 1 ? parts[1] : null;

        return type switch
        {
            "human" => Human(identifier),
            "agent" => Agent(identifier ?? throw new ArgumentException("Agent authority requires an identifier")),
            "ai" => AI(identifier ?? throw new ArgumentException("AI authority requires an identifier")),
            _ => throw new ArgumentException($"Unknown authority type: {type}")
        };
    }

    /// <summary>
    /// Returns the string representation: "human", "agent:id", "ai:name".
    /// </summary>
    public override string ToString()
    {
        return Type switch
        {
            AuthorityType.Human when Identifier == "anonymous" => "human",
            AuthorityType.Human => $"human:{Identifier}",
            AuthorityType.Agent => $"agent:{Identifier}",
            AuthorityType.AI => $"ai:{Identifier}",
            _ => $"{Type.ToString().ToLowerInvariant()}:{Identifier}"
        };
    }

    public bool Equals(Authority? other)
    {
        if (other is null) return false;
        if (ReferenceEquals(this, other)) return true;
        return Type == other.Type && Identifier == other.Identifier;
    }

    public override bool Equals(object? obj) => Equals(obj as Authority);

    public override int GetHashCode() => HashCode.Combine(Type, Identifier);

    public static bool operator ==(Authority? left, Authority? right) =>
        left is null ? right is null : left.Equals(right);

    public static bool operator !=(Authority? left, Authority? right) => !(left == right);
}
