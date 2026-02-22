namespace Maestro.Domain.Entities;

/// <summary>
/// A persistent memory store containing knowledge entries organized by category.
/// Memories persist across sessions and can be shared between agents.
/// </summary>
public class MemoryStore
{
    /// <summary>
    /// Unique identifier for this memory store (e.g., "agent-implement-step-memory").
    /// </summary>
    public string Id { get; set; } = "";

    /// <summary>
    /// Human-readable name.
    /// </summary>
    public string Name { get; set; } = "";

    /// <summary>
    /// Category for organizing memories (e.g., "coding-patterns", "project-context").
    /// </summary>
    public string Category { get; set; } = "";

    /// <summary>
    /// Optional: scope to a specific block ID. Empty means global.
    /// </summary>
    public string? BlockId { get; set; }

    /// <summary>
    /// Optional: scope to a specific session ID. Empty means cross-session.
    /// </summary>
    public string? SessionId { get; set; }

    /// <summary>
    /// The memory entries in this store.
    /// </summary>
    public List<MemoryEntry> Entries { get; set; } = new();

    /// <summary>
    /// When this store was created.
    /// </summary>
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    /// <summary>
    /// When this store was last modified.
    /// </summary>
    public DateTimeOffset LastModifiedAt { get; set; } = DateTimeOffset.UtcNow;
}

/// <summary>
/// A single knowledge entry in a memory store.
/// </summary>
public class MemoryEntry
{
    /// <summary>
    /// Unique key within the store.
    /// </summary>
    public string Key { get; set; } = "";

    /// <summary>
    /// The knowledge content.
    /// </summary>
    public string Content { get; set; } = "";

    /// <summary>
    /// Confidence score (0.0 to 1.0). Higher means more reliable.
    /// </summary>
    public double Confidence { get; set; } = 0.5;

    /// <summary>
    /// Source of this knowledge (e.g., session ID, user input).
    /// </summary>
    public string? Source { get; set; }

    /// <summary>
    /// Tags for filtering and search.
    /// </summary>
    public List<string> Tags { get; set; } = new();

    /// <summary>
    /// When this entry was created.
    /// </summary>
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    /// <summary>
    /// When this entry was last accessed.
    /// </summary>
    public DateTimeOffset LastUsedAt { get; set; } = DateTimeOffset.UtcNow;

    /// <summary>
    /// Number of times this entry has been used.
    /// </summary>
    public int UseCount { get; set; }
}
