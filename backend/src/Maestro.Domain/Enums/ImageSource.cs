namespace Maestro.Domain.Enums;

/// <summary>
/// Source of a sandbox image definition.
/// </summary>
public enum ImageSource
{
    /// <summary>
    /// Built-in image provided by Maestro.
    /// Cannot be modified or deleted by users.
    /// </summary>
    BuiltIn,

    /// <summary>
    /// User-defined image registered in Maestro.
    /// Can be modified and deleted by users.
    /// </summary>
    UserDefined
}
