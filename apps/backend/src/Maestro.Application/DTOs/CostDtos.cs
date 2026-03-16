using System.Text.Json;
using System.Text.Json.Serialization;

namespace Maestro.Application.DTOs;

/// <summary>
/// A single cost entry recorded after block execution.
/// </summary>
public class CostEntryDto
{
    public string SessionId { get; set; } = string.Empty;
    public string BlockId { get; set; } = string.Empty;
    public string ModelId { get; set; } = string.Empty;
    public string ProviderId { get; set; } = string.Empty;
    public int PromptTokens { get; set; }
    public int CompletionTokens { get; set; }
    public decimal CostUsd { get; set; }
    public DateTime Timestamp { get; set; }
}

/// <summary>
/// Aggregated period summary (today, thisWeek, thisMonth, allTime).
/// </summary>
public class CostPeriodDto
{
    public decimal TotalCost { get; set; }
    public int TotalTokens { get; set; }
    public int RequestCount { get; set; }
}

/// <summary>
/// Provider or model breakdown entry.
/// </summary>
public class CostBreakdownDto
{
    public decimal TotalCost { get; set; }
    public int TotalTokens { get; set; }
}

/// <summary>
/// Full cost summary returned by GET /api/costs/summary.
/// </summary>
public class CostSummaryDto
{
    public CostPeriodDto Today { get; set; } = new();
    public CostPeriodDto ThisWeek { get; set; } = new();
    public CostPeriodDto ThisMonth { get; set; } = new();
    public CostPeriodDto AllTime { get; set; } = new();
    public Dictionary<string, CostBreakdownDto> ByProvider { get; set; } = new();
    public Dictionary<string, CostBreakdownDto> ByModel { get; set; } = new();
    public CostLimitsDto? Limits { get; set; }
}

/// <summary>
/// DTO for a single cost limit configuration.
/// Supports both old format (just a number) and new format (object with value/enforcement/autoResume).
/// Uses a custom JSON converter for backward compatibility.
/// </summary>
[JsonConverter(typeof(CostLimitConfigDtoConverter))]
public class CostLimitConfigDto
{
    public decimal? Value { get; set; }
    public string Enforcement { get; set; } = "block";
    public bool AutoResume { get; set; } = false;

    /// <summary>Creates from a simple decimal value (old format).</summary>
    public static CostLimitConfigDto FromValue(decimal? value) => new()
    {
        Value = value,
        Enforcement = "block",
        AutoResume = false
    };
}

/// <summary>
/// Cost limits configuration (read/write via API).
/// Supports both old format (decimal?) and new format (CostLimitConfigDto).
/// </summary>
public class CostLimitsDto
{
    public CostLimitConfigDto? MaxPerSession { get; set; }
    public CostLimitConfigDto? MaxPerDay { get; set; }
    public CostLimitConfigDto? MaxPerWeek { get; set; }
    public CostLimitConfigDto? MaxPerMonth { get; set; }
}

/// <summary>
/// Result of checking a cost limit. Enriched with enforcement and auto-resume info.
/// </summary>
public class CostLimitCheckResult
{
    public bool Exceeded { get; set; }
    public string LimitType { get; set; } = string.Empty;
    public string Enforcement { get; set; } = "block";
    public bool AutoResume { get; set; }
    public decimal CurrentValue { get; set; }
    public decimal MaxValue { get; set; }
    public string? Message { get; set; }

    public static CostLimitCheckResult Ok() => new() { Exceeded = false };
}

/// <summary>
/// JSON converter that handles both old format (number) and new format (object)
/// for CostLimitConfigDto during deserialization.
/// Old format: "maxPerDay": 5.0 -> CostLimitConfigDto { Value=5.0, Enforcement="block", AutoResume=false }
/// New format: "maxPerDay": { "value": 5.0, "enforcement": "warn", "autoResume": true }
/// </summary>
public class CostLimitConfigDtoConverter : JsonConverter<CostLimitConfigDto>
{
    public override CostLimitConfigDto? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.Null)
            return null;

        if (reader.TokenType == JsonTokenType.Number)
        {
            // Old format: just a number
            var value = reader.GetDecimal();
            return CostLimitConfigDto.FromValue(value);
        }

        if (reader.TokenType == JsonTokenType.StartObject)
        {
            // New format: object with value, enforcement, autoResume
            var dto = new CostLimitConfigDto();
            while (reader.Read())
            {
                if (reader.TokenType == JsonTokenType.EndObject)
                    return dto;

                if (reader.TokenType != JsonTokenType.PropertyName)
                    continue;

                var propName = reader.GetString()?.ToLowerInvariant();
                reader.Read();

                switch (propName)
                {
                    case "value":
                        dto.Value = reader.TokenType == JsonTokenType.Null ? null : reader.GetDecimal();
                        break;
                    case "enforcement":
                        dto.Enforcement = reader.GetString() ?? "block";
                        break;
                    case "autoresume":
                    case "autoResume":
                        dto.AutoResume = reader.GetBoolean();
                        break;
                }
            }
            return dto;
        }

        throw new JsonException($"Unexpected token type {reader.TokenType} for CostLimitConfigDto");
    }

    public override void Write(Utf8JsonWriter writer, CostLimitConfigDto value, JsonSerializerOptions options)
    {
        if (value == null)
        {
            writer.WriteNullValue();
            return;
        }

        writer.WriteStartObject();
        if (value.Value.HasValue)
            writer.WriteNumber("value", value.Value.Value);
        else
            writer.WriteNull("value");
        writer.WriteString("enforcement", value.Enforcement);
        writer.WriteBoolean("autoResume", value.AutoResume);
        writer.WriteEndObject();
    }
}
