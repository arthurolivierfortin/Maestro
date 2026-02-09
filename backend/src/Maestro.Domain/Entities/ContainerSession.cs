using Maestro.Domain.Enums;
using Maestro.Domain.ValueObjects;

namespace Maestro.Domain.Entities;

/// <summary>
/// Abstract base class for all container-based execution contexts.
/// Provides unified container binding, permissions, and lifecycle management.
///
/// Inheritance hierarchy:
/// - ContainerSession (abstract)
///   - Workspace : ContainerSession
///   - Session : ContainerSession (abstract)
///     - ProjectSession : Session
///     - FoundrySession : Session
/// </summary>
public abstract class ContainerSession
{
    // ===== Identity =====

    /// <summary>
    /// Unique identifier for this container session.
    /// </summary>
    public string Id { get; protected set; } = string.Empty;

    /// <summary>
    /// Human-readable name.
    /// </summary>
    public string Name { get; protected set; } = string.Empty;

    /// <summary>
    /// Optional description.
    /// </summary>
    public string? Description { get; protected set; }

    // ===== Lifecycle =====

    /// <summary>
    /// Current status of the container session.
    /// </summary>
    public ContainerSessionStatus Status { get; protected set; } = ContainerSessionStatus.Created;

    /// <summary>
    /// Timestamp when the session was created.
    /// </summary>
    public DateTimeOffset CreatedAt { get; protected set; } = DateTimeOffset.UtcNow;

    /// <summary>
    /// Timestamp of the last update.
    /// </summary>
    public DateTimeOffset? UpdatedAt { get; protected set; }

    /// <summary>
    /// Identifier of the user/agent that created this session.
    /// </summary>
    public string? CreatedBy { get; protected set; }

    // ===== Permissions =====

    /// <summary>
    /// Context permissions defining what operations are allowed.
    /// Permissions are inherited and can only be restricted (never expanded) in child contexts.
    /// </summary>
    public ContextPermissions Permissions { get; protected set; } = ContextPermissions.None;

    // ===== Container Binding =====

    /// <summary>
    /// Defines how this session binds to containers and filesystem.
    /// </summary>
    public ContainerBinding Binding { get; protected set; } = ContainerBinding.None;

    // ===== Repository Binding =====

    /// <summary>
    /// Path to the bound repository. Null if the session is in sandbox mode.
    /// This is the source of truth — the Binding is derived from this.
    /// </summary>
    public string? RepositoryPath { get; protected set; }

    /// <summary>
    /// True if this session is bound to a repository.
    /// </summary>
    public bool IsBoundToRepository => RepositoryPath != null && Binding.Type == ContainerBindingType.Repository;

    /// <summary>
    /// Path to the .maestro data directory within the bound repo. Null if not bound.
    /// </summary>
    public string? MaestroDataPath => RepositoryPath != null
        ? Path.Combine(RepositoryPath, ".maestro")
        : null;

    /// <summary>
    /// Binds this session to a local repository.
    /// Must be called at creation time only (before Start).
    /// </summary>
    public void BindToRepository(
        string repositoryPath,
        RepositoryAccessLevel accessLevel = RepositoryAccessLevel.Controlled)
    {
        if (Status != ContainerSessionStatus.Created)
            throw new InvalidOperationException("Cannot bind after session has started");

        if (string.IsNullOrWhiteSpace(repositoryPath))
            throw new ArgumentException("Repository path cannot be empty", nameof(repositoryPath));

        RepositoryPath = Path.GetFullPath(repositoryPath);
        Binding = ContainerBinding.CreateRepositoryBound(RepositoryPath, accessLevel);
    }

    // ===== Session Variables =====

    /// <summary>
    /// Generic key-value store for session variables.
    /// Sessions define their own keys - no predefined variable names.
    /// This enables any session to store arbitrary state without schema changes.
    /// </summary>
    public Dictionary<string, object> Variables { get; protected set; } = new();

    // ===== Variable Methods =====

    /// <summary>
    /// Sets a variable value. Creates new or updates existing.
    /// </summary>
    /// <param name="key">The variable key.</param>
    /// <param name="value">The value to store.</param>
    public virtual void SetVariable(string key, object value)
    {
        if (string.IsNullOrWhiteSpace(key))
            throw new ArgumentException("Variable key cannot be empty", nameof(key));

        Variables[key] = value;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    /// <summary>
    /// Gets a variable value with type conversion.
    /// </summary>
    /// <typeparam name="T">The expected type of the value.</typeparam>
    /// <param name="key">The variable key.</param>
    /// <param name="defaultValue">Default value if key not found or type mismatch.</param>
    /// <returns>The value or default.</returns>
    public virtual T GetVariable<T>(string key, T defaultValue = default!)
    {
        if (Variables.TryGetValue(key, out var value))
        {
            if (value is T typed)
                return typed;

            // Try to convert if it's a compatible type
            try
            {
                return (T)Convert.ChangeType(value, typeof(T));
            }
            catch
            {
                return defaultValue;
            }
        }
        return defaultValue;
    }

    /// <summary>
    /// Gets a variable value as object.
    /// </summary>
    /// <param name="key">The variable key.</param>
    /// <returns>The value or null if not found.</returns>
    public virtual object? GetVariable(string key)
    {
        return Variables.TryGetValue(key, out var value) ? value : null;
    }

    /// <summary>
    /// Checks if a variable exists.
    /// </summary>
    /// <param name="key">The variable key.</param>
    /// <returns>True if the variable exists.</returns>
    public virtual bool HasVariable(string key)
    {
        return Variables.ContainsKey(key);
    }

    /// <summary>
    /// Removes a variable.
    /// </summary>
    /// <param name="key">The variable key.</param>
    /// <returns>True if the variable was removed.</returns>
    public virtual bool RemoveVariable(string key)
    {
        if (Variables.Remove(key))
        {
            UpdatedAt = DateTimeOffset.UtcNow;
            return true;
        }
        return false;
    }

    /// <summary>
    /// Gets all variable keys.
    /// </summary>
    /// <returns>Collection of variable keys.</returns>
    public virtual IEnumerable<string> GetVariableKeys()
    {
        return Variables.Keys;
    }

    // ===== Abstract Methods =====

    /// <summary>
    /// Returns the parent context for permission inheritance.
    /// Workspace returns null (root). Sessions return their parent workspace/session.
    /// </summary>
    public abstract ContainerSession? GetParentContext();

    /// <summary>
    /// Returns the file extension used for storage (e.g., ".workspace.json", ".session.json").
    /// </summary>
    public abstract string GetStorageExtension();

    /// <summary>
    /// Validates whether a transition to the specified status is allowed.
    /// </summary>
    /// <param name="newStatus">The target status.</param>
    /// <returns>True if the transition is valid.</returns>
    protected abstract bool CanTransitionTo(ContainerSessionStatus newStatus);

    // ===== Permission Methods =====

    /// <summary>
    /// Computes effective permissions by walking the inheritance chain.
    /// Each level can only restrict permissions, never expand them.
    ///
    /// Example chain: Workspace → Session → NestedSession
    /// Effective = Workspace.Intersect(Session).Intersect(NestedSession)
    /// </summary>
    public virtual ContextPermissions GetEffectivePermissions()
    {
        var parent = GetParentContext();
        if (parent == null)
        {
            // This is the root context (Workspace)
            return Permissions;
        }

        // Intersect with parent's effective permissions (most restrictive wins)
        var parentPermissions = parent.GetEffectivePermissions();
        return parentPermissions.Intersect(Permissions);
    }

    /// <summary>
    /// Updates permissions, ensuring they don't exceed parent's permissions.
    /// </summary>
    /// <param name="newPermissions">The requested new permissions.</param>
    public virtual void UpdatePermissions(ContextPermissions newPermissions)
    {
        ArgumentNullException.ThrowIfNull(newPermissions);

        var parent = GetParentContext();
        if (parent != null)
        {
            // Cannot exceed parent's permissions
            var maxAllowed = parent.GetEffectivePermissions();
            Permissions = maxAllowed.Intersect(newPermissions);
        }
        else
        {
            // Root context (Workspace) can have any permissions
            Permissions = newPermissions;
        }

        UpdatedAt = DateTimeOffset.UtcNow;
    }

    /// <summary>
    /// Checks if a specific command is allowed in the effective permissions.
    /// </summary>
    public bool HasCommandPermission(string command)
    {
        return GetEffectivePermissions().HasCommand(command);
    }

    /// <summary>
    /// Checks if a specific tool is allowed in the effective permissions.
    /// </summary>
    public bool HasToolPermission(string toolId)
    {
        return GetEffectivePermissions().HasTool(toolId);
    }

    /// <summary>
    /// Checks if a specific block is allowed in the effective permissions.
    /// </summary>
    public bool HasBlockPermission(string blockId)
    {
        return GetEffectivePermissions().HasBlock(blockId);
    }

    // ===== Lifecycle Methods =====

    /// <summary>
    /// Transitions to the specified status if allowed.
    /// </summary>
    /// <param name="newStatus">The target status.</param>
    /// <exception cref="InvalidOperationException">If the transition is not allowed.</exception>
    protected void TransitionTo(ContainerSessionStatus newStatus)
    {
        if (!CanTransitionTo(newStatus))
        {
            throw new InvalidOperationException(
                $"Cannot transition from {Status} to {newStatus} for {GetType().Name}");
        }

        Status = newStatus;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    /// <summary>
    /// Updates the name of this container session.
    /// </summary>
    public virtual void UpdateName(string newName)
    {
        if (string.IsNullOrWhiteSpace(newName))
            throw new ArgumentException("Name cannot be empty", nameof(newName));

        Name = newName;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    /// <summary>
    /// Updates the description of this container session.
    /// </summary>
    public virtual void UpdateDescription(string? newDescription)
    {
        Description = newDescription;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    // ===== Container Binding Methods =====

    /// <summary>
    /// Gets the Docker volume mount string if this session uses repository binding.
    /// </summary>
    public string? GetVolumeMountString()
    {
        return Binding.GetVolumeMountString();
    }

    /// <summary>
    /// Returns true if this session uses container isolation.
    /// </summary>
    public bool UsesContainerIsolation => Binding.UsesContainer;

    /// <summary>
    /// Returns true if this session has persistent storage (repository binding).
    /// </summary>
    public bool HasPersistentStorage => Binding.HasPersistentStorage;

    // ===== Utility Methods =====

    /// <summary>
    /// Returns a string representation for debugging.
    /// </summary>
    public override string ToString()
    {
        return $"{GetType().Name}[{Id}] '{Name}' ({Status})";
    }
}
