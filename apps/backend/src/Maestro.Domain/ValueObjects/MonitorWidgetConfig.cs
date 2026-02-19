namespace Maestro.Domain.ValueObjects;

/// <summary>
/// Configuration for a monitor widget.
/// Widget TYPES are generic (provided by Maestro).
/// Widget CONFIGURATION is session-specific.
/// </summary>
public class MonitorWidgetConfig
{
    /// <summary>
    /// Unique identifier for this widget instance.
    /// </summary>
    public string Id { get; set; } = string.Empty;

    /// <summary>
    /// Widget type (e.g., "progress-bar", "score-chart", "counter", "status-list").
    /// These are generic types provided by the monitor framework.
    /// </summary>
    public string Type { get; set; } = string.Empty;

    /// <summary>
    /// Session-specific configuration for this widget.
    /// The structure depends on the widget type.
    /// </summary>
    public Dictionary<string, object> Config { get; set; } = new();

    /// <summary>
    /// Creates a new widget configuration.
    /// </summary>
    public static MonitorWidgetConfig Create(string id, string type, Dictionary<string, object>? config = null)
    {
        return new MonitorWidgetConfig
        {
            Id = id,
            Type = type,
            Config = config ?? new Dictionary<string, object>()
        };
    }

    /// <summary>
    /// Creates a progress bar widget configuration.
    /// </summary>
    public static MonitorWidgetConfig ProgressBar(string id, string label, string currentPath, string maxPath)
    {
        return Create(id, "progress-bar", new Dictionary<string, object>
        {
            ["label"] = label,
            ["current"] = currentPath,
            ["max"] = maxPath
        });
    }

    /// <summary>
    /// Creates a score chart widget configuration.
    /// </summary>
    public static MonitorWidgetConfig ScoreChart(string id, string label, string valuePath, string? thresholdPath = null)
    {
        var config = new Dictionary<string, object>
        {
            ["label"] = label,
            ["value"] = valuePath
        };
        if (thresholdPath != null)
        {
            config["threshold"] = thresholdPath;
        }
        return Create(id, "score-chart", config);
    }

    /// <summary>
    /// Creates a counter widget configuration.
    /// </summary>
    public static MonitorWidgetConfig Counter(string id, string label, string valuePath, string? maxPath = null, string? icon = null)
    {
        var config = new Dictionary<string, object>
        {
            ["label"] = label,
            ["value"] = valuePath
        };
        if (maxPath != null) config["max"] = maxPath;
        if (icon != null) config["icon"] = icon;
        return Create(id, "counter", config);
    }
}
