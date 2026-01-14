using Maestro.Domain.Interfaces;
using Maestro.Application.Interfaces;
using Maestro.Infrastructure.LLMGateway;
using Maestro.Infrastructure.Monitoring;
using Maestro.Infrastructure.Persistence;
using Maestro.Infrastructure.BlockStore;
using System.IO;
using System;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container
builder.Services.AddControllers().AddNewtonsoftJson();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSignalR();

// Register application services following Clean Architecture
// Infrastructure implementations for Application interfaces
builder.Services.AddScoped<IWorkflowRepository, JsonWorkflowRepository>();
builder.Services.AddScoped<ILLMGateway, LLMGateway>();
builder.Services.AddScoped<IExecutionMonitor, ExecutionMonitor>();
// Prefer SignalR-backed monitor when available (scaffold). Register both if needed.
// Prefer SignalR-backed monitor when available (scaffold). Register both if needed.
builder.Services.AddScoped<Maestro.Application.Interfaces.IExecutionMonitor, Maestro.Api.Monitoring.SignalRExecutionMonitor>();
// Register block executors from Infrastructure
builder.Services.AddScoped<Maestro.Application.Interfaces.IBlockExecutor, Maestro.Infrastructure.BlockExecutors.PromptBlockExecutor>();
builder.Services.AddScoped<Maestro.Application.Interfaces.IBlockExecutor, Maestro.Infrastructure.BlockExecutors.InferenceBlockExecutor>();
builder.Services.AddScoped<Maestro.Application.Interfaces.IBlockExecutor, Maestro.Infrastructure.BlockExecutors.ToolBlockExecutor>();

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
// Phase 5A: Filesystem block discovery and repository
var blocksGlobalPath = Path.Combine(AppContext.BaseDirectory, "blocks");
var blocksUserPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile) ?? "", ".maestro", "blocks");
var blocksProjectPath = Path.Combine(Directory.GetCurrentDirectory(), ".maestro", "blocks");

builder.Services.AddSingleton<IBlockDiscoveryService>(_ => new FileSystemBlockDiscoveryService(new[] { blocksProjectPath, blocksUserPath, blocksGlobalPath }));
builder.Services.AddScoped<IBlockRepository>(sp =>
{
    var publisher = sp.GetService<Maestro.Application.Interfaces.IBlockChangePublisher>();
    return new FileSystemBlockRepository(blocksProjectPath, publisher);
});
// Register SignalR-based publisher implementation
builder.Services.AddScoped<Maestro.Application.Interfaces.IBlockChangePublisher, Maestro.Api.Services.SignalRBlockChangePublisher>();
builder.Services.AddScoped<Maestro.Application.Interfaces.IBlockValidator, Maestro.Infrastructure.BlockStore.JsonSchemaBlockValidator>();
// Add CORS for frontend development
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins("http://localhost:5173", "http://localhost:3000")
              .AllowAnyHeader()
              .AllowAnyMethod();
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

app.MapGet("/", () => new
{
    name = "B-One Maestro API",
    version = "1.0.0",
    architecture = "Clean Architecture with SOLID principles",
    status = "Hello World - Architecture Validation"
});

app.Run();

// Expose Program class for WebApplicationFactory in tests
namespace Maestro.Api
{
    public partial class Program { }
}

