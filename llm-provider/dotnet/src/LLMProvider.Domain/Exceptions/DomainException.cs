namespace LLMProvider.Domain.Exceptions;

/// <summary>
/// Base exception for all domain-level exceptions.
/// </summary>
public class DomainException : Exception
{
    /// <summary>
    /// Creates a new DomainException.
    /// </summary>
    /// <param name="message">The error message.</param>
    public DomainException(string message) : base(message)
    {
    }

    /// <summary>
    /// Creates a new DomainException with an inner exception.
    /// </summary>
    /// <param name="message">The error message.</param>
    /// <param name="innerException">The inner exception.</param>
    public DomainException(string message, Exception innerException) : base(message, innerException)
    {
    }
}

/// <summary>
/// Exception thrown when an entity is not found.
/// </summary>
public class EntityNotFoundException : DomainException
{
    /// <summary>
    /// The type of entity that was not found.
    /// </summary>
    public string EntityType { get; }

    /// <summary>
    /// The identifier that was used to search for the entity.
    /// </summary>
    public object Identifier { get; }

    /// <summary>
    /// Creates a new EntityNotFoundException.
    /// </summary>
    /// <param name="entityType">The type of entity.</param>
    /// <param name="identifier">The identifier used to search.</param>
    public EntityNotFoundException(string entityType, object identifier)
        : base($"{entityType} with identifier '{identifier}' was not found.")
    {
        EntityType = entityType;
        Identifier = identifier;
    }
}

/// <summary>
/// Exception thrown when a conversation is not found.
/// </summary>
public class ConversationNotFoundException : EntityNotFoundException
{
    /// <summary>
    /// Creates a new ConversationNotFoundException.
    /// </summary>
    /// <param name="conversationId">The conversation ID that was not found.</param>
    public ConversationNotFoundException(LLMProvider.Domain.ValueObjects.ConversationId conversationId)
        : base("Conversation", conversationId.Value)
    {
    }
}

/// <summary>
/// Exception thrown when a model is not found.
/// </summary>
public class ModelNotFoundException : EntityNotFoundException
{
    /// <summary>
    /// Creates a new ModelNotFoundException.
    /// </summary>
    /// <param name="modelId">The model ID that was not found.</param>
    public ModelNotFoundException(LLMProvider.Domain.ValueObjects.ModelId modelId)
        : base("Model", modelId.Value)
    {
    }
}

/// <summary>
/// Exception thrown when a domain invariant is violated.
/// </summary>
public class DomainInvariantViolationException : DomainException
{
    /// <summary>
    /// Creates a new DomainInvariantViolationException.
    /// </summary>
    /// <param name="message">Description of the violated invariant.</param>
    public DomainInvariantViolationException(string message) : base(message)
    {
    }
}
