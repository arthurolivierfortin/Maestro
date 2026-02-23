using System.Text.Json.Serialization;

namespace LLMProvider.Web.Endpoints;

/// <summary>
/// Endpoints for image generation via Stable Diffusion.
/// Proxies requests to the Python FastAPI service at /v1/image/*.
/// </summary>
public static class ImageEndpoints
{
    public static void MapImageEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/image")
            .WithTags("Image Generation");

        group.MapPost("/generate", GenerateImage)
            .WithName("GenerateImage")
            .WithSummary("Generate an image using Stable Diffusion")
            .WithDescription(
                "Generates an image from a text prompt. Optionally post-processes to pixel art bitmap. " +
                "First call loads the model (~30-60s). Subsequent calls are fast (~5-15s).");

        group.MapGet("/status", GetImageStatus)
            .WithName("GetImageStatus")
            .WithSummary("Get image generation service status")
            .WithDescription("Returns whether the model is loaded, device info, and loaded LoRA names.");

        group.MapPost("/unload", UnloadImageModel)
            .WithName("UnloadImageModel")
            .WithSummary("Unload the image generation model")
            .WithDescription("Frees VRAM by unloading the Stable Diffusion model.");
    }

    private static async Task<IResult> GenerateImage(
        ImageGenerateRequest request,
        IHttpClientFactory httpClientFactory,
        CancellationToken cancellationToken)
    {
        try
        {
            var client = httpClientFactory.CreateClient("LocalPython");
            var response = await client.PostAsJsonAsync("/v1/image/generate", request, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync(cancellationToken);
                return Results.Problem(
                    detail: error,
                    statusCode: (int)response.StatusCode,
                    title: "Image Generation Failed");
            }

            var result = await response.Content.ReadFromJsonAsync<ImageGenerateResponse>(cancellationToken);
            return Results.Ok(result);
        }
        catch (HttpRequestException ex)
        {
            return Results.Problem(
                detail: $"Image generation service unavailable: {ex.Message}",
                statusCode: StatusCodes.Status503ServiceUnavailable,
                title: "Service Unavailable");
        }
        catch (TaskCanceledException)
        {
            return Results.Problem(
                detail: "Image generation timed out. SD model loading can take 30-60s on first call.",
                statusCode: StatusCodes.Status504GatewayTimeout,
                title: "Gateway Timeout");
        }
    }

    private static async Task<IResult> GetImageStatus(
        IHttpClientFactory httpClientFactory,
        CancellationToken cancellationToken)
    {
        try
        {
            var client = httpClientFactory.CreateClient("LocalPython");
            var response = await client.GetAsync("/v1/image/status", cancellationToken);

            if (response.IsSuccessStatusCode)
            {
                var result = await response.Content.ReadFromJsonAsync<ImageStatusResponse>(cancellationToken);
                return Results.Ok(result);
            }

            return Results.Ok(new ImageStatusResponse
            {
                Loaded = false,
                Device = "unknown",
                DiffusersAvailable = false,
            });
        }
        catch
        {
            return Results.Ok(new ImageStatusResponse
            {
                Loaded = false,
                Device = "unknown",
                DiffusersAvailable = false,
            });
        }
    }

    private static async Task<IResult> UnloadImageModel(
        IHttpClientFactory httpClientFactory,
        CancellationToken cancellationToken)
    {
        try
        {
            var client = httpClientFactory.CreateClient("LocalPython");
            var response = await client.PostAsync("/v1/image/unload", null, cancellationToken);

            if (response.IsSuccessStatusCode)
            {
                var result = await response.Content.ReadFromJsonAsync<object>(cancellationToken);
                return Results.Ok(result);
            }

            return Results.Problem(
                detail: "Failed to unload image model",
                statusCode: (int)response.StatusCode);
        }
        catch (HttpRequestException)
        {
            return Results.Ok(new { status = "not_loaded", reason = "Python API not reachable" });
        }
    }
}

// =============================================================================
// Request/Response DTOs
// =============================================================================

public record ImageGenerateRequest
{
    [JsonPropertyName("prompt")]
    public required string Prompt { get; init; }

    [JsonPropertyName("negative_prompt")]
    public string NegativePrompt { get; init; } = "smooth, blurry, gradient, 3D, realistic, antialiased";

    [JsonPropertyName("width")]
    public int Width { get; init; } = 512;

    [JsonPropertyName("height")]
    public int Height { get; init; } = 512;

    [JsonPropertyName("steps")]
    public int Steps { get; init; } = 30;

    [JsonPropertyName("cfg_scale")]
    public float CfgScale { get; init; } = 12.0f;

    [JsonPropertyName("seed")]
    public int Seed { get; init; } = -1;

    [JsonPropertyName("lora")]
    public string? Lora { get; init; }

    [JsonPropertyName("lora_weight")]
    public float LoraWeight { get; init; } = 0.8f;

    [JsonPropertyName("post_process")]
    public ImagePostProcessConfig? PostProcess { get; init; }
}

public record ImagePostProcessConfig
{
    [JsonPropertyName("target_width")]
    public int TargetWidth { get; init; } = 32;

    [JsonPropertyName("target_height")]
    public int TargetHeight { get; init; } = 32;

    [JsonPropertyName("palette_size")]
    public int PaletteSize { get; init; } = 2;

    [JsonPropertyName("cleanup")]
    public bool Cleanup { get; init; } = true;

    [JsonPropertyName("output_format")]
    public string OutputFormat { get; init; } = "both";
}

public record ImageGenerateResponse
{
    [JsonPropertyName("image_base64")]
    public string? ImageBase64 { get; init; }

    [JsonPropertyName("bitmap")]
    public List<string>? Bitmap { get; init; }

    [JsonPropertyName("seed")]
    public int Seed { get; init; }

    [JsonPropertyName("width")]
    public int Width { get; init; }

    [JsonPropertyName("height")]
    public int Height { get; init; }

    [JsonPropertyName("metadata")]
    public Dictionary<string, object>? Metadata { get; init; }
}

public record ImageStatusResponse
{
    [JsonPropertyName("loaded")]
    public bool Loaded { get; init; }

    [JsonPropertyName("model_id")]
    public string? ModelId { get; init; }

    [JsonPropertyName("device")]
    public required string Device { get; init; }

    [JsonPropertyName("loras")]
    public List<string> Loras { get; init; } = new();

    [JsonPropertyName("diffusers_available")]
    public bool DiffusersAvailable { get; init; }
}
