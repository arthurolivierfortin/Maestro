namespace Maestro.Application.DTOs;

// ═══ HEALTH ═══

public record LLMProviderHealth
{
    public string Status { get; init; } = "unknown";
    public string? ActiveModel { get; init; }
    public int ModelsLoaded { get; init; }
    public string Device { get; init; } = "cpu";
    public bool CudaAvailable { get; init; }
    public string? CudaDeviceName { get; init; }
}

// ═══ SYSTEM CAPABILITIES ═══

public record SystemCapabilities
{
    public GpuInfo? Gpu { get; init; }
    public CpuInfo? Cpu { get; init; }
    public RamInfo? Ram { get; init; }
    public string? Platform { get; init; }
    public string? PythonVersion { get; init; }
    public string? TorchVersion { get; init; }
    public bool CudaAvailable { get; init; }
    public bool MpsAvailable { get; init; }
}

public record GpuInfo
{
    public bool Available { get; init; }
    public string? Name { get; init; }
    public double VramTotalGb { get; init; }
    public double VramUsedGb { get; init; }
    public double VramFreeGb { get; init; }
    public string? CudaVersion { get; init; }
    public string? ComputeCapability { get; init; }
    public string? DriverVersion { get; init; }
    public int DeviceIndex { get; init; }
}

public record CpuInfo
{
    public string? Name { get; init; }
    public int CoresPhysical { get; init; }
    public int CoresLogical { get; init; }
    public string? Architecture { get; init; }
}

public record RamInfo
{
    public double TotalGb { get; init; }
    public double AvailableGb { get; init; }
    public double UsedGb { get; init; }
    public double PercentUsed { get; init; }
}

// ═══ COMPATIBLE MODELS ═══

public record CompatibleModelsResponse
{
    public HardwareSummary? Hardware { get; init; }
    public CompatibilitySummary? Summary { get; init; }
    public int Count { get; init; }
    public List<CompatibleModel> Models { get; init; } = new();
}

public record HardwareSummary
{
    public bool GpuAvailable { get; init; }
    public string? GpuName { get; init; }
    public double VramTotalGb { get; init; }
    public double VramFreeGb { get; init; }
}

public record CompatibilitySummary
{
    public int TotalCompatible { get; init; }
    public int FullPrecisionCount { get; init; }
    public int Int8RequiredCount { get; init; }
    public int Int4RequiredCount { get; init; }
    public string? Note { get; init; }
}

public record CompatibleModel
{
    public string ModelId { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public string? Category { get; init; }
    public string? Size { get; init; }
    public double ParametersB { get; init; }
    public int ContextLength { get; init; }
    public double VramFp16Gb { get; init; }
    public double VramInt8Gb { get; init; }
    public double VramInt4Gb { get; init; }
    public List<string> Capabilities { get; init; } = new();
    public string? License { get; init; }
    public bool Recommended { get; init; }
    public bool CanRunFp16 { get; init; }
    public bool CanRunInt8 { get; init; }
    public bool CanRunInt4 { get; init; }
    public string? RecommendedPrecision { get; init; }
    public string? QuantizationRequired { get; init; }
    public double VramRequired { get; init; }
    public bool IsLocal { get; init; }
    public decimal? InputTokenPricePerMillion { get; init; }
    public decimal? OutputTokenPricePerMillion { get; init; }
}

// ═══ LOCAL MODELS ═══

public record LocalModelsResponse
{
    public int Count { get; init; }
    public List<LocalModel> Models { get; init; } = new();
}

public record LocalModel
{
    public string ModelId { get; init; } = string.Empty;
    public string? Path { get; init; }
    public double SizeGb { get; init; }
    public string? LastAccessed { get; init; }
    public bool IsComplete { get; init; }
    public string? DisplayName { get; init; }
    public string? Category { get; init; }
    public double VramRequiredFp16 { get; init; }
    public double VramRequiredInt8 { get; init; }
    public double VramRequiredInt4 { get; init; }
    public int ContextLength { get; init; }
    public List<string> Capabilities { get; init; } = new();
}

// ═══ REGISTRY MODELS ═══

public record RegistryModelsResponse
{
    public int Count { get; init; }
    public List<string> Categories { get; init; } = new();
    public List<RegistryModel> Models { get; init; } = new();
}

public record RegistryModel
{
    public string ModelId { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public string? Category { get; init; }
    public string? Size { get; init; }
    public double ParametersB { get; init; }
    public int ContextLength { get; init; }
    public double VramFp16Gb { get; init; }
    public double VramInt8Gb { get; init; }
    public double VramInt4Gb { get; init; }
    public List<string> Capabilities { get; init; } = new();
    public string? License { get; init; }
    public bool Recommended { get; init; }
    public List<string> Languages { get; init; } = new();
    public bool IsLocal { get; init; }
}

// ═══ SWITCH / LOAD RESULTS ═══

public record SwitchModelResult
{
    public string Status { get; init; } = string.Empty;
    public string? ActiveModel { get; init; }
    public double LoadTimeS { get; init; }
}

public record LoadModelResult
{
    public string Status { get; init; } = string.Empty;
    public string? ModelId { get; init; }
    public double LoadTimeS { get; init; }
    public string? Device { get; init; }
    public int ContextLength { get; init; }
    public List<string> Capabilities { get; init; } = new();
}

// ═══ LLM PROVIDER STATS ═══

public record LLMProviderStats
{
    public long TotalRequests { get; init; }
    public long TotalErrors { get; init; }
    public double ErrorRate { get; init; }
    public long PromptTokens { get; init; }
    public long CompletionTokens { get; init; }
    public long TotalTokens { get; init; }
    public double LatencyP50Ms { get; init; }
    public double LatencyP95Ms { get; init; }
    public double LatencyP99Ms { get; init; }
    public double AvgLatencyMs { get; init; }
    public List<PerModelStats> PerModel { get; init; } = new();
}

public record PerModelStats
{
    public string Model { get; init; } = string.Empty;
    public long Requests { get; init; }
    public double AvgLatencyMs { get; init; }
    public long TotalTokens { get; init; }
    public double Rpm { get; init; }
}

public record LLMQueueStats
{
    public string? ActiveModel { get; init; }
    public int Depth { get; init; }
    public double AvgWaitMs { get; init; }
    public long TotalEnqueued { get; init; }
    public long TotalProcessed { get; init; }
    public Dictionary<string, int> DepthByModel { get; init; } = new();
}

public record LLMPerformanceProfile
{
    public string Model { get; init; } = string.Empty;
    public long RequestCount { get; init; }
    public double AvgResponseTimeMs { get; init; }
    public double AvgTokensPerRequest { get; init; }
    public double AvgLoadTimeMs { get; init; }
}

public record LLMSwitchEvent
{
    public string Timestamp { get; init; } = string.Empty;
    public string Action { get; init; } = string.Empty;
    public string Target { get; init; } = string.Empty;
    public double Score { get; init; }
    public string? Reason { get; init; }
}

// ═══ CHAT REQUEST/RESPONSE ═══

public record ChatCompletionRequest
{
    public List<ChatMessageDto> Messages { get; init; } = new();
    public string? Model { get; init; }
    public float? Temperature { get; init; }
    public int? MaxTokens { get; init; }
}

public record ChatMessageDto
{
    public string Role { get; init; } = string.Empty;
    public string Content { get; init; } = string.Empty;
}

public record ChatCompletionResponse
{
    public string Content { get; init; } = string.Empty;
    public string? Model { get; init; }
    public int PromptTokens { get; init; }
    public int CompletionTokens { get; init; }
    public int TotalTokens { get; init; }
}
