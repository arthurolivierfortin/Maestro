using System.Text.Json.Serialization;

namespace LLMProvider.LocalProvider.Models;

/// <summary>
/// A single message in a conversation for the local API.
/// </summary>
public sealed class LocalMessage
{
    [JsonPropertyName("role")]
    public required string Role { get; init; }

    [JsonPropertyName("content")]
    public required string Content { get; init; }
}

/// <summary>
/// Request model for the local API generate endpoint.
/// </summary>
public sealed class GenerateRequest
{
    [JsonPropertyName("prompt")]
    public required string Prompt { get; init; }

    [JsonPropertyName("model_id")]
    public string? ModelId { get; init; }

    [JsonPropertyName("max_new_tokens")]
    public int? MaxNewTokens { get; init; }

    [JsonPropertyName("temperature")]
    public float? Temperature { get; init; }

    [JsonPropertyName("do_sample")]
    public bool DoSample { get; init; } = true;

    [JsonPropertyName("top_p")]
    public float? TopP { get; init; }

    [JsonPropertyName("system_prompt")]
    public string? SystemPrompt { get; init; }

    [JsonPropertyName("messages")]
    public List<LocalMessage>? Messages { get; init; }
}

/// <summary>
/// Response model from the local API generate endpoint.
/// </summary>
public sealed class GenerateResponse
{
    [JsonPropertyName("generated_text")]
    public required string GeneratedText { get; init; }

    [JsonPropertyName("model")]
    public string? Model { get; init; }

    [JsonPropertyName("prompt_tokens")]
    public int PromptTokens { get; init; }

    [JsonPropertyName("completion_tokens")]
    public int CompletionTokens { get; init; }

    [JsonPropertyName("total_tokens")]
    public int TotalTokens { get; init; }

    [JsonPropertyName("finish_reason")]
    public string? FinishReason { get; init; }
}

/// <summary>
/// Model information from the local API.
/// </summary>
public sealed class LocalModelInfo
{
    [JsonPropertyName("model_id")]
    public required string ModelId { get; init; }

    [JsonPropertyName("loaded_at")]
    public double? LoadedAt { get; init; }

    [JsonPropertyName("load_time_s")]
    public float? LoadTimeSeconds { get; init; }

    [JsonPropertyName("device")]
    public string? Device { get; init; }

    [JsonPropertyName("is_active")]
    public bool IsActive { get; init; }

    [JsonPropertyName("context_length")]
    public int ContextLength { get; init; } = 2048;

    [JsonPropertyName("max_output_tokens")]
    public int MaxOutputTokens { get; init; } = 512;

    [JsonPropertyName("capabilities")]
    public List<string> Capabilities { get; init; } = ["chat", "completion"];
}

/// <summary>
/// Response from the models endpoint.
/// </summary>
public sealed class ModelsResponse
{
    [JsonPropertyName("models")]
    public required Dictionary<string, LocalModelInfo> Models { get; init; }

    [JsonPropertyName("active_model")]
    public string? ActiveModel { get; init; }
}

/// <summary>
/// Request to switch the active model.
/// </summary>
public sealed class SwitchModelRequest
{
    [JsonPropertyName("model_id")]
    public required string ModelId { get; init; }

    [JsonPropertyName("use_8bit")]
    public bool Use8Bit { get; init; }
}

/// <summary>
/// Response from switch model endpoint.
/// </summary>
public sealed class SwitchModelResponse
{
    [JsonPropertyName("status")]
    public required string Status { get; init; }

    [JsonPropertyName("active_model")]
    public string? ActiveModel { get; init; }

    [JsonPropertyName("load_time_s")]
    public float? LoadTimeSeconds { get; init; }
}

/// <summary>
/// Request to load a model.
/// </summary>
public sealed class LoadModelRequest
{
    [JsonPropertyName("model_id")]
    public required string ModelId { get; init; }

    [JsonPropertyName("use_8bit")]
    public bool Use8Bit { get; init; }

    [JsonPropertyName("set_active")]
    public bool SetActive { get; init; } = true;
}

/// <summary>
/// Health check response from the local API.
/// </summary>
public sealed class HealthResponse
{
    [JsonPropertyName("status")]
    public required string Status { get; init; }

    [JsonPropertyName("active_model")]
    public string? ActiveModel { get; init; }

    [JsonPropertyName("models_loaded")]
    public int ModelsLoaded { get; init; }

    [JsonPropertyName("device")]
    public string? Device { get; init; }

    [JsonPropertyName("cuda_available")]
    public bool CudaAvailable { get; init; }

    [JsonPropertyName("cuda_device_name")]
    public string? CudaDeviceName { get; init; }
}

/// <summary>
/// Recommended model information.
/// </summary>
public sealed class RecommendedModel
{
    [JsonPropertyName("model_id")]
    public required string ModelId { get; init; }

    [JsonPropertyName("description")]
    public string? Description { get; init; }

    [JsonPropertyName("size_gb")]
    public float SizeGb { get; init; }

    [JsonPropertyName("context_length")]
    public int ContextLength { get; init; }

    [JsonPropertyName("recommended")]
    public bool Recommended { get; init; }
}

/// <summary>
/// Available models response.
/// </summary>
public sealed class AvailableModelsResponse
{
    [JsonPropertyName("recommended_coding_models")]
    public List<RecommendedModel> RecommendedCodingModels { get; init; } = [];

    [JsonPropertyName("lightweight_models")]
    public List<RecommendedModel> LightweightModels { get; init; } = [];
}
