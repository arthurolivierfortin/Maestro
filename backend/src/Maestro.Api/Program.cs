using Maestro.Domain.Interfaces;
using Maestro.Application.Interfaces;
using Maestro.Infrastructure.LLMGateway;
using Maestro.Infrastructure.Monitoring;
using Maestro.Infrastructure.Persistence;
using Maestro.Infrastructure.BlockStore;
using Maestro.Infrastructure.Configuration;
using Maestro.Infrastructure.Projects;
using Maestro.Infrastructure.Containers;
using Maestro.Infrastructure.Services;
using Maestro.Infrastructure.Metrics;
using Maestro.Infrastructure.Training;
using Maestro.Infrastructure.Training.QualityEvaluators;
using System.IO;
using System;
using Microsoft.Extensions.Options;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container
builder.Services.AddControllers().AddNewtonsoftJson();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSignalR();

// Register application services following Clean Architecture
// Infrastructure implementations for Application interfaces
builder.Services.AddScoped<IWorkflowRepository, JsonWorkflowRepository>();

// Configure LLM Provider Gateway
builder.Services.Configure<LLMProviderSettings>(
    builder.Configuration.GetSection(LLMProviderSettings.SectionName));
builder.Services.AddHttpClient<ILLMGateway, LLMProviderGateway>((sp, client) =>
{
    var settings = sp.GetRequiredService<IOptions<LLMProviderSettings>>().Value;
    client.BaseAddress = new Uri(settings.BaseUrl);
    client.Timeout = TimeSpan.FromSeconds(settings.TimeoutSeconds);
});
builder.Services.AddScoped<IExecutionMonitor, ExecutionMonitor>();
// Prefer SignalR-backed monitor when available (scaffold). Register both if needed.
// Prefer SignalR-backed monitor when available (scaffold). Register both if needed.
builder.Services.AddScoped<Maestro.Application.Interfaces.IExecutionMonitor, Maestro.Api.Monitoring.SignalRExecutionMonitor>();
// Register block executors from Infrastructure
builder.Services.AddScoped<Maestro.Application.Interfaces.IBlockExecutor, Maestro.Infrastructure.BlockExecutors.PromptBlockExecutor>();
builder.Services.AddScoped<Maestro.Application.Interfaces.IBlockExecutor, Maestro.Infrastructure.BlockExecutors.InferenceBlockExecutor>();
builder.Services.AddScoped<Maestro.Application.Interfaces.IBlockExecutor, Maestro.Infrastructure.BlockExecutors.ToolBlockExecutor>();
// AgentBlockExecutor is registered separately to avoid circular dependency with BlockExecutorRegistry
builder.Services.AddScoped<Maestro.Infrastructure.BlockExecutors.AgentBlockExecutor>(sp =>
{
    var llmGateway = sp.GetRequiredService<Maestro.Application.Interfaces.ILLMGateway>();
    return new Maestro.Infrastructure.BlockExecutors.AgentBlockExecutor(llmGateway, null);
});
builder.Services.AddScoped<Maestro.Application.Interfaces.IBlockExecutor>(sp =>
    sp.GetRequiredService<Maestro.Infrastructure.BlockExecutors.AgentBlockExecutor>());

// Orchestration services (Phase 5C)
builder.Services.AddScoped<Maestro.Application.Interfaces.IDataFlowManager, Maestro.Infrastructure.Orchestration.DataFlowManager>();
builder.Services.AddScoped<Maestro.Application.Interfaces.IWorkflowExecutor, Maestro.Infrastructure.Orchestration.WorkflowExecutor>();

// Register registry that consumes all IBlockExecutor implementations
builder.Services.AddScoped<Maestro.Infrastructure.BlockExecutors.BlockExecutorRegistry>(sp =>
{
    var executors = sp.GetServices<Maestro.Application.Interfaces.IBlockExecutor>();
    return new Maestro.Infrastructure.BlockExecutors.BlockExecutorRegistry(executors);
});
// Register execution repository (persistence for checkpoints/executions)
var execFolder = Path.Combine(AppContext.BaseDirectory, "executions");
builder.Services.AddScoped<Maestro.Application.Interfaces.IExecutionRepository>(_ => new Maestro.Infrastructure.Persistence.FileSystemExecutionRepository(execFolder));

// Register RunTracker for execution traceability
var runsFolder = Path.Combine(AppContext.BaseDirectory, "runs");
builder.Services.AddSingleton<Maestro.Infrastructure.Runs.RunTracker>(_ => new Maestro.Infrastructure.Runs.RunTracker(runsFolder));

// Phase 7A: Use MaestroPathConfiguration for centralized path resolution
var pathConfig = new MaestroPathConfiguration(builder.Configuration);
pathConfig.EnsureDirectoriesExist();

// Log resolved paths for debugging
Console.WriteLine($"[Maestro] Repository root: {pathConfig.RepoRootPath}");
Console.WriteLine($"[Maestro] Global blocks:   {pathConfig.GlobalBlocksPath}");
Console.WriteLine($"[Maestro] User blocks:     {pathConfig.UserBlocksPath}");
Console.WriteLine($"[Maestro] Project blocks:  {pathConfig.ProjectBlocksPath}");

// Register path configuration as singleton for other services
builder.Services.AddSingleton(pathConfig);

// Register SignalR-based publisher implementation as singleton (for FileSystemBlockDiscoveryService)
builder.Services.AddSingleton<Maestro.Application.Interfaces.IBlockChangePublisher, Maestro.Api.Services.SignalRBlockChangePublisher>();

// Register block discovery service with change publisher
builder.Services.AddSingleton<IBlockDiscoveryService>(sp =>
{
    var publisher = sp.GetService<Maestro.Application.Interfaces.IBlockChangePublisher>();
    var config = sp.GetRequiredService<MaestroPathConfiguration>();
    return new FileSystemBlockDiscoveryService(config.GetSearchPaths(), publisher);
});

// Register block repository with publisher and validator
builder.Services.AddScoped<IBlockRepository>(sp =>
{
    var publisher = sp.GetService<Maestro.Application.Interfaces.IBlockChangePublisher>();
    var validator = sp.GetService<Maestro.Application.Interfaces.IBlockValidator>();
    var config = sp.GetRequiredService<MaestroPathConfiguration>();
    return new FileSystemBlockRepository(config.ProjectBlocksPath, publisher, validator);
});

builder.Services.AddScoped<Maestro.Application.Interfaces.IBlockValidator, Maestro.Infrastructure.BlockStore.JsonSchemaBlockValidator>();

// Register project repository (Phase 7B)
builder.Services.AddSingleton<IProjectRepository>(sp =>
{
    var config = sp.GetRequiredService<MaestroPathConfiguration>();
    var logger = sp.GetService<ILogger<FileSystemProjectRepository>>();
    return new FileSystemProjectRepository(config, logger);
});

// Register container runtime factory (Phase 7D)
builder.Services.AddSingleton<IContainerRuntimeFactory, ContainerRuntimeFactory>();

// Phase 8: Register project container service
builder.Services.AddSingleton<IProjectContainerService, ProjectContainerService>();

// Phase 8: Register file system browser
builder.Services.AddSingleton<IFileSystemBrowser, FileSystemBrowser>();

// Phase 9: Register metrics services
var metricsFolder = Path.Combine(AppContext.BaseDirectory, "metrics");
builder.Services.AddSingleton<IMetricsRepository>(sp =>
{
    var logger = sp.GetService<ILogger<FileSystemMetricsRepository>>();
    return new FileSystemMetricsRepository(metricsFolder, logger);
});
builder.Services.AddSingleton<MetricsCollector>(sp =>
{
    var repository = sp.GetRequiredService<IMetricsRepository>();
    var logger = sp.GetService<ILogger<MetricsCollector>>();
    return new MetricsCollector(repository, logger);
});
builder.Services.AddSingleton<IMetricsCollector>(sp => sp.GetRequiredService<MetricsCollector>());

// Phase 9: Register training services
var trainingFolder = Path.Combine(AppContext.BaseDirectory, "training");
builder.Services.AddSingleton<ITrainingConfigurationRepository>(sp =>
{
    var logger = sp.GetService<ILogger<FileSystemTrainingConfigurationRepository>>();
    return new FileSystemTrainingConfigurationRepository(trainingFolder, logger);
});
builder.Services.AddSingleton<ITrainingRunRepository>(sp =>
{
    var logger = sp.GetService<ILogger<FileSystemTrainingRunRepository>>();
    return new FileSystemTrainingRunRepository(trainingFolder, logger);
});

// Phase 9: Register quality evaluators
builder.Services.AddSingleton<HeuristicQualityEvaluator>();
builder.Services.AddSingleton<LLMQualityEvaluator>(sp =>
{
    var llmGateway = sp.GetRequiredService<ILLMGateway>();
    var logger = sp.GetService<ILogger<LLMQualityEvaluator>>();
    return new LLMQualityEvaluator(llmGateway, logger);
});
builder.Services.AddSingleton<IQualityEvaluator, CompositeQualityEvaluator>(sp =>
{
    var heuristic = sp.GetRequiredService<HeuristicQualityEvaluator>();
    var llm = sp.GetService<LLMQualityEvaluator>();
    var logger = sp.GetService<ILogger<CompositeQualityEvaluator>>();
    return new CompositeQualityEvaluator(heuristic, llm, logger);
});

// Phase 9: Register training service
builder.Services.AddSingleton<ITrainingService>(sp =>
{
    var configRepo = sp.GetRequiredService<ITrainingConfigurationRepository>();
    var runRepo = sp.GetRequiredService<ITrainingRunRepository>();
    var workflowExecutor = sp.GetRequiredService<IWorkflowExecutor>();
    var metricsCollector = sp.GetRequiredService<MetricsCollector>();
    var logger = sp.GetService<ILogger<TrainingService>>();
    return new TrainingService(configRepo, runRepo, workflowExecutor, metricsCollector, logger);
});

// Add CORS for frontend development and Docker
builder.Services.AddCors(options =>
{
    // Read allowed origins from configuration (for Docker deployment)
    var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
        ?? new[] { "http://localhost:5173", "http://localhost:3000", "http://frontend:5173" };

    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials(); // Required for SignalR
    });
});

var app = builder.Build();

// Configure the HTTP request pipeline
if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}
app.UseCors("AllowFrontend");
app.MapControllers();
app.MapHub<Maestro.Api.Hubs.BlockHub>("/hubs/blocks");
app.MapHub<Maestro.Api.Hubs.ExecutionHub>("/hubs/execution");
app.MapHub<Maestro.Api.Hubs.ProjectHub>("/hubs/projects");
app.MapHub<Maestro.Api.Hubs.TerminalHub>("/hubs/terminal");

// Initialize SignalR state publisher for projects
var projectStatePublisher = new Maestro.Api.Hubs.SignalRProjectStatePublisher(
    app.Services.GetRequiredService<Microsoft.AspNetCore.SignalR.IHubContext<Maestro.Api.Hubs.ProjectHub>>(),
    app.Services.GetRequiredService<IProjectContainerService>(),
    app.Services.GetRequiredService<ILogger<Maestro.Api.Hubs.SignalRProjectStatePublisher>>());

app.MapGet("/", () => new
{
    name = "B-One Maestro API",
    version = "1.0.0",
    architecture = "Clean Architecture with SOLID principles",
    status = "Hello World - Architecture Validation"
});

// Health check endpoint for service monitoring
app.MapGet("/api/health", () => new
{
    status = "healthy",
    timestamp = DateTime.UtcNow,
    version = "1.0.0"
});

app.Run();

// Expose Program class for WebApplicationFactory in tests
namespace Maestro.Api
{
    public partial class Program { }
}

