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
using Maestro.Infrastructure.Fitness;
using Maestro.Infrastructure.Sessions;
using Maestro.Infrastructure.Experiments;
using Maestro.Infrastructure.Workspaces;
using Maestro.Infrastructure.Cli;
using Maestro.Infrastructure.Cli.CommandHandlers;
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
// ToolBlockExecutor now needs IServiceProvider for CLI bridge support
builder.Services.AddScoped<Maestro.Infrastructure.BlockExecutors.ToolBlockExecutor>(sp =>
    new Maestro.Infrastructure.BlockExecutors.ToolBlockExecutor(sp));
builder.Services.AddScoped<Maestro.Application.Interfaces.IBlockExecutor>(sp =>
    sp.GetRequiredService<Maestro.Infrastructure.BlockExecutors.ToolBlockExecutor>());
builder.Services.AddScoped<Maestro.Application.Interfaces.IBlockExecutor, Maestro.Infrastructure.BlockExecutors.ContextBlockExecutor>();
// AgentBlockExecutor is registered separately to avoid circular dependency with BlockExecutorRegistry
// Uses lazy resolution of registry via IServiceProvider
builder.Services.AddScoped<Maestro.Infrastructure.BlockExecutors.AgentBlockExecutor>(sp =>
{
    var llmGateway = sp.GetRequiredService<Maestro.Application.Interfaces.ILLMGateway>();
    return new Maestro.Infrastructure.BlockExecutors.AgentBlockExecutor(llmGateway, sp);
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
builder.Services.AddSingleton<FileSystemBlockDiscoveryService>(sp =>
{
    var publisher = sp.GetService<Maestro.Application.Interfaces.IBlockChangePublisher>();
    var config = sp.GetRequiredService<MaestroPathConfiguration>();
    return new FileSystemBlockDiscoveryService(config.GetSearchPaths(), publisher);
});
builder.Services.AddSingleton<IBlockDiscoveryService>(sp =>
    sp.GetRequiredService<FileSystemBlockDiscoveryService>());

// Phase 2 (System Blocks): Register system block service
builder.Services.AddSingleton<ISystemBlockService>(sp =>
{
    var blockDiscoveryService = sp.GetRequiredService<FileSystemBlockDiscoveryService>();
    var config = sp.GetRequiredService<MaestroPathConfiguration>();
    var logger = sp.GetService<ILogger<SystemBlockService>>();
    return new SystemBlockService(blockDiscoveryService, config.GlobalBlocksPath, logger);
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

// Phase 10: Register project session services (Unified Session System)
builder.Services.AddSingleton<IProjectSessionRepository>(sp =>
{
    var projectRepo = sp.GetRequiredService<IProjectRepository>();
    var logger = sp.GetService<ILogger<FileSystemProjectSessionRepository>>();
    return new FileSystemProjectSessionRepository(projectRepo, logger);
});
builder.Services.AddScoped<IProjectSessionService>(sp =>
{
    var sessionRepo = sp.GetRequiredService<IProjectSessionRepository>();
    var projectRepo = sp.GetRequiredService<IProjectRepository>();
    var workflowExecutor = sp.GetRequiredService<IWorkflowExecutor>();
    var blockRepo = sp.GetRequiredService<IBlockRepository>();
    var logger = sp.GetRequiredService<ILogger<ProjectSessionService>>();
    return new ProjectSessionService(sessionRepo, projectRepo, workflowExecutor, blockRepo, logger);
});

// Phase 10: Register session context storage (Singleton to persist across requests)
builder.Services.AddSingleton<Maestro.Infrastructure.Sessions.SessionContextStorage>();

// Phase 10: Register command executors for session server
builder.Services.AddScoped<ICommandExecutor, Maestro.Infrastructure.Sessions.CommandExecutors.ShellCommandExecutor>();
builder.Services.AddScoped<ICommandExecutor, Maestro.Infrastructure.Sessions.CommandExecutors.MaestroCommandExecutor>();
builder.Services.AddScoped<ICommandExecutor, Maestro.Infrastructure.Sessions.CommandExecutors.ControlCommandExecutor>();

// Phase 10: Register Project Session Server
builder.Services.AddScoped<IProjectSessionServer>(sp =>
{
    var sessionRepo = sp.GetRequiredService<IProjectSessionRepository>();
    var projectRepo = sp.GetRequiredService<IProjectRepository>();
    var blockRepo = sp.GetRequiredService<IBlockRepository>();
    var commandExecutors = sp.GetServices<ICommandExecutor>();
    var contextStorage = sp.GetRequiredService<Maestro.Infrastructure.Sessions.SessionContextStorage>();
    var logger = sp.GetRequiredService<ILogger<ProjectSessionServer>>();
    return new ProjectSessionServer(sessionRepo, projectRepo, blockRepo, commandExecutors, contextStorage, logger);
});

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

// Phase 10: Register Agent Foundry services (Tools & Agents registries)
var toolsFolder = Path.Combine(pathConfig.GlobalBlocksPath, "tools");
var agentsFolder = Path.Combine(pathConfig.GlobalBlocksPath, "agents");
builder.Services.AddSingleton<Maestro.Infrastructure.Foundry.ToolRegistry>(sp =>
{
    return new Maestro.Infrastructure.Foundry.ToolRegistry(toolsFolder);
});
builder.Services.AddSingleton<Maestro.Infrastructure.Foundry.AgentRegistry>(sp =>
{
    return new Maestro.Infrastructure.Foundry.AgentRegistry(agentsFolder);
});
Console.WriteLine($"[Maestro] Tools registry:  {toolsFolder}");
Console.WriteLine($"[Maestro] Agents registry: {agentsFolder}");

// Phase 9: Register training services
// Use repo root for persistent storage (not bin directory which is cleared on rebuild)
var trainingFolder = Path.Combine(pathConfig.RepoRootPath, "data", "training");
Directory.CreateDirectory(trainingFolder);
Console.WriteLine($"[Maestro] Training data:   {trainingFolder}");
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

// Block Testing: Register test repository for persistent storage
var testingFolder = Path.Combine(pathConfig.RepoRootPath, "data", "testing");
Directory.CreateDirectory(testingFolder);
Console.WriteLine($"[Maestro] Testing data:    {testingFolder}");
builder.Services.AddSingleton<Maestro.Infrastructure.Testing.FileSystemBlockTestRepository>(sp =>
{
    var logger = sp.GetService<ILogger<Maestro.Infrastructure.Testing.FileSystemBlockTestRepository>>();
    return new Maestro.Infrastructure.Testing.FileSystemBlockTestRepository(testingFolder, logger);
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

// Phase 11: Register fitness services
var fitnessFolder = Path.Combine(pathConfig.RepoRootPath, "data", "fitness");
Directory.CreateDirectory(fitnessFolder);
Console.WriteLine($"[Maestro] Fitness data:    {fitnessFolder}");
builder.Services.AddSingleton<IModelProfileRepository>(sp =>
{
    var logger = sp.GetService<ILogger<FileSystemModelProfileRepository>>();
    return new FileSystemModelProfileRepository(
        Path.Combine(fitnessFolder, "model-profiles.json"), logger);
});
builder.Services.AddSingleton<ITaskEntropyRepository>(sp =>
{
    var logger = sp.GetService<ILogger<FileSystemTaskEntropyRepository>>();
    return new FileSystemTaskEntropyRepository(
        Path.Combine(fitnessFolder, "task-entropy.json"), logger);
});
builder.Services.AddScoped<IFitnessService, FitnessService>();

// Phase 9: Register training service (Scoped because IWorkflowExecutor is Scoped)
builder.Services.AddScoped<ITrainingService, TrainingService>();

// Phase 3: Register workspace services
var workspaceFolder = Path.Combine(pathConfig.RepoRootPath, "data", "workspaces");
Directory.CreateDirectory(workspaceFolder);
Console.WriteLine($"[Maestro] Workspace data:  {workspaceFolder}");
builder.Services.AddSingleton<IWorkspaceRepository>(sp =>
{
    var logger = sp.GetService<ILogger<Maestro.Infrastructure.Workspaces.FileSystemWorkspaceRepository>>();
    return new Maestro.Infrastructure.Workspaces.FileSystemWorkspaceRepository(workspaceFolder, logger);
});
builder.Services.AddScoped<IWorkspaceService, Maestro.Infrastructure.Workspaces.WorkspaceService>();
builder.Services.AddScoped<IWorkspaceGateway, Maestro.Infrastructure.Workspaces.WorkspaceGateway>();

// Phase 7 (Research Workspace): Register workspace block resolver
builder.Services.AddScoped<IWorkspaceBlockResolver>(sp =>
{
    var blockDiscovery = sp.GetRequiredService<IBlockDiscoveryService>();
    var logger = sp.GetRequiredService<ILogger<Maestro.Infrastructure.Workspaces.WorkspaceBlockResolver>>();
    return new Maestro.Infrastructure.Workspaces.WorkspaceBlockResolver(blockDiscovery, logger, workspaceFolder);
});

// Phase 2: Register execution session services (Session-based permissions)
builder.Services.AddSingleton<IExecutionSessionRepository, InMemoryExecutionSessionRepository>();
builder.Services.AddScoped<IExecutionSessionService, ExecutionSessionService>();

// Phase 3: Register CLI Executor services
// Command handlers
builder.Services.AddScoped<ICommandHandler, RunCommandHandler>();
builder.Services.AddScoped<ICommandHandler, ListToolsCommandHandler>();
builder.Services.AddScoped<ICommandHandler, ListBlocksCommandHandler>();
builder.Services.AddScoped<ICommandHandler, DescribeCommandHandler>();
builder.Services.AddScoped<ICommandHandler, DataCommandHandler>();
builder.Services.AddScoped<ICommandHandler, SessionCommandHandler>();
builder.Services.AddScoped<ICommandHandler, WorkspaceCommandHandler>();
builder.Services.AddScoped<ICommandHandler, HelpCommandHandler>();
// Permission checker and executor
builder.Services.AddScoped<IPermissionChecker, PermissionChecker>();
builder.Services.AddScoped<ICliExecutor, CliExecutor>();

// Phase 5: Register orchestrator service
builder.Services.AddScoped<IOrchestratorService, Maestro.Infrastructure.Orchestration.OrchestratorService>();

// Phase 6: Register research team service
builder.Services.AddScoped<IResearchTeamService, Maestro.Infrastructure.Research.ResearchTeamService>();

// Phase 7: Register experiment services (Training Strategies)
var experimentsFolder = Path.Combine(pathConfig.RepoRootPath, "data", "experiments");
Directory.CreateDirectory(experimentsFolder);
Console.WriteLine($"[Maestro] Experiments data: {experimentsFolder}");
builder.Services.AddSingleton<IExperimentRepository>(sp =>
{
    var logger = sp.GetService<ILogger<Maestro.Infrastructure.Experiments.FileSystemExperimentRepository>>();
    return new Maestro.Infrastructure.Experiments.FileSystemExperimentRepository(experimentsFolder, logger);
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
app.MapHub<Maestro.Api.Hubs.SessionHub>("/hubs/sessions");

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

