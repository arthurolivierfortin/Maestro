namespace Maestro.Infrastructure.Configuration;

/// <summary>
/// Central configuration for Maestro infrastructure services.
/// </summary>
public class MaestroConfiguration
{
    /// <summary>
    /// Root path for Maestro data storage.
    /// </summary>
    public string DataPath { get; set; } = string.Empty;
}
