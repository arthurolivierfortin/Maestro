using Azure.Identity;
using LLMProvider.AnthropicProvider;
using LLMProvider.GitHubModelsProvider;
using LLMProvider.AzureProvider;
using LLMProvider.AzureInferenceProvider;
using LLMProvider.ClaudeCodeProvider;
using LLMProvider.Infrastructure;
using LLMProvider.LocalProvider;
using LLMProvider.Web.Endpoints;
using LLMProvider.Web.Middleware;
using LLMProvider.Web.Services;
using Microsoft.OpenApi.Models;
using Serilog;

// Load .env file BEFORE builder creation so env vars are available to IConfiguration
var maestroRoot = Environment.GetEnvironmentVariable("MAESTRO_ROOT") ?? Directory.GetCurrentDirectory();
LLMProvider.Web.DotEnvLoader.Load(Path.Combine(maestroRoot, ".env"));

var builder = WebApplication.CreateBuilder(args);

// Configure Serilog early for logging during startup
// In single-file mode, Serilog can't discover assemblies for ReadFrom.Configuration.
// Fall back to console-only logging if configuration reading fails.
try
{
    Log.Logger = new LoggerConfiguration()
        .ReadFrom.Configuration(builder.Configuration)
        .Enrich.FromLogContext()
        .WriteTo.Console()
        .CreateLogger();
}
catch (InvalidOperationException)
{
    // Single-file publish: assemblies not discoverable via reflection
    Log.Logger = new LoggerConfiguration()
        .MinimumLevel.Information()
        .Enrich.FromLogContext()
        .WriteTo.Console()
        .CreateLogger();
}

builder.Host.UseSerilog();

// Add Azure Key Vault configuration (if configured)
var keyVaultUrl = builder.Configuration["KeyVault:Url"];
if (!string.IsNullOrEmpty(keyVaultUrl))
{
    try
    {
        builder.Configuration.AddAzureKeyVault(
            new Uri(keyVaultUrl),
            new DefaultAzureCredential());
        Log.Information("Azure Key Vault configuration loaded from {Url}", keyVaultUrl);
    }
    catch (Exception ex)
    {
        Log.Warning(ex, "Failed to load Azure Key Vault configuration from {Url}. Continuing without it.", keyVaultUrl);
    }
}

// Configure Kestrel for localhost binding in Production
if (!builder.Environment.IsDevelopment())
{
    builder.WebHost.ConfigureKestrel(options =>
    {
        var bindAddress = builder.Configuration["Server:BindAddress"] ?? "127.0.0.1";
        var port = builder.Configuration.GetValue<int>("Server:Port", 5000);

        if (System.Net.IPAddress.TryParse(bindAddress, out var ipAddress))
        {
            options.Listen(ipAddress, port);
            Log.Information("Kestrel configured to listen on {Address}:{Port}", bindAddress, port);
        }
        else
        {
            Log.Warning("Invalid bind address '{Address}', defaulting to localhost", bindAddress);
            options.Listen(System.Net.IPAddress.Loopback, port);
        }
    });
}

// Add services to the container
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new()
    {
        Title = "LLM Provider API",
        Version = "v1",
        Description = "A provider-agnostic API for interacting with multiple LLM providers."
    });

    // Add API Key authentication to Swagger
    options.AddSecurityDefinition("ApiKey", new OpenApiSecurityScheme
    {
        Description = "API Key authentication. Enter your API key in the X-API-Key header.",
        Name = "X-API-Key",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "ApiKeyScheme"
    });

    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "ApiKey"
                }
            },
            Array.Empty<string>()
        }
    });
});

// Add infrastructure and application services
builder.Services.AddInfrastructure();
builder.Services.AddInfrastructureWithConfiguration(builder.Configuration);
builder.Services.AddApplicationServices(builder.Configuration);

// Add providers — when multiple providers support the same model, the factory
// uses the configured provider priority (Providers:Priority in config) to choose.
// If no priority is configured and a conflict exists, the app should prompt the user.
builder.Services.AddAzureProvider(builder.Configuration);
builder.Services.AddAzureInferenceProvider(builder.Configuration);
builder.Services.AddLocalProvider(builder.Configuration);
builder.Services.AddClaudeCodeProvider(builder.Configuration);
builder.Services.AddAnthropicProvider(builder.Configuration);
builder.Services.AddGitHubModelsProvider(builder.Configuration);

// Add named HttpClient for image generation proxy (same Python server)
builder.Services.AddHttpClient("LocalPython", (sp, client) =>
{
    var localSection = builder.Configuration.GetSection("Providers:Local");
    var baseUrl = localSection["BaseUrl"] ?? "http://localhost:8000";
    client.BaseAddress = new Uri(baseUrl);
    client.Timeout = TimeSpan.FromSeconds(300); // SD can be slow on first load
});

// Add TUI Monitor auto-launch
builder.Services.AddHostedService<MonitorHostedService>();

// Add CORS for development
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

var app = builder.Build();

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// API Key authentication middleware (checks Security:ApiKey:Enabled config)
app.UseMiddleware<ApiKeyAuthenticationMiddleware>();

app.UseCors();
app.UseSerilogRequestLogging();

// Map endpoints
app.MapModelsEndpoints();
app.MapConversationsEndpoints();
app.MapLLMEndpoints();
app.MapHealthEndpoints();
app.MapStatisticsEndpoints();
app.MapImageEndpoints();
app.MapProvidersEndpoints();

// Root redirect to Swagger
app.MapGet("/", () => Results.Redirect("/swagger"))
    .ExcludeFromDescription();

try
{
    Log.Information("Starting LLM Provider API");
    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Application terminated unexpectedly");
}
finally
{
    Log.CloseAndFlush();
}

// Make Program class accessible for integration tests
public partial class Program { }
