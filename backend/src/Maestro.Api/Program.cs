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
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSignalR();

// Register application services following Clean Architecture
// Infrastructure implementations for Application interfaces
builder.Services.AddScoped<IWorkflowRepository, JsonWorkflowRepository>();
builder.Services.AddScoped<ILLMGateway, LLMGateway>();
builder.Services.AddScoped<IExecutionMonitor, ExecutionMonitor>();
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
app.UseHttpsRedirection();
app.UseCors("AllowFrontend");
app.MapControllers();
app.MapHub<Maestro.Api.Hubs.BlockHub>("/hubs/blocks");

app.MapGet("/", () => new
{
    name = "B-One Maestro API",
    version = "1.0.0",
    architecture = "Clean Architecture with SOLID principles",
    status = "Hello World - Architecture Validation"
});

app.Run();

