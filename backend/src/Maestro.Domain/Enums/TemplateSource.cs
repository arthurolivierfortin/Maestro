namespace Maestro.Domain.Enums;

/// <summary>
/// Source of a session template definition.
/// </summary>
public enum TemplateSource
{
    /// <summary>
    /// Built-in template provided by Maestro.
    /// Cannot be modified or deleted by users.
    /// </summary>
    BuiltIn,

    /// <summary>
    /// User-defined template created by the user.
    /// Can be modified and deleted by users.
    /// </summary>
    UserDefined
}
