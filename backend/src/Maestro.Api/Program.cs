using Maestro.Domain.Interfaces;
using Maestro.Application.Interfaces;
using Maestro.Infrastructure.LLMGateway;
using Maestro.Infrastructure.Monitoring;
using Maestro.Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

// Register application services following Clean Architecture
// Infrastructure implementations for Application interfaces
builder.Services.AddScoped<IWorkflowRepository, JsonWorkflowRepository>();
builder.Services.AddScoped<ILLMGateway, LLMGateway>();
builder.Services.AddScoped<IExecutionMonitor, ExecutionMonitor>();

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

app.MapGet("/", () => new
{
    name = "B-One Maestro API",
    version = "1.0.0",
    architecture = "Clean Architecture with SOLID principles",
    status = "Hello World - Architecture Validation"
});

app.Run();

